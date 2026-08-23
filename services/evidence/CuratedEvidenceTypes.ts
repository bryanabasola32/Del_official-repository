import type { EvidencePackage } from '../research/EvidencePackage';

/*
 * Type definitions for the Curated Evidence Library (Plan B).
 *
 * These types describe the raw JSON schema that curated evidence packages
 * follow, the validation result, and the fallback policy decision.
 */

/** Raw curated evidence package as received from JSON import. */
export interface RawCuratedPackage {
  executive?: {
    name?: string;
    title?: string;
    company?: string;
    linkedin?: string;
  };
  name?: string;
  title?: string;
  company?: string;
  linkedin?: string;
  sources?: RawCuratedSource[];
  facts?: RawCuratedFact[];
  evidence?: {
    sources?: RawCuratedSource[];
    facts?: RawCuratedFact[];
  };
  metadata?: Record<string, unknown>;
}

export interface RawCuratedSource {
  id?: string;
  url?: string;
  title?: string;
  sourceName?: string;
  source_name?: string;
  sourceTier?: number;
  source_tier?: number;
  snippet?: string;
  publishedDate?: string;
  published_date?: string;
  retrievedAt?: string;
  retrieved_at?: string;
  author?: string;
  sourceType?: string;
  source_type?: string;
  category?: string;
}

export interface RawCuratedFact {
  factId?: string;
  fact_id?: string;
  category?: string;
  subject?: string;
  predicate?: string;
  value?: string;
  sourceIds?: string[];
  source_ids?: string[];
  extractedFrom?: string[];
  extracted_from?: string[];
  extractedAt?: string;
  extracted_at?: string;
  extractionMethod?: string;
  extraction_method?: string;
  confidence?: number;
  verificationStatus?: string;
  verification_status?: string;
  metadata?: Record<string, unknown>;
}

/** Result of validating a raw curated package. */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  /** Normalized executive identity extracted from the package. */
  identity: {
    name: string;
    company: string;
    title: string;
    linkedin?: string;
  };
  /** Normalized sources count. */
  sourceCount: number;
  /** Normalized facts count. */
  factCount: number;
}

/** Result of identity validation against a DEL contact. */
export interface IdentityMatchResult {
  matched: boolean;
  confidence: 'high' | 'medium' | 'low' | 'none';
  reasons: string[];
  contactId: string;
  packageName: string;
  packageCompany: string;
  contactName: string;
  contactCompany: string;
}

/** Fallback policy decision. */
export interface FallbackDecision {
  shouldEnrich: boolean;
  reasons: string[];
  liveTrustScore: number;
  liveCompleteness: number;
  liveVerifiedFacts: number;
  thresholds: {
    minimumTrustScore: number;
    minimumCompleteness: number;
    minimumVerifiedFacts: number;
  };
}

/** Configuration for the fallback policy. */
export interface FallbackPolicyConfig {
  enabled: boolean;
  minimumTrustScore: number;
  minimumCompleteness: number;
  minimumVerifiedFacts: number;
}

export const DEFAULT_FALLBACK_POLICY_CONFIG: FallbackPolicyConfig = {
  enabled: true,
  minimumTrustScore: 60,
  minimumCompleteness: 50,
  minimumVerifiedFacts: 5,
};

/** Database row shape for executive_evidence_library. */
export interface EvidenceLibraryRow {
  id: string;
  contact_id: string;
  version: number;
  status: 'draft' | 'active' | 'archived';
  evidence_package: EvidencePackage;
  evidence_trust_score: number;
  evidence_completeness: number;
  source_count: number;
  fact_count: number;
  provider: string;
  imported_at: string;
  updated_at: string;
  notes: string | null;
}

/** Metadata about Plan B usage for logging and UI display. */
export interface PlanBUsageInfo {
  used: boolean;
  libraryVersion: number | null;
  liveTrustScore: number;
  finalTrustScore: number;
  curatedSourceCount: number;
  curatedFactCount: number;
  sourcesAdded: number;
  factsAdded: number;
}
