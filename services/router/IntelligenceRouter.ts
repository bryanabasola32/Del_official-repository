import type { AICompletionRequest, AICompletionResponse } from '../providers/types';
import type { ModelProvider } from '../models/ModelProvider';
import type { ModelProviderProfile, Capability } from '../models/AIModelCapabilities';
import type { TaskType, TaskTypeSpec, Priority } from '../models/TaskTypes';
import { getTaskTypeSpec } from '../models/TaskTypes';
import type { ResearchJob, ResearchJobLog } from '../models/ResearchJob';
import { addLog } from '../models/ResearchJob';
import { getRoutingPolicy, type ProviderId } from './RoutingPolicy';
import { getExecutionLogger } from '../logging';
import { getAIHealthManager } from './AIHealthManager';
import { getQuotaManager } from './QuotaManager';
import type { ProviderLifecycleState } from '../models/ProviderConfig';
import { OpenAIProvider } from '../providers/openai/OpenAIProvider';
import { GeminiProvider } from '../providers/gemini/GeminiProvider';
import { AnthropicProvider } from '../providers/anthropic/AnthropicProvider';
import { OpenRouterProvider } from '../providers/openrouter/OpenRouterProvider';
import { GroqProvider } from '../providers/groq/GroqProvider';

/*
 * IntelligenceRouter — the single entry point for all LLM execution.
 *
 * DEL Orchestrator → Intelligence Router → Model Providers → Response
 *
 * The router:
 *   1. Discovers model providers dynamically (self-registration, no hardcoded switch).
 *   2. Scores each provider against the task's required + preferred capabilities.
 *   3. Selects the best-scoring provider (or uses preferredModel if specified).
 *   4. Consults the AI Health Manager to skip non-ACTIVE providers.
 *   5. Consults the Quota Manager to detect and handle quota failures.
 *   6. Executes the completion request and logs the decision.
 *   7. Supports future chained execution (multi-model pipelines) via executeChain().
 *
 * To add a new provider:
 *   1. Create a class implementing ModelProvider.
 *   2. Register it: router.registerProvider(new MyProvider()).
 *   3. Done — the router discovers it automatically. No router logic changes.
 */

export interface RouterTask {
  taskType: TaskType;
  prompt: string;
  systemPrompt?: string;
  schema?: Record<string, unknown>;
  documents?: string[];
  context?: Record<string, unknown>;
  priority?: Priority;
  preferredModel?: string;
  metadata?: Record<string, unknown>;
  temperature?: number;
  maxTokens?: number;
}

export interface ProviderScore {
  providerId: string;
  providerName: string;
  score: number;
  reason: string;
  meetsRequirements: boolean;
  state: ProviderLifecycleState;
}

export class IntelligenceRouter {
  private providers: Map<string, ModelProvider> = new Map();
  private logs: ResearchJobLog[] = [];
  private healthManager = getAIHealthManager();
  private quotaManager = getQuotaManager();

  /** Register a model provider. Providers self-register on construction. */
  registerProvider(provider: ModelProvider): void {
    if (this.providers.has(provider.id)) {
      return; // No duplicate registrations
    }
    this.providers.set(provider.id, provider);
    // Register with health manager — start as ACTIVE
    this.healthManager.registerProvider(provider.id, 'ACTIVE');
  }

  /** Unregister a provider (useful for testing / hot-swapping). */
  unregisterProvider(providerId: string): void {
    this.providers.delete(providerId);
  }

  /** Get all registered providers. */
  getProviders(): ModelProvider[] {
    return Array.from(this.providers.values());
  }

  /** Get a specific provider by ID. */
  getProvider(id: string): ModelProvider | undefined {
    return this.providers.get(id);
  }

  /** Get provider profiles for diagnostics / UI display. */
  getProviderProfiles(): ModelProviderProfile[] {
    return this.getProviders().map((p) => p.getProfile());
  }

  /**
   * Score all providers for a given task type.
   * Returns sorted list (highest score first).
   * Only ACTIVE providers are scored; non-ACTIVE providers are filtered out.
   */
  scoreProviders(taskType: TaskType): ProviderScore[] {
    const spec = getTaskTypeSpec(taskType);
    const scores: ProviderScore[] = [];

    for (const provider of this.getProviders()) {
      const state = this.healthManager.getState(provider.id) ?? 'ACTIVE';
      const score = this.scoreProvider(provider, spec, state);
      scores.push(score);
    }

    return scores.sort((a, b) => {
      if (a.meetsRequirements !== b.meetsRequirements) {
        return a.meetsRequirements ? -1 : 1;
      }
      return b.score - a.score;
    });
  }

  private scoreProvider(provider: ModelProvider, spec: TaskTypeSpec, state: ProviderLifecycleState): ProviderScore {
    const caps = provider.capabilities;

    const hasAllRequired = spec.requiredCapabilities.every(
      (cap) => caps.includes(cap as Capability),
    );

    let score = 0;
    const reasons: string[] = [];

    if (hasAllRequired) {
      score += 50;
      reasons.push('Meets all required capabilities');
    } else {
      const missing = spec.requiredCapabilities.filter(
        (cap) => !caps.includes(cap as Capability),
      );
      reasons.push(`Missing required: ${missing.join(', ')}`);
    }

    const preferredMatched = spec.preferredCapabilities.filter((cap) =>
      caps.includes(cap as Capability),
    );
    score += preferredMatched.length * 10;
    if (preferredMatched.length > 0) {
      reasons.push(`Preferred: ${preferredMatched.join(', ')}`);
    }

    score += Math.round(provider.qualityScore * 20);
    score += Math.round(provider.speedScore * 10);
    score -= Math.round(provider.costScore * 10);

    if (spec.suggestedMaxTokens && provider.maxContextTokens < spec.suggestedMaxTokens) {
      score -= 15;
      reasons.push('Context window may be tight');
    }

    return {
      providerId: provider.id,
      providerName: provider.name,
      score,
      reason: reasons.join('; '),
      meetsRequirements: hasAllRequired,
      state,
    };
  }

  /**
   * Select the best provider for a task.
   * If preferredModel is specified and registered and ACTIVE, use it directly.
   * Otherwise pick the highest-scoring ACTIVE provider that meets requirements.
   */
  selectProvider(task: RouterTask): ModelProvider {
    if (task.preferredModel && this.providers.has(task.preferredModel)) {
      if (this.healthManager.isAvailable(task.preferredModel)) {
        return this.providers.get(task.preferredModel)!;
      }
    }

    const scores = this.scoreProviders(task.taskType);
    const eligible = scores.filter((s) => s.meetsRequirements && this.healthManager.isAvailable(s.providerId));

    if (eligible.length === 0 && scores.length === 0) {
      throw new Error(`No model providers registered for task: ${task.taskType}`);
    }

    const best = eligible[0] || scores[0];
    const provider = this.providers.get(best.providerId);
    if (!provider) {
      throw new Error(`Selected provider not found: ${best.providerId}`);
    }
    return provider;
  }

  /**
   * Execute a single task through the router.
   * Returns the completion response from the selected provider.
   *
   * Multi-Model Intelligence Layer:
   *   - Uses the configurable RoutingPolicy to determine provider preference order.
   *   - Consults the AI Health Manager to skip non-ACTIVE providers.
   *   - Retries with the next preferred provider on failure (graceful fallback).
   *   - Uses the Quota Manager to detect and handle quota failures.
   *   - Logs every routing decision, retry, and fallback to the ExecutionLogger.
   *   - DEL never crashes — if everything fails, the last provider's mock fallback fires.
   */
  async execute(task: RouterTask, job?: ResearchJob): Promise<AICompletionResponse> {
    const spec = getTaskTypeSpec(task.taskType);
    const policy = getRoutingPolicy(task.taskType);
    const logger = getExecutionLogger();

    // Build the ordered list of providers to try:
    //   1. preferredModel (if specified and registered and ACTIVE)
    //   2. RoutingPolicy preferred providers (in order, if registered & ACTIVE)
    //   3. All other registered ACTIVE providers sorted by capability score (fallback)
    const tried = new Set<string>();
    const orderedProviders: ModelProvider[] = [];

    if (task.preferredModel && this.providers.has(task.preferredModel) && this.healthManager.isAvailable(task.preferredModel)) {
      const p = this.providers.get(task.preferredModel)!;
      orderedProviders.push(p);
      tried.add(p.id);
    }

    for (const prefId of policy.preferredProviders) {
      const p = this.providers.get(prefId);
      if (p && !tried.has(p.id) && p.isConfigured() && this.healthManager.isAvailable(p.id)) {
        orderedProviders.push(p);
        tried.add(p.id);
      }
    }

    // Add remaining ACTIVE providers sorted by capability score as final fallback
    const scores = this.scoreProviders(task.taskType);
    for (const s of scores) {
      if (!tried.has(s.providerId)) {
        const p = this.providers.get(s.providerId);
        if (p && this.healthManager.isAvailable(s.providerId)) {
          orderedProviders.push(p);
          tried.add(s.providerId);
        }
      }
    }

    if (orderedProviders.length === 0) {
      // All providers are non-ACTIVE (quota exhausted, offline, etc.).
      // Do NOT retry them — that would hammer failed providers on every request.
      // Return a structured failure with all provider errors.
      const allStates = this.getProviders().map((p) => {
        const state = this.healthManager.getState(p.id) ?? 'ACTIVE';
        return `${p.id}: ${state}`;
      });
      return {
        content: `[Router Fallback] All AI providers are unavailable. Provider states: ${allStates.join(', ')}`,
        provider: 'router',
        model: 'fallback',
        executionTimeMs: 0,
        confidence: 0,
        errors: allStates,
        warnings: ['All AI providers are unavailable — no provider was retried to avoid hammering failed APIs.'],
      };
    }

    if (orderedProviders.length === 0) {
      throw new Error(`No model providers registered for task: ${task.taskType}`);
    }

    const req: AICompletionRequest = {
      prompt: task.prompt,
      systemPrompt: task.systemPrompt,
      schema: task.schema,
      temperature: task.temperature ?? spec.suggestedTemperature,
      maxTokens: task.maxTokens ?? spec.suggestedMaxTokens,
    };

    let lastError: Error | null = null;
    let retryCount = 0;
    let fallbackProviderId: string | null = null;
    const allProviderErrors: Array<{ provider: string; error: string }> = [];

    for (let i = 0; i < orderedProviders.length; i++) {
      const provider = orderedProviders[i];
      const isPrimary = i === 0;
      const isFallback = !isPrimary;
      const providerState = this.healthManager.getState(provider.id) ?? 'ACTIVE';

      if (isFallback) {
        fallbackProviderId = provider.id;
      }

      const selectionReason = isPrimary
        ? `Primary selection: ${provider.name} for ${spec.label}`
        : `Fallback [${i}]: ${provider.name} for ${spec.label}`;

      const logEntry: Omit<ResearchJobLog, 'timestamp'> = {
        stage: 'router_execute',
        level: isFallback ? 'warning' : 'info',
        message: selectionReason,
        providerId: provider.id,
        metadata: {
          taskType: task.taskType,
          priority: task.priority || spec.defaultPriority,
          retryCount,
          isFallback,
          providerState,
        },
      };

      this.logs.push({ ...logEntry, timestamp: new Date().toISOString() });
      if (job) addLog(job, logEntry);
      logger.info('router', selectionReason, {
        providerId: provider.id,
        metadata: { taskType: task.taskType, retryCount, isFallback, providerState },
      });

      try {
        const stageId = logger.startStage('router_execute', {
          providerId: provider.id,
          metadata: { taskType: task.taskType, retryCount, providerState },
        });

        const response = await provider.complete(req);
        const latency = response.executionTimeMs ?? 0;

        // Record success with the health manager
        this.healthManager.recordSuccess(provider.id, latency);

        logger.completeStage(stageId, true, {
          provider: provider.id,
          model: response.model,
          executionTimeMs: latency,
          tokensUsed: response.tokensUsed,
          providerState: 'ACTIVE',
        });

        // Log the full AI execution with cost metadata
        logger.logAIExecution({
          stage: 'router_execute',
          provider: provider.id,
          model: response.model,
          taskType: task.taskType,
          executionTimeMs: latency,
          retryCount,
          jobId: job?.jobId,
          warnings: response.warnings,
          errors: response.errors,
          costMetadata: response.costMetadata,
          metadata: {
            fallbackProvider: fallbackProviderId,
            providerState: 'ACTIVE',
            confidence: response.confidence,
          },
        });

        if (response.warnings?.length || response.errors?.length) {
          logger.warning('router', `Provider ${provider.name} returned with warnings`, {
            providerId: provider.id,
            metadata: { warnings: response.warnings, errors: response.errors },
          });
        }

        return response;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        retryCount++;

        allProviderErrors.push({ provider: provider.id, error: lastError.message });

        // Let the Quota Manager classify and handle the error
        this.quotaManager.handleProviderError(provider.id, lastError.message);

        const currentState = this.healthManager.getState(provider.id) ?? 'ACTIVE';

        const errorLog: Omit<ResearchJobLog, 'timestamp'> = {
          stage: 'router_execute',
          level: 'error',
          message: `Provider ${provider.name} failed (attempt ${retryCount}): ${lastError.message}`,
          providerId: provider.id,
          metadata: { taskType: task.taskType, retryCount, error: lastError.message, providerState: currentState },
        };

        this.logs.push({ ...errorLog, timestamp: new Date().toISOString() });
        if (job) addLog(job, errorLog);
        logger.error('router', `Provider ${provider.name} failed: ${lastError.message}`, {
          providerId: provider.id,
          metadata: { taskType: task.taskType, retryCount, providerState: currentState },
        });

        // Continue to next provider (graceful fallback)
        if (i < orderedProviders.length - 1) {
          const nextProvider = orderedProviders[i + 1];
          const nextHealthState = this.healthManager.getState(nextProvider.id) ?? 'ACTIVE';
          const fallbackLog: Omit<ResearchJobLog, 'timestamp'> = {
            stage: 'router_execute',
            level: 'warning',
            message: `Falling back from ${provider.name} to ${nextProvider.name}`,
            providerId: nextProvider.id,
            metadata: { taskType: task.taskType, retryCount, providerState: nextHealthState },
          };
          this.logs.push({ ...fallbackLog, timestamp: new Date().toISOString() });
          if (job) addLog(job, fallbackLog);
        }
      }
    }

    // All providers failed — return a structured error response rather than crashing.
    const errorMsg = lastError?.message || 'All providers failed';
    const allErrors = allProviderErrors.map((e) => `${e.provider}: ${e.error}`);
    const errorLog: Omit<ResearchJobLog, 'timestamp'> = {
      stage: 'router_execute',
      level: 'error',
      message: `All providers failed for ${spec.label}: ${errorMsg}`,
      metadata: { taskType: task.taskType, retryCount, fallbackProvider: fallbackProviderId, allProviderErrors: allProviderErrors },
    };
    this.logs.push({ ...errorLog, timestamp: new Date().toISOString() });
    if (job) addLog(job, errorLog);
    logger.error('router', `All providers failed for ${spec.label}: ${errorMsg}`, {
      metadata: { taskType: task.taskType, retryCount, fallbackProvider: fallbackProviderId, allProviderErrors: allProviderErrors },
    });

    return {
      content: `[Router Fallback] All providers failed for ${spec.label}. Error: ${errorMsg}`,
      provider: 'router',
      model: 'fallback',
      executionTimeMs: 0,
      confidence: 0,
      errors: allErrors,
      warnings: ['All AI providers failed — returning fallback response. DEL continues to function.'],
    };
  }

  /**
   * Execute a chain of tasks through potentially different providers.
   * Each task's output is passed as context to the next task.
   */
  async executeChain(
    tasks: RouterTask[],
    job?: ResearchJob,
  ): Promise<AICompletionResponse[]> {
    const results: AICompletionResponse[] = [];
    let accumulatedContext = '';

    for (const task of tasks) {
      const enrichedTask: RouterTask = {
        ...task,
        context: {
          ...task.context,
          _chainPreviousOutput: accumulatedContext,
        },
      };

      const response = await this.execute(enrichedTask, job);
      results.push(response);
      accumulatedContext += `\n\n--- Previous Output ---\n${response.content}`;
    }

    return results;
  }

  /** Get all router logs (for diagnostics / monitoring dashboards). */
  getLogs(): ResearchJobLog[] {
    return [...this.logs];
  }

  /** Clear router logs. */
  clearLogs(): void {
    this.logs = [];
  }
}

// ── Singleton ──────────────────────────────

let _router: IntelligenceRouter | null = null;

export function getIntelligenceRouter(): IntelligenceRouter {
  if (!_router) {
    _router = new IntelligenceRouter();
  }
  // Self-registration safety net: if no providers are registered (e.g. orchestrator
  // failed to construct in the browser), register them directly here.
  if (_router.getProviders().length === 0) {
    try {
      _router.registerProvider(new OpenAIProvider());
      _router.registerProvider(new GeminiProvider());
      _router.registerProvider(new AnthropicProvider());
      _router.registerProvider(new OpenRouterProvider());
      _router.registerProvider(new GroqProvider());
    } catch (e) {
      console.error('[DEL Router] Failed to auto-register providers:', e);
    }
  }
  return _router;
}
