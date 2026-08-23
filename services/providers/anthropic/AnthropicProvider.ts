import type { AICompletionRequest, AICompletionResponse } from '../../providers/types';
import type { ModelProvider } from '../../models/ModelProvider';
import type { Capability, ModelProviderProfile } from '../../models/AIModelCapabilities';
import { callEdgeFunction } from '../edgeCall';

/*
 * AnthropicProvider — Claude-family model provider.
 *
 * Production mode: calls the `ai-anthropic` edge function.
 * On failure, throws an error so the Intelligence Router can fall back to the
 * next configured LLM provider. Does NOT silently return mock AI.
 *
 * Capabilities declared for capability-based routing by the Intelligence Router.
 */

const DEFAULT_MODEL = 'claude-sonnet-4';

export class AnthropicProvider implements ModelProvider {
  readonly id = 'anthropic';
  readonly name = 'Anthropic (Claude)';
  readonly isMock = false;

  readonly capabilities: Capability[] = [
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
  ];

  readonly costScore = 0.4;
  readonly speedScore = 0.7;
  readonly qualityScore = 0.9;
  readonly maxContextTokens = 200000;

  hasCapability(cap: Capability): boolean {
    return this.capabilities.includes(cap);
  }

  getProfile(): ModelProviderProfile {
    return {
      id: this.id,
      name: this.name,
      isMock: this.isMock,
      capabilities: this.capabilities,
      costScore: this.costScore,
      speedScore: this.speedScore,
      qualityScore: this.qualityScore,
      maxContextTokens: this.maxContextTokens,
    };
  }

  isConfigured(): boolean {
    return true;
  }

  async complete(req: AICompletionRequest): Promise<AICompletionResponse> {
    const startTime = Date.now();

    const result = await callEdgeFunction('ai-anthropic', req);

    if (result.ok && result.response) {
      return {
        ...result.response,
        provider: 'anthropic',
        model: result.response.model || DEFAULT_MODEL,
        executionTimeMs: Date.now() - startTime,
      };
    }

    // Throw so the router can fall back to the next provider.
    throw new Error(`Anthropic edge function failed: ${result.error}`);
  }
}