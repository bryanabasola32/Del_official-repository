import type { AICompletionRequest, AICompletionResponse } from '../../providers/types';
import type { ModelProvider } from '../../models/ModelProvider';
import type { Capability, ModelProviderProfile } from '../../models/AIModelCapabilities';
import { getProviderConfig } from '../../models/ProviderConfig';
import { callEdgeFunction } from '../edgeCall';

/*
 * GroqProvider — Groq model provider.
 *
 * Reads all configuration from the centralized ProviderConfig.
 * Production mode: calls the `ai-groq` edge function.
 * On failure, throws an error so the Intelligence Router can fall back to the
 * next configured LLM provider. Does NOT silently return mock AI.
 */

export class GroqProvider implements ModelProvider {
  readonly id = 'groq';
  readonly name: string;
  readonly isMock = false;
  readonly capabilities: Capability[];
  readonly costScore: number;
  readonly speedScore: number;
  readonly qualityScore: number;
  readonly maxContextTokens: number;

  constructor() {
    const config = getProviderConfig('groq');
    this.name = config?.name ?? 'Groq';
    this.capabilities = config?.capabilities ?? [];
    this.costScore = config?.costScore ?? 0.1;
    this.speedScore = config?.speedScore ?? 0.95;
    this.qualityScore = config?.qualityScore ?? 0.75;
    this.maxContextTokens = config?.maxContextTokens ?? 128000;
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
    const config = getProviderConfig('groq');
    const defaultModel = config?.defaultModel ?? 'llama-3.3-70b-versatile';
    const timeoutMs = config?.timeoutMs ?? 30000;

    const result = await callEdgeFunction('ai-groq', req, timeoutMs);

    if (result.ok && result.response) {
      const response = result.response;
      const inputTokens = response.costMetadata?.inputTokens ?? Math.ceil(req.prompt.length / 4);
      const outputTokens = response.costMetadata?.outputTokens ?? response.tokensUsed ?? 0;
      const estimatedCostUsd = this.estimateCost(inputTokens, outputTokens);

      return {
        ...response,
        provider: 'groq',
        model: response.model || defaultModel,
        executionTimeMs: Date.now() - startTime,
        costMetadata: {
          estimatedCostUsd,
          inputTokens,
          outputTokens,
        },
      };
    }

    // Throw so the router's fallback logic can try the next provider.
    throw new Error(`Groq edge function failed: ${result.error}`);
  }

  private estimateCost(inputTokens: number, outputTokens: number): number {
    const config = getProviderConfig('groq');
    const inputCost = (inputTokens / 1000) * (config?.costPer1KInputTokens ?? 0);
    const outputCost = (outputTokens / 1000) * (config?.costPer1KOutputTokens ?? 0);
    return Math.round((inputCost + outputCost) * 100000) / 100000;
  }
}
