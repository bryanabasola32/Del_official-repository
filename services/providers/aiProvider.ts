import type { AICompletionRequest, AICompletionResponse } from './types';
import { getProviderConfig } from '../models/ProviderConfig';

/*
 * AIProvider — abstracts LLM completion calls.
 *
 * Implementations:
 *   - MockAIProvider      (placeholder, no external calls)
 *   - EdgeFunctionAIProvider  (delegates to the Intelligence Router's edge functions)
 *
 * The orchestrator selects the active implementation at runtime based on
 * available provider configs. Frontend code never calls OpenAI/Anthropic directly.
 */

export interface AIProvider {
  readonly name: string;
  readonly isMock: boolean;

  complete(req: AICompletionRequest): Promise<AICompletionResponse>;

  /** Quick check of whether the provider is configured (has credentials). */
  isConfigured(): boolean;
}

// ── Mock Implementation ──────────────────────────

export class MockAIProvider implements AIProvider {
  readonly name = 'mock-ai';
  readonly isMock = true;

  isConfigured(): boolean {
    return true;
  }

  async complete(req: AICompletionRequest): Promise<AICompletionResponse> {
    return {
      content: `[Mock AI] Processed prompt (${req.prompt.length} chars)`,
      structured: undefined,
      tokensUsed: Math.ceil(req.prompt.length / 4),
      provider: 'mock',
      model: 'mock-gpt-4o-mini',
    };
  }
}

// ── Edge Function Implementation ─────────────────

export class EdgeFunctionAIProvider implements AIProvider {
  readonly name = 'router';
  readonly isMock = false;

  isConfigured(): boolean {
    return true;
  }

  async complete(req: AICompletionRequest): Promise<AICompletionResponse> {
    const { getIntelligenceRouter } = require('../router');
    const router = getIntelligenceRouter();
    return router.execute({
      taskType: 'executive_summary',
      prompt: req.prompt,
      systemPrompt: req.systemPrompt,
      temperature: req.temperature,
      maxTokens: req.maxTokens,
    });
  }
}

// ── Factory ──────────────────────────────────────

export function createAIProvider(): AIProvider {
  const openaiConfig = getProviderConfig('openai');
  const geminiConfig = getProviderConfig('gemini');
  const anthropicConfig = getProviderConfig('anthropic');
  const openrouterConfig = getProviderConfig('openrouter');
  const groqConfig = getProviderConfig('groq');

  if ((openaiConfig?.enabled) || (geminiConfig?.enabled) || (anthropicConfig?.enabled) || (openrouterConfig?.enabled) || (groqConfig?.enabled)) {
    return new EdgeFunctionAIProvider();
  }

  return new MockAIProvider();
}
