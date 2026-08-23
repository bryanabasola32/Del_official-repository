export { CuratedEvidenceLibrary, getCuratedEvidenceLibrary } from './CuratedEvidenceLibrary';
export { CuratedEvidenceAdapter } from './CuratedEvidenceAdapter';
export { CuratedEvidenceFallbackPolicy, getFallbackPolicy } from './CuratedEvidenceFallbackPolicy';
export { PlanBEnricher, getPlanBEnricher } from './PlanBEnricher';
export type { PlanBResult } from './PlanBEnricher';
export type {
  RawCuratedPackage,
  RawCuratedSource,
  RawCuratedFact,
  ValidationResult,
  IdentityMatchResult,
  FallbackDecision,
  FallbackPolicyConfig,
  EvidenceLibraryRow,
  PlanBUsageInfo,
} from './CuratedEvidenceTypes';
export { DEFAULT_FALLBACK_POLICY_CONFIG } from './CuratedEvidenceTypes';
