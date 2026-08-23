import type { ResearchJobLog } from '../models/ResearchJob';

/*
 * ExecutionLogger — structured execution logging for DEL's AI pipeline.
 *
 * Tracks:
 *   - Selected Model (which provider was chosen and why)
 *   - Selected Agent (which agent ran)
 *   - Execution Time (duration in ms)
 *   - Pipeline Stage (which stage of the pipeline)
 *   - Errors and Warnings
 *   - ResearchJob Status transitions
 *
 * Logs are structured (not free-text) so they can later power monitoring
 * dashboards without parsing. Each log entry has a timestamp, stage, level,
 * and optional metadata.
 *
 * The logger is a standalone singleton — agents and the router push logs
 * to it, and it can be queried for diagnostics or displayed in a future
 * monitoring UI.
 */

export type LogLevel = 'info' | 'warning' | 'error';

export interface ExecutionLogEntry extends ResearchJobLog {
  id: string;
}

export interface PipelineStageLog {
  stage: string;
  agentName?: string;
  providerId?: string;
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
  success: boolean;
  metadata?: Record<string, unknown>;
}

class ExecutionLoggerImpl {
  private logs: ExecutionLogEntry[] = [];
  private stageTimers: Map<string, PipelineStageLog> = new Map();

  log(
    stage: string,
    level: LogLevel,
    message: string,
    metadata?: {
      providerId?: string;
      agentName?: string;
      metadata?: Record<string, unknown>;
    },
  ): void {
    const entry: ExecutionLogEntry = {
      id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
      stage,
      level,
      message,
      providerId: metadata?.providerId,
      agentName: metadata?.agentName,
      metadata: metadata?.metadata,
    };
    this.logs.push(entry);
  }

  /** Start timing a pipeline stage. */
  startStage(stage: string, opts?: { agentName?: string; providerId?: string; metadata?: Record<string, unknown> }): string {
    const stageId = `${stage}-${Date.now()}`;
    this.stageTimers.set(stageId, {
      stage,
      agentName: opts?.agentName,
      providerId: opts?.providerId,
      startedAt: new Date().toISOString(),
      success: false,
      metadata: opts?.metadata,
    });
    this.log(stage, 'info', `Stage started: ${stage}`, {
      agentName: opts?.agentName,
      providerId: opts?.providerId,
      metadata: opts?.metadata,
    });
    return stageId;
  }

  /** Complete a pipeline stage and record duration. */
  completeStage(stageId: string, success: boolean, metadata?: Record<string, unknown>): void {
    const timer = this.stageTimers.get(stageId);
    if (!timer) return;

    const completedAt = new Date().toISOString();
    timer.completedAt = completedAt;
    timer.durationMs = Date.now() - new Date(timer.startedAt).getTime();
    timer.success = success;
    if (metadata) timer.metadata = { ...timer.metadata, ...metadata };

    this.log(timer.stage, success ? 'info' : 'error',
      `Stage ${success ? 'completed' : 'failed'}: ${timer.stage} (${timer.durationMs}ms)`,
      {
        agentName: timer.agentName,
        providerId: timer.providerId,
        metadata: { durationMs: timer.durationMs, ...metadata },
      },
    );

    this.stageTimers.delete(stageId);
  }

  /** Convenience: log an info message. */
  info(stage: string, message: string, metadata?: Parameters<ExecutionLoggerImpl['log']>[3]): void {
    this.log(stage, 'info', message, metadata);
  }

  /** Convenience: log a warning. */
  warning(stage: string, message: string, metadata?: Parameters<ExecutionLoggerImpl['log']>[3]): void {
    this.log(stage, 'warning', message, metadata);
  }

  /** Convenience: log an error. */
  error(stage: string, message: string, metadata?: Parameters<ExecutionLoggerImpl['log']>[3]): void {
    this.log(stage, 'error', message, metadata);
  }

  /** Convenience: log a debug message. */
  debug(stage: string, message: string, metadata?: Parameters<ExecutionLoggerImpl['log']>[3]): void {
    this.log(stage, 'info', `[DEBUG] ${message}`, metadata);
  }

  /**
   * Log a structured AI execution entry with full metadata for the
   * Multi-Model Intelligence Layer.
   *
   * Tracks: provider, model, task type, execution time, retry count,
   * pipeline stage, ResearchJob ID, warnings, errors, and cost metadata.
   */
  logAIExecution(params: {
    stage: string;
    provider: string;
    model: string;
    taskType: string;
    executionTimeMs: number;
    retryCount: number;
    jobId?: string;
    warnings?: string[];
    errors?: string[];
    providerState?: string;
    fallbackProvider?: string | null;
    confidence?: number;
    costMetadata?: {
      estimatedCostUsd?: number;
      inputTokens?: number;
      outputTokens?: number;
    };
    metadata?: Record<string, unknown>;
  }): void {
    const hasErrors = params.errors && params.errors.length > 0;
    const hasWarnings = params.warnings && params.warnings.length > 0;
    const level = hasErrors ? 'error' : hasWarnings ? 'warning' : 'info';
    this.log(params.stage, level,
      `AI execution: ${params.provider}/${params.model} for ${params.taskType} (${params.executionTimeMs}ms, retries: ${params.retryCount})`,
      {
        providerId: params.provider,
        metadata: {
          provider: params.provider,
          model: params.model,
          taskType: params.taskType,
          executionTimeMs: params.executionTimeMs,
          retryCount: params.retryCount,
          jobId: params.jobId,
          warnings: params.warnings,
          errors: params.errors,
          providerState: params.providerState,
          fallbackProvider: params.fallbackProvider,
          confidence: params.confidence,
          cost: params.costMetadata,
          ...params.metadata,
        },
      },
    );
  }

  /**
   * Log a structured research provider execution entry with full metadata.
   *
   * Tracks: provider, provider category, latency, retries, fallback status,
   * result count, mock status, and warnings for research providers.
   */
  logResearchExecution(params: {
    stage: string;
    provider: string;
    providerCategory: string;
    latencyMs: number;
    retries: number;
    fallback: boolean;
    resultCount: number;
    mock: boolean;
    warning?: string;
    metadata?: Record<string, unknown>;
  }): void {
    const hasWarning = !!params.warning;
    const level = params.fallback ? 'warning' : hasWarning ? 'warning' : 'info';
    this.log(params.stage, level,
      `Research execution: ${params.provider} (${params.providerCategory}) — ${params.resultCount} results, ${params.latencyMs}ms, retries: ${params.retries}${params.fallback ? ' [FALLBACK]' : ''}${params.mock ? ' [MOCK]' : ''}`,
      {
        providerId: params.provider,
        metadata: {
          provider: params.provider,
          providerCategory: params.providerCategory,
          latencyMs: params.latencyMs,
          retries: params.retries,
          fallback: params.fallback,
          resultCount: params.resultCount,
          mock: params.mock,
          warning: params.warning,
          ...params.metadata,
        },
      },
    );
  }

  /** Get all logs (for diagnostics / monitoring dashboards). */
  getLogs(): ExecutionLogEntry[] {
    return [...this.logs];
  }

  /** Get logs filtered by stage. */
  getLogsByStage(stage: string): ExecutionLogEntry[] {
    return this.logs.filter((l) => l.stage === stage);
  }

  /** Get logs filtered by level. */
  getLogsByLevel(level: LogLevel): ExecutionLogEntry[] {
    return this.logs.filter((l) => l.level === level);
  }

  /** Get recent logs (last N). */
  getRecentLogs(count = 50): ExecutionLogEntry[] {
    return this.logs.slice(-count);
  }

  /** Clear all logs. */
  clear(): void {
    this.logs = [];
    this.stageTimers.clear();
  }
}

// Singleton instance
let _logger: ExecutionLoggerImpl | null = null;

export function getExecutionLogger(): ExecutionLoggerImpl {
  if (!_logger) {
    _logger = new ExecutionLoggerImpl();
  }
  return _logger;
}

export type ExecutionLogger = ExecutionLoggerImpl;
