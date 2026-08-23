import { getAIHealthManager } from './AIHealthManager';

/*
 * QuotaManager — classifies provider failures and updates health state.
 *
 * Classification contract (precedence order):
 *   1. timeout           → PROVIDER_TIMEOUT
 *   2. 401 / 403         → AUTH_FAILURE
 *   3. 503               → NOT_CONFIGURED
 *   4. 429               → QUOTA_EXHAUSTED
 *   5. other 5xx         → PROVIDER_FAILURE
 *
 * Health-state actions:
 *   QUOTA_EXHAUSTED  → state = QUOTA_EXHAUSTED (recoverable)
 *   AUTH_FAILURE     → state = OFFLINE (permanent until manual recovery)
 *   NOT_CONFIGURED   → state = OFFLINE (permanent until config fix)
 *   PROVIDER_TIMEOUT → record failure, OFFLINE after 3 consecutive
 *   PROVIDER_FAILURE → record failure, OFFLINE after 5 consecutive
 */

export type ErrorClass =
  | 'PROVIDER_TIMEOUT'
  | 'AUTH_FAILURE'
  | 'NOT_CONFIGURED'
  | 'QUOTA_EXHAUSTED'
  | 'PROVIDER_FAILURE'
  | 'UNKNOWN';

const TIMEOUT_ERROR_PATTERNS: RegExp[] = [
  /timeout/i,
  /timed?\s*out/i,
  /ETIMEDOUT/i,
  /ESOCKETTIMEDOUT/i,
  /network\s*error/i,
  /fetch\s*failed/i,
  /ECONNREFUSED/i,
  /aborted/i,
];

const QUOTA_ERROR_PATTERNS: RegExp[] = [
  /quota.*exceeded/i,
  /rate.*limit.*exceeded/i,
  /insufficient_quota/i,
  /billing.*disabled/i,
  /credit.*exhausted/i,
  /RESOURCE_EXHAUSTED/i,
  /quota_exceeded/i,
  /free_tier/i,
];

const NOT_CONFIGURED_PATTERNS: RegExp[] = [
  /not\s+configured/i,
  /API_KEY\s+not\s+configured/i,
  /API_KEY\s+is\s+missing/i,
  /missing\s+API\s+key/i,
];

export interface QuotaCheckResult {
  isQuotaError: boolean;
  isTimeoutError: boolean;
  isNotConfigured: boolean;
  isAuthFailure: boolean;
  isProviderFailure: boolean;
  matchedPattern: string | null;
  classification: ErrorClass;
}

/** Extract an HTTP status code from an error string. */
function extractHttpStatus(error: string): number | null {
  const patterns = [
    /returned\s+(\d{3})/i,
    /status[:\s]+(\d{3})/i,
    /^(\d{3})\s/,
  ];
  for (const p of patterns) {
    const match = error.match(p);
    if (match) return parseInt(match[1], 10);
  }
  return null;
}

/** Classify an error message according to the DEL failure classification contract. */
export function classifyError(error: string): QuotaCheckResult {
  const status = extractHttpStatus(error);

  // HTTP status codes take precedence over text patterns — they are more specific.
  // 2. 401/403 → AUTH_FAILURE
  if (status === 401 || status === 403) {
    return {
      isQuotaError: false, isTimeoutError: false, isNotConfigured: false,
      isAuthFailure: true, isProviderFailure: false,
      matchedPattern: String(status), classification: 'AUTH_FAILURE',
    };
  }

  // 3. 503 → NOT_CONFIGURED
  if (status === 503) {
    return {
      isQuotaError: false, isTimeoutError: false, isNotConfigured: true,
      isAuthFailure: false, isProviderFailure: false,
      matchedPattern: '503', classification: 'NOT_CONFIGURED',
    };
  }

  // 4. 429 → QUOTA_EXHAUSTED
  if (status === 429) {
    return {
      isQuotaError: true, isTimeoutError: false, isNotConfigured: false,
      isAuthFailure: false, isProviderFailure: false,
      matchedPattern: '429', classification: 'QUOTA_EXHAUSTED',
    };
  }

  // 5. other 5xx → PROVIDER_FAILURE (before timeout text check — 504 "gateway timeout" is 5xx, not PROVIDER_TIMEOUT)
  if (status !== null && status >= 500 && status < 600) {
    return {
      isQuotaError: false, isTimeoutError: false, isNotConfigured: false,
      isAuthFailure: false, isProviderFailure: true,
      matchedPattern: String(status), classification: 'PROVIDER_FAILURE',
    };
  }

  // 1. timeout → PROVIDER_TIMEOUT (text patterns, for errors without an HTTP status)
  for (const pattern of TIMEOUT_ERROR_PATTERNS) {
    if (pattern.test(error)) {
      return {
        isQuotaError: false, isTimeoutError: true, isNotConfigured: false,
        isAuthFailure: false, isProviderFailure: false,
        matchedPattern: pattern.source, classification: 'PROVIDER_TIMEOUT',
      };
    }
  }

  // Also check quota text patterns for non-429 quota errors
  for (const pattern of QUOTA_ERROR_PATTERNS) {
    if (pattern.test(error)) {
      return {
        isQuotaError: true, isTimeoutError: false, isNotConfigured: false,
        isAuthFailure: false, isProviderFailure: false,
        matchedPattern: pattern.source, classification: 'QUOTA_EXHAUSTED',
      };
    }
  }

  // Also check not-configured text patterns
  for (const pattern of NOT_CONFIGURED_PATTERNS) {
    if (pattern.test(error)) {
      return {
        isQuotaError: false, isTimeoutError: false, isNotConfigured: true,
        isAuthFailure: false, isProviderFailure: false,
        matchedPattern: pattern.source, classification: 'NOT_CONFIGURED',
      };
    }
  }

  // Unknown error
  return {
    isQuotaError: false, isTimeoutError: false, isNotConfigured: false,
    isAuthFailure: false, isProviderFailure: false,
    matchedPattern: null, classification: 'UNKNOWN',
  };
}

class QuotaManagerImpl {
  private healthManager = getAIHealthManager();

  /**
   * Inspect a provider error, classify it, and update provider health.
   * Returns true if the error was classified as a permanent/recoverable
   * state change (quota, auth, not-configured), false otherwise.
   */
  handleProviderError(providerId: string, error: string, httpStatus?: number): boolean {
    const errorStr = httpStatus ? `${httpStatus} ${error}` : error;
    const result = classifyError(errorStr);

    switch (result.classification) {
      case 'PROVIDER_TIMEOUT':
        this.healthManager.recordFailure(providerId, error, true);
        const timeoutHealth = this.healthManager.getHealth(providerId);
        if (timeoutHealth && timeoutHealth.consecutiveFailures >= 3) {
          this.healthManager.setState(providerId, 'OFFLINE');
        }
        return false;

      case 'AUTH_FAILURE':
        this.healthManager.recordFailure(providerId, error, false);
        this.healthManager.setState(providerId, 'OFFLINE');
        return true;

      case 'NOT_CONFIGURED':
        this.healthManager.recordFailure(providerId, error, false);
        this.healthManager.setState(providerId, 'OFFLINE');
        return true;

      case 'QUOTA_EXHAUSTED':
        this.healthManager.recordQuotaFailure(providerId, error);
        return true;

      case 'PROVIDER_FAILURE':
        this.healthManager.recordFailure(providerId, error, false);
        const failureHealth = this.healthManager.getHealth(providerId);
        if (failureHealth && failureHealth.consecutiveFailures >= 5) {
          this.healthManager.setState(providerId, 'OFFLINE');
        }
        return false;

      default:
        // UNKNOWN — same handling as PROVIDER_FAILURE
        this.healthManager.recordFailure(providerId, error, false);
        const unknownHealth = this.healthManager.getHealth(providerId);
        if (unknownHealth && unknownHealth.consecutiveFailures >= 5) {
          this.healthManager.setState(providerId, 'OFFLINE');
        }
        return false;
    }
  }

  /** Check if a provider is currently quota-exhausted. */
  isQuotaExhausted(providerId: string): boolean {
    return this.healthManager.getState(providerId) === 'QUOTA_EXHAUSTED';
  }

  /** Attempt to recover a provider (e.g. retry after quota reset). */
  tryRecoverProvider(providerId: string): boolean {
    return this.healthManager.tryRecover(providerId);
  }
}

// Singleton
let _quotaManager: QuotaManagerImpl | null = null;

export function getQuotaManager(): QuotaManagerImpl {
  if (!_quotaManager) {
    _quotaManager = new QuotaManagerImpl();
  }
  return _quotaManager;
}

export type QuotaManager = QuotaManagerImpl;
