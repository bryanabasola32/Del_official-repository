import { getResearchHealthManager } from '../router/ResearchHealthManager';

/*
 * researchEdgeCall — shared helper for calling DEL research edge functions.
 *
 * Mirrors the AI edgeCall pattern. All research edge functions accept a
 * unified payload and return a unified response shape.
 *
 * Includes retry logic with exponential backoff, timeout handling, and
 * automatic health manager updates. If the edge function is unreachable
 * or returns an error, the caller falls back to its mock implementation
 * so the Evidence Pipeline never crashes.
 */

export interface ResearchEdgeCallResult<T> {
  ok: boolean;
  data?: T;
  error?: string;
  status?: number;
  retries: number;
  latencyMs: number;
}

export interface ResearchEdgeCallOptions {
  timeoutMs?: number;
  maxRetries?: number;
}

export async function callResearchEdgeFunction<T>(
  slug: string,
  providerId: string,
  payload: Record<string, unknown>,
  options: ResearchEdgeCallOptions = {},
): Promise<ResearchEdgeCallResult<T>> {
  const healthManager = getResearchHealthManager();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const timeoutMs = options.timeoutMs ?? 20000;
  const maxRetries = options.maxRetries ?? 2;
  const startTime = Date.now();
  let retries = 0;

  if (!supabaseUrl || !anonKey) {
    return { ok: false, error: 'Supabase URL or anon key not configured', retries: 0, latencyMs: 0 };
  }

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      healthManager.recordRetry(providerId);
      const backoffMs = Math.min(1000 * Math.pow(2, attempt - 1), 4000);
      await new Promise((r) => setTimeout(r, backoffMs));
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
        const errorMsg = `Edge function ${slug} returned ${response.status}: ${errorText}`;

        if (response.status === 429 || response.status === 402) {
          healthManager.recordQuotaFailure(providerId, errorMsg);
          return { ok: false, error: errorMsg, status: response.status, retries, latencyMs: Date.now() - startTime };
        }

        // 503 = not configured (missing API key) — not retryable, return immediately
        if (response.status === 503) {
          healthManager.recordFailure(providerId, errorMsg, false);
          return { ok: false, error: errorMsg, status: response.status, retries, latencyMs: Date.now() - startTime };
        }

        if (attempt < maxRetries) continue;

        healthManager.recordFailure(providerId, errorMsg, false);
        return { ok: false, error: errorMsg, status: response.status, retries, latencyMs: Date.now() - startTime };
      }

      const data = await response.json();

      if (data.error) {
        const errorMsg = data.error as string;

        if (/quota|rate.*limit|429/i.test(errorMsg)) {
          healthManager.recordQuotaFailure(providerId, errorMsg);
        }

        if (attempt < maxRetries) continue;

        healthManager.recordFailure(providerId, errorMsg, false);
        return { ok: false, error: errorMsg, status: response.status, retries, latencyMs: Date.now() - startTime };
      }

      const latencyMs = Date.now() - startTime;
      healthManager.recordSuccess(providerId, latencyMs);

      return { ok: true, data: data as T, retries, latencyMs };
    } catch (err) {
      clearTimeout(timeout);
      const message = err instanceof Error ? err.message : 'Network error';
      const isTimeout = err instanceof Error && err.name === 'AbortError';

      if (attempt < maxRetries) {
        healthManager.recordRetry(providerId);
        continue;
      }

      healthManager.recordFailure(providerId, message, isTimeout);
      return { ok: false, error: message, retries, latencyMs: Date.now() - startTime };
    }
  }

  return { ok: false, error: 'Max retries exceeded', retries, latencyMs: Date.now() - startTime };
}
