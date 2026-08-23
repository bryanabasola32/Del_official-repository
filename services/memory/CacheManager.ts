import type { MemoryProvider } from '../providers/memoryProvider';

/*
 * CacheManager — TTL-based cache for AI results.
 *
 * Wraps the MemoryProvider's key-value cache. Used by the MemoryAgent to
 * avoid redundant API calls and research runs.
 *
 * Cache keys follow the convention:
 *   evidence:{contactId}       — cached EvidencePackage
 *   persona:{contactId}        — cached SynthesizedPersona
 *   invitation:{contactId}:{eventId} — cached InvitationDraft
 *   recommendation:{contactId}:{eventId} — cached ScoreResult
 *   job:{jobId}                — cached ResearchJob
 *
 * Future: backed by Redis or Supabase cache table for cross-instance sharing.
 */

export class CacheManager {
  constructor(private memoryProvider: MemoryProvider) {}

  async get<T>(key: string): Promise<T | null> {
    return this.memoryProvider.getCached<T>(key);
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    await this.memoryProvider.setCached<T>(key, value, ttlSeconds);
  }

  /** Convenience: get-or-compute pattern. */
  async getOrCompute<T>(
    key: string,
    compute: () => Promise<T>,
    ttlSeconds?: number,
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) return cached;
    const value = await compute();
    await this.set(key, value, ttlSeconds);
    return value;
  }
}
