import type { AICompletionRequest, AICompletionResponse } from './types';

/*
 * edgeCall — shared helper for calling DEL edge functions that proxy AI APIs.
 *
 * All AI provider edge functions accept a unified payload and return a unified
 * response shape. This keeps provider implementations thin and consistent.
 *
 * If the edge function is unreachable or returns an error, the caller falls
 * back to its mock implementation so DEL never crashes.
 */

export interface EdgeCallResult {
  ok: boolean;
  response?: AICompletionResponse;
  error?: string;
  status?: number;
}

export async function callEdgeFunction(
  slug: string,
  payload: AICompletionRequest,
  timeoutMs = 30000,
): Promise<EdgeCallResult> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !anonKey) {
    return { ok: false, error: 'Supabase URL or anon key not configured' };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/${slug}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${anonKey}`,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      return { ok: false, error: `Edge function ${slug} returned ${response.status}: ${errorText}`, status: response.status };
    }

    const data = await response.json();
    if (data.error) {
      return { ok: false, error: data.error, status: response.status };
    }

    return { ok: true, response: data as AICompletionResponse };
  } catch (err) {
    clearTimeout(timeout);
    const message = err instanceof Error ? err.message : 'Network error';
    return { ok: false, error: message };
  }
}

/*
 * buildResponse — constructs a standardized AICompletionResponse with metadata.
 */
export function buildResponse(
  provider: string,
  model: string,
  content: string,
  options: {
    tokensUsed?: number;
    structured?: Record<string, unknown>;
    executionTimeMs?: number;
    confidence?: number;
    warnings?: string[];
    errors?: string[];
    isMock?: boolean;
  } = {},
): AICompletionResponse {
  return {
    content,
    structured: options.structured,
    tokensUsed: options.tokensUsed,
    provider,
    model,
    executionTimeMs: options.executionTimeMs,
    confidence: options.confidence,
    warnings: options.warnings,
    errors: options.errors,
    isMock: options.isMock,
  };
}
