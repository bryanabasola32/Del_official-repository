import type { ResearchProviderLifecycleState } from '../models/ResearchProviderConfig';

/*
 * ResearchHealthManager — monitors research provider health at runtime.
 *
 * Mirrors the AIHealthManager pattern. Tracks per-provider:
 *   - Current lifecycle state (ACTIVE, INITIALIZING, QUOTA_EXHAUSTED, OFFLINE, DISABLED)
 *   - Last successful request timestamp
 *   - Last failed request timestamp
 *   - Consecutive failure count
 *   - Total failure/success counts
 *   - Last response latency
 *   - Retry count
 *   - Last error message
 *
 * Providers consult the Health Manager before executing calls.
 * The Quota Manager updates provider states when quota-related failures occur.
 * The Evidence Pipeline never crashes — unhealthy providers fall back to mock.
 */

export interface ResearchProviderHealthRecord {
  providerId: string;
  state: ResearchProviderLifecycleState;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  consecutiveFailures: number;
  totalFailures: number;
  totalSuccesses: number;
  totalRetries: number;
  lastLatencyMs: number | null;
  lastError: string | null;
  lastQuotaError: string | null;
  lastTimeoutAt: string | null;
}

class ResearchHealthManagerImpl {
  private records: Map<string, ResearchProviderHealthRecord> = new Map();

  registerProvider(providerId: string, initialState: ResearchProviderLifecycleState = 'ACTIVE'): void {
    if (!this.records.has(providerId)) {
      this.records.set(providerId, {
        providerId,
        state: initialState,
        lastSuccessAt: null,
        lastFailureAt: null,
        consecutiveFailures: 0,
        totalFailures: 0,
        totalSuccesses: 0,
        totalRetries: 0,
        lastLatencyMs: null,
        lastError: null,
        lastQuotaError: null,
        lastTimeoutAt: null,
      });
    }
  }

  getHealth(providerId: string): ResearchProviderHealthRecord | undefined {
    return this.records.get(providerId);
  }

  getAllHealth(): ResearchProviderHealthRecord[] {
    return Array.from(this.records.values());
  }

  isAvailable(providerId: string): boolean {
    const record = this.records.get(providerId);
    if (!record) return false;
    return record.state === 'ACTIVE';
  }

  getState(providerId: string): ResearchProviderLifecycleState | undefined {
    return this.records.get(providerId)?.state;
  }

  setState(providerId: string, state: ResearchProviderLifecycleState): void {
    const record = this.records.get(providerId);
    if (record) record.state = state;
  }

  recordSuccess(providerId: string, latencyMs: number): void {
    const record = this.records.get(providerId);
    if (!record) return;
    record.lastSuccessAt = new Date().toISOString();
    record.lastLatencyMs = latencyMs;
    record.consecutiveFailures = 0;
    record.totalSuccesses++;
    if (record.state === 'QUOTA_EXHAUSTED' || record.state === 'OFFLINE' || record.state === 'INITIALIZING') {
      record.state = 'ACTIVE';
    }
  }

  recordFailure(providerId: string, error: string, isTimeout = false): void {
    const record = this.records.get(providerId);
    if (!record) return;
    record.lastFailureAt = new Date().toISOString();
    record.lastError = error;
    record.consecutiveFailures++;
    record.totalFailures++;
    if (isTimeout) record.lastTimeoutAt = record.lastFailureAt;
  }

  recordRetry(providerId: string): void {
    const record = this.records.get(providerId);
    if (!record) return;
    record.totalRetries++;
  }

  recordQuotaFailure(providerId: string, error: string): void {
    const record = this.records.get(providerId);
    if (!record) return;
    record.lastQuotaError = error;
    record.lastFailureAt = new Date().toISOString();
    record.lastError = error;
    record.consecutiveFailures++;
    record.totalFailures++;
    record.state = 'QUOTA_EXHAUSTED';
  }

  tryRecover(providerId: string): boolean {
    const record = this.records.get(providerId);
    if (!record) return false;
    if (record.state === 'QUOTA_EXHAUSTED' || record.state === 'OFFLINE') {
      record.state = 'ACTIVE';
      record.consecutiveFailures = 0;
      return true;
    }
    return false;
  }

  getActiveProviders(): string[] {
    return Array.from(this.records.values())
      .filter((r) => r.state === 'ACTIVE')
      .map((r) => r.providerId);
  }

  getSummary(): Record<string, { state: ResearchProviderLifecycleState; consecutiveFailures: number; lastLatencyMs: number | null; totalRetries: number }> {
    const summary: Record<string, { state: ResearchProviderLifecycleState; consecutiveFailures: number; lastLatencyMs: number | null; totalRetries: number }> = {};
    for (const [id, record] of Array.from(this.records.entries())) {
      summary[id] = {
        state: record.state,
        consecutiveFailures: record.consecutiveFailures,
        lastLatencyMs: record.lastLatencyMs,
        totalRetries: record.totalRetries,
      };
    }
    return summary;
  }
}

let _researchHealthManager: ResearchHealthManagerImpl | null = null;

export function getResearchHealthManager(): ResearchHealthManagerImpl {
  if (!_researchHealthManager) {
    _researchHealthManager = new ResearchHealthManagerImpl();
  }
  return _researchHealthManager;
}

export type ResearchHealthManager = ResearchHealthManagerImpl;
