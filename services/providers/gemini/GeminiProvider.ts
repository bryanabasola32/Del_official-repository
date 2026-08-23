import type { AICompletionRequest, AICompletionResponse } from '../../providers/types';
import type { ModelProvider } from '../../models/ModelProvider';
import type { Capability, ModelProviderProfile } from '../../models/AIModelCapabilities';
import { getProviderConfig } from '../../models/ProviderConfig';
import { callEdgeFunction } from '../edgeCall';

/*
 * GeminiProvider — Google Gemini model provider.
 *
 * Reads all configuration from the centralized ProviderConfig.
 * Production mode: calls the `ai-gemini` edge function.
 * On failure, throws an error so the Intelligence Router can fall back to the
 * next configured LLM provider. Does NOT silently return mock AI.
 */

export class GeminiProvider implements ModelProvider {
  readonly id = 'gemini';
  readonly name: string;
  readonly isMock = false;
  readonly capabilities: Capability[];
  readonly costScore: number;
  readonly speedScore: number;
  readonly qualityScore: number;
  readonly maxContextTokens: number;

  constructor() {
    const config = getProviderConfig('gemini');
    this.name = config?.name ?? 'Google Gemini';
    this.capabilities = config?.capabilities ?? [];
    this.costScore = config?.costScore ?? 0.2;
    this.speedScore = config?.speedScore ?? 0.9;
    this.qualityScore = config?.qualityScore ?? 0.75;
    this.maxContextTokens = config?.maxContextTokens ?? 1000000;
  }

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
    const config = getProviderConfig('gemini');
    const defaultModel = config?.defaultModel ?? 'gemini-2.0-flash';
    const timeoutMs = config?.timeoutMs ?? 45000;

    const result = await callEdgeFunction('ai-gemini', req, timeoutMs);

    if (result.ok && result.response) {
      const response = result.response;
      const inputTokens = response.costMetadata?.inputTokens ?? Math.ceil(req.prompt.length / 4);
      const outputTokens = response.costMetadata?.outputTokens ?? response.tokensUsed ?? 0;
      const estimatedCostUsd = this.estimateCost(inputTokens, outputTokens);

      return {
        ...response,
        provider: 'gemini',
        model: response.model || defaultModel,
        executionTimeMs: Date.now() - startTime,
        costMetadata: {
          estimatedCostUsd,
          inputTokens,
          outputTokens,
        },
      };
    }

    // Throw so the router's fallback response (not a silent mock) is returned.
    throw new Error(`Gemini edge function failed: ${result.error}`);
  }

  private estimateCost(inputTokens: number, outputTokens: number): number {
    const config = getProviderConfig('gemini');
    const inputCost = (inputTokens / 1000) * (config?.costPer1KInputTokens ?? 0.0001);
    const outputCost = (outputTokens / 1000) * (config?.costPer1KOutputTokens ?? 0.0004);
    return Math.round((inputCost + outputCost) * 100000) / 100000;
  }
}