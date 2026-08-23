import type { TaskType } from '../models/TaskTypes';
import type { ProviderId } from '../models/ProviderConfig';
import { getProviderOrder, getRoutingGroup } from '../models/ProviderConfig';

/*
 * RoutingPolicy — configurable provider preference per task type.
 *
 * DEL v1 standardizes on two production AI providers: OpenAI and Gemini.
 * The Intelligence Router uses capability-based scoring as its primary
 * selection mechanism. This policy layer adds a configurable preference
 * order per task type so the router knows which provider to try first,
 * then second — before falling back to the highest-scoring available.
 *
 * Provider ordering is now centralized in ProviderConfig.ts (PROVIDER_ORDER
 * + ROUTING_GROUP_ASSIGNMENTS). This file consumes that configuration
 * to build per-task routing preferences at runtime. To change provider
 * order, edit PROVIDER_ORDER in ProviderConfig.ts — no router logic changes.
 *
 * Anthropic is deactivated from runtime routing but the architecture
 * remains extensible. To re-enable, add 'anthropic' back to the
 * PROVIDER_ORDER arrays in ProviderConfig.ts.
 *
 * This is NOT hardcoded inside agents. Agents declare a TaskType; the
 * RoutingPolicy decides provider order. No agent code changes.
 */

export type { ProviderId } from '../models/ProviderConfig';

export interface TaskRoutingPreference {
  /** Ordered list of preferred providers for this task type */
  preferredProviders: ProviderId[];
  /** Max retry attempts before giving up */
  maxRetries: number;
  /** Timeout in ms before falling back */
  timeoutMs: number;
}

export const DEFAULT_ROUTING_PREFERENCE: TaskRoutingPreference = {
  preferredProviders: ['openai', 'gemini', 'anthropic', 'openrouter', 'groq'],
  maxRetries: 2,
  timeoutMs: 30000,
};

/*
 * Per-task-type timeout overrides. Provider ordering comes from
 * ProviderConfig.ts; only timeout and retry values remain here since
 * they are task-specific (not provider-order-specific).
 */
const TASK_TIMEOUTS: Partial<Record<TaskType, number>> = {
  research_synthesis: 45000,
  research_analysis: 45000,
  long_context_analysis: 45000,
  large_context_summarization: 45000,
  document_consolidation: 45000,
  large_dataset_analysis: 60000,
  multi_document_analysis: 45000,
  evidence_verification: 45000,
  strategic_reasoning: 45000,
};

export function getRoutingPolicy(taskType: TaskType): TaskRoutingPreference {
  const group = getRoutingGroup(taskType);
  const preferredProviders = getProviderOrder(group);
  const timeoutMs = TASK_TIMEOUTS[taskType] ?? DEFAULT_ROUTING_PREFERENCE.timeoutMs;

  return {
    preferredProviders,
    maxRetries: DEFAULT_ROUTING_PREFERENCE.maxRetries,
    timeoutMs,
  };
}
