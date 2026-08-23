import type { ProviderLifecycleState } from '../models/ProviderConfig';

/*
 * AIHealthManager — monitors provider health at runtime.
 *
 * Tracks per-provider:
 *   - Current lifecycle state (ACTIVE, INACTIVE, OFFLINE, QUOTA_EXHAUSTED, MAINTENANCE)
 *   - Last successful request timestamp
 *   - Last failed request timestamp
 *   - Consecutive failure count
 *   - Total failure count
 *   - Last response latency
 *   - Last error message
 *
 * The Intelligence Router consults the Health Manager before selecting any
 * provider. Providers that are not ACTIVE are skipped.
 *
 * The Quota Manager updates provider states when quota-related failures occur.
 * The Health Manager is the single source of truth for provider availability.
 */

export interface ProviderHealthRecord {
  providerId: string;
  state: ProviderLifecycleState;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  consecutiveFailures: number;
  totalFailures: number;
  totalSuccesses: number;
  lastLatencyMs: number | null;
  lastError: string | null;
  lastQuotaError: string | null;
  lastTimeoutAt: string | null;
}

class AIHealthManagerImpl {
  private records: Map<string, ProviderHealthRecord> = new Map();

  /** Register a provider for health tracking. */
  registerProvider(providerId: string, initialState: ProviderLifecycleState = 'ACTIVE'): void {
    if (!this.records.has(providerId)) {
      this.records.set(providerId, {
        providerId,
        state: initialState,
        lastSuccessAt: null,
        lastFailureAt: null,
        consecutiveFailures: 0,
        totalFailures: 0,
        totalSuccesses: 0,
        lastLatencyMs: null,
        lastError: null,
        lastQuotaError: null,
        lastTimeoutAt: null,
      });
    }
  }

  /** Get the health record for a provider. */
  getHealth(providerId: string): ProviderHealthRecord | undefined {
    return this.records.get(providerId);
  }

  /** Get all health records. */
  getAllHealth(): ProviderHealthRecord[] {
    return Array.from(this.records.values());
  }

  /** Check if a provider is available (ACTIVE state only). */
  isAvailable(providerId: string): boolean {
    const record = this.records.get(providerId);
    if (!record) return false;
    return record.state === 'ACTIVE';
  }

  /** Get the current lifecycle state of a provider. */
  getState(providerId: string): ProviderLifecycleState | undefined {
    return this.records.get(providerId)?.state;
  }

  /** Set the lifecycle state of a provider. */
  setState(providerId: string, state: ProviderLifecycleState): void {
    const record = this.records.get(providerId);
    if (record) {
      record.state = state;
    }
  }

  /** Record a successful request. */
  recordSuccess(providerId: string, latencyMs: number): void {
    const record = this.records.get(providerId);
    if (!record) return;
    record.lastSuccessAt = new Date().toISOString();
    record.lastLatencyMs = latencyMs;
    record.consecutiveFailures = 0;
    record.totalSuccesses++;
    // Auto-recover from QUOTA_EXHAUSTED or OFFLINE on success
    if (record.state === 'QUOTA_EXHAUSTED' || record.state === 'OFFLINE') {
      record.state = 'ACTIVE';
    }
  }

  /** Record a failed request. */
  recordFailure(providerId: string, error: string, isTimeout = false): void {
    const record = this.records.get(providerId);
    if (!record) return;
    record.lastFailureAt = new Date().toISOString();
    record.lastError = error;
    record.consecutiveFailures++;
    record.totalFailures++;
    if (isTimeout) {
      record.lastTimeoutAt = record.lastFailureAt;
    }
  }

  /** Record a quota-related failure. */
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

  /** Attempt to recover a provider (e.g. after quota reset). */
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

  /** Get all providers in ACTIVE state. */
  getActiveProviders(): string[] {
    return Array.from(this.records.values())
      .filter((r) => r.state === 'ACTIVE')
      .map((r) => r.providerId);
  }

  /** Get a diagnostic summary for all providers. */
  getSummary(): Record<string, { state: ProviderLifecycleState; consecutiveFailures: number; lastLatencyMs: number | null }> {
    const summary: Record<string, { state: ProviderLifecycleState; consecutiveFailures: number; lastLatencyMs: number | null }> = {};
    for (const [id, record] of Array.from(this.records.entries())) {
      summary[id] = {
        state: record.state,
        consecutiveFailures: record.consecutiveFailures,
        lastLatencyMs: record.lastLatencyMs,
      };
    }
    return summary;
  }
}

// Singleton
let _healthManager: AIHealthManagerImpl | null = null;

export function getAIHealthManager(): AIHealthManagerImpl {
  if (!_healthManager) {
    _healthManager = new AIHealthManagerImpl();
  }
  return _healthManager;
}

export type AIHealthManager = AIHealthManagerImpl;
