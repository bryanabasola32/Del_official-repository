import type { Contact } from '@/lib/types';
import type { SearchResult, PageContent } from '../providers/types';
import type { ResearchCategory } from './ResearchPlan';
import type { Fact, VerificationStatus } from './Fact';

/*
 * EvidencePackage — the universal object consumed by downstream intelligence.
 *
 * This is the single source of truth for AI reasoning. The AI should never
 * receive raw webpages directly — only the structured evidence in this package.
 *
 * MP3 Part 2 upgrades: adds verified facts, conflicting facts, trust scores,
 * verification results, confidence breakdown, evidence summary, source
 * authority summary, and missing evidence summary.
 *
 * The original EvidencePackage fields are preserved for traceability.
 * New fields are additive — existing code that reads the package continues
 * to work without modification.
 */

export interface VerifiedFact {
  id: string;
  claim: string;
  confidenceLevel: 'verified' | 'probable' | 'unverified';
  sourceIds: string[];
  extractedFrom: string;
  category?: ResearchCategory;
}

export interface EvidenceSource {
  id: string;
  url: string;
  title: string;
  sourceName: string;
  sourceTier: 1 | 2 | 3;
  snippet: string;
  publishedDate?: string;
  retrievedAt: string;
  author?: string;
  sourceType: SourceType;
  /** Category that led to discovering this source */
  category?: ResearchCategory;
  /** Authority score assigned by the Source Authority Engine (0-100) */
  authorityScore?: number;
  /** Authority assessment reason */
  authorityReason?: string;
}

export type SourceType =
  | 'linkedin'
  | 'company_website'
  | 'news_article'
  | 'press_release'
  | 'blog_post'
  | 'interview'
  | 'conference_page'
  | 'award_page'
  | 'industry_report'
  | 'social_media'
  | 'other';

export interface ProfessionalHistoryEntry {
  title: string;
  company: string;
  duration?: string;
  description?: string;
  sourceIds: string[];
}

export interface NewsEntry {
  title: string;
  summary: string;
  url: string;
  publishedDate?: string;
  sourceName: string;
  sourceIds: string[];
}

export interface PublicationEntry {
  title: string;
  url: string;
  publishedDate?: string;
  sourceIds: string[];
}

export interface InterviewEntry {
  title: string;
  outlet: string;
  url: string;
  publishedDate?: string;
  sourceIds: string[];
}

export interface SpeakingEventEntry {
  title: string;
  event: string;
  url: string;
  date?: string;
  sourceIds: string[];
}

export interface AwardEntry {
  title: string;
  organization: string;
  url: string;
  date?: string;
  sourceIds: string[];
}

export interface CompanyInformation {
  name: string;
  industry?: string;
  description?: string;
  website?: string;
  size?: string;
  headquarters?: string;
  sourceIds: string[];
}

export interface ExecutiveProfile {
  name: string;
  title: string;
  company: string;
  bio?: string;
  linkedinUrl?: string;
  sourceIds: string[];
}

export interface MissingInfoEntry {
  category: ResearchCategory;
  reason: string;
  queriesAttempted: number;
}

export interface ResearchStatistics {
  totalQueriesExecuted: number;
  totalSourcesFound: number;
  totalDocumentsRead: number;
  sourcesByTier: { tier1: number; tier2: number; tier3: number };
  sourcesByCategory: Partial<Record<ResearchCategory, number>>;
  averageSnippetLength: number;
  duplicateSourcesRemoved: number;
}

// ── MP3 Part 2: Verification & Trust fields ──────────────

export interface ConfidenceBreakdown {
  /** Weight from number of supporting sources (0-100) */
  sourceCountScore: number;
  /** Weight from source authority (0-100) */
  sourceAuthorityScore: number;
  /** Weight from source diversity (0-100) */
  sourceDiversityScore: number;
  /** Weight from publication freshness (0-100) */
  freshnessScore: number;
  /** Weight from cross-source agreement (0-100) */
  agreementScore: number;
  /** Penalty from conflicts (0-100, subtracted) */
  conflictPenalty: number;
  /** Penalty from missing evidence (0-100, subtracted) */
  missingEvidencePenalty: number;
  /** Final computed trust score (0-100) */
  finalScore: number;
}

export interface VerificationResult {
  /** Overall verification status */
  status: 'pending' | 'partial' | 'verified' | 'failed';
  /** Total facts extracted */
  totalFacts: number;
  /** Facts that passed verification */
  verifiedCount: number;
  /** Facts with only a single source */
  singleSourceCount: number;
  /** Facts with multiple corroborating sources */
  corroboratedCount: number;
  /** Facts with conflicting information */
  conflictingCount: number;
  /** Facts that were rejected */
  rejectedCount: number;
  /** Facts that remain unverified */
  unverifiedCount: number;
}

export interface VerificationWarning {
  factId: string;
  warning: string;
  severity: 'info' | 'warning' | 'error';
}

export interface SourceAuthoritySummary {
  /** Average authority score across all sources */
  averageAuthority: number;
  /** Number of tier 1 sources */
  tier1Count: number;
  /** Number of tier 2 sources */
  tier2Count: number;
  /** Number of tier 3 sources */
  tier3Count: number;
  /** Highest authority source */
  highestAuthoritySource?: { sourceId: string; score: number; name: string };
  /** Authority distribution by source type */
  authorityByType: Partial<Record<SourceType, number>>;
}

export interface EvidenceSummary {
  /** Total verified facts available for AI consumption */
  verifiedFactCount: number;
  /** Total sources with authority assessments */
  assessedSourceCount: number;
  /** Overall research completeness (0-100) */
  completenessScore: number;
  /** Summary text for the AI prompt */
  summary: string;
}

export interface MissingEvidenceSummary {
  /** Categories with no evidence found */
  missingCategories: ResearchCategory[];
  /** Categories with insufficient evidence (only 1 source) */
  insufficientCategories: ResearchCategory[];
  /** Total missing fields from the original plan */
  totalMissing: number;
  /** Recommendations for additional research */
  recommendations: string[];
}

export interface ConflictRecord {
  /** The fact that has conflicting information */
  factId: string;
  /** The subject of the conflicting fact */
  subject: string;
  /** The predicate being conflicted */
  predicate: string;
  /** The values that disagree */
  conflictingValues: { value: string; sourceIds: string[] }[];
  /** Severity of the conflict */
  severity: 'minor' | 'major';
}

export interface EvidencePackage {
  contact: Pick<Contact, 'id' | 'name' | 'title' | 'company'>;
  executiveProfile: ExecutiveProfile;
  company: CompanyInformation;
  professionalHistory: ProfessionalHistoryEntry[];
  news: NewsEntry[];
  publications: PublicationEntry[];
  interviews: InterviewEntry[];
  speakingEvents: SpeakingEventEntry[];
  awards: AwardEntry[];
  searchResults: SearchResult[];
  documents: PageContent[];
  verifiedFacts: VerifiedFact[];
  sources: EvidenceSource[];
  confidence: number;
  verification: {
    status: 'pending' | 'partial' | 'verified' | 'failed';
    verifiedCount: number;
    unverifiedCount: number;
    contradictoryCount: number;
  };
  missingInfo: MissingInfoEntry[];
  metadata: {
    createdAt: string;
    updatedAt: string;
    agentsRun: string[];
    searchQueryCount: number;
    documentCount: number;
    cacheHit: boolean;
    planId?: string;
  };
  statistics: ResearchStatistics;

  // ── MP3 Part 2: Verification & Trust fields ──
  /** All extracted facts (before and after verification) */
  facts: Fact[];
  /** Facts that passed verification */
  verifiedFactsList: Fact[];
  /** Facts with conflicting information */
  conflictingFacts: Fact[];
  /** Detailed conflict records */
  conflicts: ConflictRecord[];
  /** Overall trust score (0-100) */
  trustScore: number;
  /** Per-fact confidence breakdown */
  confidenceBreakdown: Map<string, ConfidenceBreakdown>;
  /** Verification results summary */
  verificationResults: VerificationResult;
  /** Verification warnings */
  verificationWarnings: VerificationWarning[];
  /** Source authority summary */
  sourceAuthoritySummary: SourceAuthoritySummary;
  /** Evidence summary for AI consumption */
  evidenceSummary: EvidenceSummary;
  /** Missing evidence summary */
  missingEvidenceSummary: MissingEvidenceSummary;
  /** Whether this package has been through the verification pipeline */
  isVerified: boolean;
}

export function createEvidencePackage(
  contact: Pick<Contact, 'id' | 'name' | 'title' | 'company'>,
): EvidencePackage {
  const now = new Date().toISOString();
  return {
    contact,
    executiveProfile: {
      name: contact.name,
      title: contact.title || '',
      company: contact.company,
      sourceIds: [],
    },
    company: {
      name: contact.company,
      sourceIds: [],
    },
    professionalHistory: [],
    news: [],
    publications: [],
    interviews: [],
    speakingEvents: [],
    awards: [],
    searchResults: [],
    documents: [],
    verifiedFacts: [],
    sources: [],
    confidence: 0,
    verification: {
      status: 'pending',
      verifiedCount: 0,
      unverifiedCount: 0,
      contradictoryCount: 0,
    },
    missingInfo: [],
    metadata: {
      createdAt: now,
      updatedAt: now,
      agentsRun: [],
      searchQueryCount: 0,
      documentCount: 0,
      cacheHit: false,
    },
    statistics: {
      totalQueriesExecuted: 0,
      totalSourcesFound: 0,
      totalDocumentsRead: 0,
      sourcesByTier: { tier1: 0, tier2: 0, tier3: 0 },
      sourcesByCategory: {},
      averageSnippetLength: 0,
      duplicateSourcesRemoved: 0,
    },

    // MP3 Part 2 defaults
    facts: [],
    verifiedFactsList: [],
    conflictingFacts: [],
    conflicts: [],
    trustScore: 0,
    confidenceBreakdown: new Map(),
    verificationResults: {
      status: 'pending',
      totalFacts: 0,
      verifiedCount: 0,
      singleSourceCount: 0,
      corroboratedCount: 0,
      conflictingCount: 0,
      rejectedCount: 0,
      unverifiedCount: 0,
    },
    verificationWarnings: [],
    sourceAuthoritySummary: {
      averageAuthority: 0,
      tier1Count: 0,
      tier2Count: 0,
      tier3Count: 0,
      authorityByType: {},
    },
    evidenceSummary: {
      verifiedFactCount: 0,
      assessedSourceCount: 0,
      completenessScore: 0,
      summary: '',
    },
    missingEvidenceSummary: {
      missingCategories: [],
      insufficientCategories: [],
      totalMissing: 0,
      recommendations: [],
    },
    isVerified: false,
  };
}
