import { getResearchHealthManager } from './ResearchHealthManager';

/*
 * ResearchQuotaManager — detects quota and rate-limit failures from
 * research provider API responses.
 *
 * Mirrors the AI QuotaManager pattern. Inspects error messages and HTTP
 * status codes. When quota-related failures are detected, marks the
 * provider as QUOTA_EXHAUSTED via the Research Health Manager so
 * factories skip it and fall back to mock.
 */

const QUOTA_ERROR_PATTERNS: RegExp[] = [
  /429/i,
  /quota.*exceeded/i,
  /rate.*limit.*exceeded/i,
  /insufficient_quota/i,
  /billing.*disabled/i,
  /credit.*exhausted/i,
  /RESOURCE_EXHAUSTED/i,
  /quota_exceeded/i,
  /free_tier/i,
  /api.*key.*invalid/i,
  /api.*key.*expired/i,
  /unauthorized/i,
];

const TIMEOUT_ERROR_PATTERNS: RegExp[] = [
  /timeout/i,
  /timed?\s*out/i,
  /ETIMEDOUT/i,
  /ESOCKETTIMEDOUT/i,
  /network\s*error/i,
  /fetch\s*failed/i,
  /ECONNREFUSED/i,
  /abort/i,
];

export interface ResearchQuotaCheckResult {
  isQuotaError: boolean;
  isTimeoutError: boolean;
  isKeyError: boolean;
  matchedPattern: string | null;
}

export function classifyResearchError(error: string): ResearchQuotaCheckResult {
  for (const pattern of QUOTA_ERROR_PATTERNS) {
    if (pattern.test(error)) {
      const isKey = /api.*key|unauthorized/i.test(error);
      return { isQuotaError: true, isTimeoutError: false, isKeyError: isKey, matchedPattern: pattern.source };
    }
  }
  for (const pattern of TIMEOUT_ERROR_PATTERNS) {
    if (pattern.test(error)) {
      return { isQuotaError: false, isTimeoutError: true, isKeyError: false, matchedPattern: pattern.source };
    }
  }
  return { isQuotaError: false, isTimeoutError: false, isKeyError: false, matchedPattern: null };
}

class ResearchQuotaManagerImpl {
  private healthManager = getResearchHealthManager();

  handleProviderError(providerId: string, error: string, httpStatus?: number): boolean {
    const errorStr = httpStatus ? `${httpStatus} ${error}` : error;
    const classification = classifyResearchError(errorStr);

    if (classification.isQuotaError) {
      this.healthManager.recordQuotaFailure(providerId, error);
      return true;
    }

    if (classification.isTimeoutError) {
      this.healthManager.recordFailure(providerId, error, true);
      const record = this.healthManager.getHealth(providerId);
      if (record && record.consecutiveFailures >= 3) {
        this.healthManager.setState(providerId, 'OFFLINE');
      }
      return false;
    }

    this.healthManager.recordFailure(providerId, error, false);
    const record = this.healthManager.getHealth(providerId);
    if (record && record.consecutiveFailures >= 5) {
      this.healthManager.setState(providerId, 'OFFLINE');
    }
    return false;
  }

  isQuotaExhausted(providerId: string): boolean {
    return this.healthManager.getState(providerId) === 'QUOTA_EXHAUSTED';
  }

  tryRecoverProvider(providerId: string): boolean {
    return this.healthManager.tryRecover(providerId);
  }
}

let _researchQuotaManager: ResearchQuotaManagerImpl | null = null;

export function getResearchQuotaManager(): ResearchQuotaManagerImpl {
  if (!_researchQuotaManager) {
    _researchQuotaManager = new ResearchQuotaManagerImpl();
  }
  return _researchQuotaManager;
}

export type ResearchQuotaManager = ResearchQuotaManagerImpl;
