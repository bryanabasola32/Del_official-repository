import type { Capability } from './AIModelCapabilities';
import type { TaskType } from './TaskTypes';

/*
 * ProviderConfig — centralized configuration for all AI model providers.
 *
 * Every provider-specific value (model name, temperature, max tokens, timeout,
 * retry count, priority, enabled flag, task assignments) lives here.
 * Provider implementations read from this config instead of hardcoding values.
 *
 * To add a new provider:
 *   1. Add an entry to PROVIDER_CONFIGS below.
 *   2. Create the provider class (reading from this config).
 *   3. Register it in the Provider Registry.
 * No router or architecture changes required.
 */

/** All valid LLM provider IDs known to DEL. */
export type ProviderId = 'openai' | 'gemini' | 'anthropic' | 'openrouter' | 'groq';

export type ProviderLifecycleState =
  | 'ACTIVE'
  | 'INACTIVE'
  | 'OFFLINE'
  | 'QUOTA_EXHAUSTED'
  | 'MAINTENANCE';

export interface ProviderConfig {
  /** Unique provider ID */
  id: string;
  /** Human-readable name */
  name: string;
  /** Whether the provider is enabled for runtime use */
  enabled: boolean;
  /** Default model identifier */
  defaultModel: string;
  /** Default temperature (0-1) */
  defaultTemperature: number;
  /** Default max tokens for response */
  defaultMaxTokens: number;
  /** Request timeout in ms */
  timeoutMs: number;
  /** Max retry attempts before fallback */
  maxRetries: number;
  /** Priority weight (lower = higher priority) */
  priority: number;
  /** Edge function slug */
  edgeFunctionSlug: string;
  /** Declared capabilities */
  capabilities: Capability[];
  /** Cost score 0-1 (0 = free, 1 = expensive) */
  costScore: number;
  /** Speed score 0-1 (0 = slow, 1 = fast) */
  speedScore: number;
  /** Quality score 0-1 (0 = low, 1 = high) */
  qualityScore: number;
  /** Max context window in tokens */
  maxContextTokens: number;
  /** Task types this provider is preferred for (in priority order) */
  preferredTasks: TaskType[];
  /** Estimated cost per 1K input tokens in USD */
  costPer1KInputTokens: number;
  /** Estimated cost per 1K output tokens in USD */
  costPer1KOutputTokens: number;
  /** Mock confidence value */
  mockConfidence: number;
}

export const PROVIDER_CONFIGS: Record<string, ProviderConfig> = {
  openai: {
    id: 'openai',
    name: 'OpenAI (GPT)',
    enabled: true,
    defaultModel: 'gpt-4o-mini',
    defaultTemperature: 0.3,
    defaultMaxTokens: 4096,
    timeoutMs: 30000,
    maxRetries: 2,
    priority: 1,
    edgeFunctionSlug: 'ai-openai',
    capabilities: [
      'structured_json',
      'persona_generation',
      'invitation_writing',
      'tool_calling',
      'fast_inference',
      'cost_efficient',
      'research_reasoning',
      'source_comparison',
      'high_reasoning',
      'evidence_verification',
      'company_analysis',
      'tech_readiness_analysis',
      'strategic_reasoning',
    ],
    costScore: 0.3,
    speedScore: 0.85,
    qualityScore: 0.8,
    maxContextTokens: 128000,
    preferredTasks: [
      'persona_generation',
      'invitation_writing',
      'recommendation_generation',
      'executive_summary',
      'executive_intelligence',
      'scoring',
      'tool_calling',
      'structured_extraction',
      'fact_extraction',
      'quality_review',
      'tech_readiness_analysis',
    ],
    costPer1KInputTokens: 0.00015,
    costPer1KOutputTokens: 0.0006,
    mockConfidence: 0.6,
  },
  gemini: {
    id: 'gemini',
    name: 'Google Gemini',
    enabled: true,
    defaultModel: 'gemini-2.0-flash',
    defaultTemperature: 0.3,
    defaultMaxTokens: 8192,
    timeoutMs: 45000,
    maxRetries: 2,
    priority: 2,
    edgeFunctionSlug: 'ai-gemini',
    capabilities: [
      'long_context',
      'large_context_summarization',
      'document_consolidation',
      'large_dataset_analysis',
      'multi_document_analysis',
      'structured_json',
      'fast_inference',
      'cost_efficient',
      'research_reasoning',
      'source_comparison',
      'high_reasoning',
      'evidence_verification',
      'company_analysis',
      'tech_readiness_analysis',
      'strategic_reasoning',
    ],
    costScore: 0.2,
    speedScore: 0.9,
    qualityScore: 0.75,
    maxContextTokens: 1000000,
    preferredTasks: [
      'research_synthesis',
      'research_analysis',
      'company_analysis',
      'long_context_analysis',
      'large_context_summarization',
      'document_consolidation',
      'large_dataset_analysis',
      'multi_document_analysis',
      'summarization',
      'evidence_verification',
      'strategic_reasoning',
    ],
    costPer1KInputTokens: 0.0001,
    costPer1KOutputTokens: 0.0004,
    mockConfidence: 0.6,
  },
  openrouter: {
    id: 'openrouter',
    name: 'OpenRouter',
    enabled: true,
    defaultModel: 'openai/gpt-4o-mini',
    defaultTemperature: 0.3,
    defaultMaxTokens: 4096,
    timeoutMs: 30000,
    maxRetries: 2,
    priority: 4,
    edgeFunctionSlug: 'ai-openrouter',
    capabilities: [
      'structured_json',
      'persona_generation',
      'invitation_writing',
      'fast_inference',
      'cost_efficient',
      'research_reasoning',
      'source_comparison',
      'high_reasoning',
      'evidence_verification',
      'company_analysis',
      'tech_readiness_analysis',
      'strategic_reasoning',
    ],
    costScore: 0.15,
    speedScore: 0.85,
    qualityScore: 0.8,
    maxContextTokens: 128000,
    preferredTasks: [
      'persona_generation',
      'invitation_writing',
      'recommendation_generation',
      'executive_summary',
      'executive_intelligence',
      'scoring',
      'tool_calling',
      'structured_extraction',
      'fact_extraction',
      'quality_review',
      'tech_readiness_analysis',
    ],
    costPer1KInputTokens: 0.0001,
    costPer1KOutputTokens: 0.0004,
    mockConfidence: 0.6,
  },
  groq: {
    id: 'groq',
    name: 'Groq',
    enabled: true,
    defaultModel: 'llama-3.3-70b-versatile',
    defaultTemperature: 0.3,
    defaultMaxTokens: 4096,
    timeoutMs: 30000,
    maxRetries: 2,
    priority: 5,
    edgeFunctionSlug: 'ai-groq',
    capabilities: [
      'structured_json',
      'persona_generation',
      'invitation_writing',
      'fast_inference',
      'cost_efficient',
      'research_reasoning',
      'source_comparison',
      'high_reasoning',
      'evidence_verification',
      'company_analysis',
      'tech_readiness_analysis',
      'strategic_reasoning',
    ],
    costScore: 0.1,
    speedScore: 0.95,
    qualityScore: 0.75,
    maxContextTokens: 128000,
    preferredTasks: [
      'persona_generation',
      'invitation_writing',
      'recommendation_generation',
      'executive_summary',
      'executive_intelligence',
      'scoring',
      'structured_extraction',
      'fact_extraction',
      'quality_review',
      'tech_readiness_analysis',
    ],
    costPer1KInputTokens: 0,
    costPer1KOutputTokens: 0,
    mockConfidence: 0.6,
  },
  // Anthropic config preserved for future activation.
  // To enable: set `enabled: true` and register in the Provider Registry.
  anthropic: {
    id: 'anthropic',
    name: 'Anthropic (Claude)',
    enabled: true,
    defaultModel: 'claude-sonnet-4',
    defaultTemperature: 0.3,
    defaultMaxTokens: 4096,
    timeoutMs: 30000,
    maxRetries: 2,
    priority: 3,
    edgeFunctionSlug: 'ai-anthropic',
    capabilities: [
      'long_context',
      'multi_document_analysis',
      'research_reasoning',
      'source_comparison',
      'high_reasoning',
      'structured_json',
      'evidence_verification',
      'strategic_reasoning',
      'company_analysis',
      'tech_readiness_analysis',
    ],
    costScore: 0.4,
    speedScore: 0.7,
    qualityScore: 0.9,
    maxContextTokens: 200000,
    preferredTasks: [],
    costPer1KInputTokens: 0.0003,
    costPer1KOutputTokens: 0.0015,
    mockConfidence: 0.65,
  },
};

// ── Centralized Provider Ordering ─────────────────
//
// Single source of truth for the order in which LLM providers are attempted
// per routing group. RoutingPolicy.ts consumes these arrays instead of
// hardcoding provider order per task type.
//
// To change which provider is tried first for a group, edit the array here.
// No router logic changes required.
//
// Group assignments (which TaskType maps to which group) are defined in
// ROUTING_GROUP_ASSIGNMENTS below.

export type RoutingGroup = 'openai_primary' | 'gemini_primary';

export interface ProviderOrderConfig {
  /** Ordered provider IDs for the openai-primary group */
  openai_primary: ProviderId[];
  /** Ordered provider IDs for the gemini-primary group */
  gemini_primary: ProviderId[];
}

export const PROVIDER_ORDER: ProviderOrderConfig = {
  openai_primary: ['openai', 'gemini', 'anthropic', 'openrouter', 'groq'],
  gemini_primary: ['gemini', 'openai', 'anthropic', 'openrouter', 'groq'],
};

/** Which routing group each TaskType uses. */
export const ROUTING_GROUP_ASSIGNMENTS: Record<TaskType, RoutingGroup> = {
  persona_generation: 'openai_primary',
  invitation_writing: 'openai_primary',
  recommendation_generation: 'openai_primary',
  executive_summary: 'openai_primary',
  executive_intelligence: 'openai_primary',
  scoring: 'openai_primary',
  tool_calling: 'openai_primary',
  structured_extraction: 'openai_primary',
  fact_extraction: 'openai_primary',
  quality_review: 'openai_primary',
  tech_readiness_analysis: 'openai_primary',
  research_synthesis: 'gemini_primary',
  research_analysis: 'gemini_primary',
  company_analysis: 'gemini_primary',
  long_context_analysis: 'gemini_primary',
  large_context_summarization: 'gemini_primary',
  document_consolidation: 'gemini_primary',
  large_dataset_analysis: 'gemini_primary',
  multi_document_analysis: 'gemini_primary',
  summarization: 'gemini_primary',
  evidence_verification: 'gemini_primary',
  strategic_reasoning: 'gemini_primary',
};

/** All valid provider IDs known to DEL. Used for validation. */
export const KNOWN_PROVIDER_IDS: ProviderId[] = ['openai', 'gemini', 'anthropic', 'openrouter', 'groq'];

/**
 * Validate a provider order array. Returns a sanitized array with:
 * - unknown IDs removed
 * - duplicates removed (first occurrence kept)
 * - only enabled providers included
 * Falls back to KNOWN_PROVIDER_IDS if the result is empty.
 */
export function validateProviderOrder(order: ProviderId[]): ProviderId[] {
  const seen = new Set<ProviderId>();
  const result: ProviderId[] = [];
  for (const id of order) {
    if (!KNOWN_PROVIDER_IDS.includes(id)) continue;
    if (seen.has(id)) continue;
    const config = PROVIDER_CONFIGS[id];
    if (!config?.enabled) continue;
    seen.add(id);
    result.push(id);
  }
  if (result.length === 0) {
    return KNOWN_PROVIDER_IDS.filter((id) => PROVIDER_CONFIGS[id]?.enabled);
  }
  return result;
}

/** Get the validated provider order for a routing group. */
export function getProviderOrder(group: RoutingGroup): ProviderId[] {
  return validateProviderOrder(PROVIDER_ORDER[group]);
}

/** Get the routing group for a task type. */
export function getRoutingGroup(taskType: TaskType): RoutingGroup {
  return ROUTING_GROUP_ASSIGNMENTS[taskType] ?? 'openai_primary';
}

export function getProviderConfig(id: string): ProviderConfig | undefined {
  return PROVIDER_CONFIGS[id];
}

export function getEnabledProviderConfigs(): ProviderConfig[] {
  return Object.values(PROVIDER_CONFIGS).filter((c) => c.enabled);
}

export function getProviderIdsForTask(taskType: TaskType): string[] {
  return Object.values(PROVIDER_CONFIGS)
    .filter((c) => c.enabled && c.preferredTasks.includes(taskType))
    .sort((a, b) => a.priority - b.priority)
    .map((c) => c.id);
}
