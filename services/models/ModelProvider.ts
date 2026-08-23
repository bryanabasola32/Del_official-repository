import type { AICompletionRequest, AICompletionResponse } from '../providers/types';
import type { ModelProviderProfile, Capability } from './AIModelCapabilities';
import type { ProviderLifecycleState } from './ProviderConfig';

/*
 * ModelProvider — the interface every AI model provider implements.
 *
 * This extends the existing AIProvider interface with a capability profile
 * so the Intelligence Router can score and select providers dynamically.
 * The original AIProvider interface is preserved for backwards compatibility.
 *
 * Provider lifecycle state is managed by the AI Health Manager, not by
 * the provider itself. Providers only declare their static configuration.
 */

export interface ModelProvider {
  readonly id: string;
  readonly name: string;
  readonly isMock: boolean;

  /** Declared capabilities for router-based selection */
  readonly capabilities: Capability[];

  /** Cost score 0-1 (0 = free, 1 = expensive) */
  readonly costScore: number;
  /** Speed score 0-1 (0 = slow, 1 = fast) */
  readonly speedScore: number;
  /** Quality score 0-1 (0 = low, 1 = high) */
  readonly qualityScore: number;
  /** Max context window in tokens */
  readonly maxContextTokens: number;

  /** Execute a completion request */
  complete(req: AICompletionRequest): Promise<AICompletionResponse>;

  /** Check if provider has a specific capability */
  hasCapability(cap: Capability): boolean;

  /** Return the full profile for router scoring */
  getProfile(): ModelProviderProfile;

  /** Quick check of whether the provider is configured (has credentials) */
  isConfigured(): boolean;
}
