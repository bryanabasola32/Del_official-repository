import type { Contact, EventItem, PersonaFact } from '@/lib/types';

/*
 * Shared types for the Del provider architecture.
 * These are the data contracts that flow between providers and the orchestrator.
 * Keeping them here ensures no provider depends on another provider's internal types.
 */

// ── Search ──────────────────────────────────────
export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  sourceName: string;
  sourceTier: 1 | 2 | 3;
  date: string;
  rawContent?: string;
}

export interface SearchOptions {
  maxResults?: number;
  siteScope?: string[];
  timeRange?: 'day' | 'week' | 'month' | 'year';
  includeContent?: boolean;
}

// ── Reader ──────────────────────────────────────
export interface PageContent {
  url: string;
  title: string;
  text: string;
  publishedDate?: string;
  author?: string;
}

// ── Crawl ───────────────────────────────────────
export interface CrawledPage {
  url: string;
  title: string;
  text: string;
  links?: string[];
  crawledAt: string;
}

export interface CrawlOptions {
  maxPages?: number;
  followLinks?: boolean;
}

// ── News ────────────────────────────────────────
export interface NewsArticle {
  title: string;
  url: string;
  snippet: string;
  source: string;
  sourceTier: 1 | 2 | 3;
  publishedDate: string;
}

// ── Enrichment ───────────────────────────────────
export interface LinkedInProfile {
  name: string;
  title: string;
  company: string;
  bio?: string;
  skills?: string[];
  experience?: { title: string; company: string; duration: string }[];
  url: string;
}

export interface CompanyInfo {
  name: string;
  industry?: string;
  description?: string;
  website?: string;
  newsroomUrl?: string;
}

// ── Memory / Vector ──────────────────────────────
export interface EmbeddingRecord {
  id: string;
  key: string;
  text: string;
  embedding: number[];
  metadata: Record<string, unknown>;
}

export interface SimilarityResult {
  id: string;
  key: string;
  text: string;
  score: number;
  metadata: Record<string, unknown>;
}

// ── AI ───────────────────────────────────────────
export interface AICompletionRequest {
  prompt: string;
  systemPrompt?: string;
  schema?: Record<string, unknown>;
  temperature?: number;
  maxTokens?: number;
}

export interface AICompletionResponse {
  content: string;
  structured?: Record<string, unknown>;
  tokensUsed?: number;
  provider: string;
  model: string;
  /** Execution metadata for the Multi-Model Intelligence Layer */
  executionTimeMs?: number;
  confidence?: number;
  warnings?: string[];
  errors?: string[];
  /** True when the response came from mock fallback rather than a real API call */
  isMock?: boolean;
  /** Future cost metadata (populated when cost tracking is enabled) */
  costMetadata?: {
    estimatedCostUsd?: number;
    inputTokens?: number;
    outputTokens?: number;
  };
}

// ── Agent-level types (used by orchestrator) ────
export type ResearchTrack = 'professional' | 'press' | 'industry';

export interface RawFinding {
  track: ResearchTrack;
  snippet: string;
  url: string;
  sourceName: string;
  sourceTier: 1 | 2 | 3;
  date: string;
}

export interface VerifiedFinding extends RawFinding {
  confidenceLevel: 'verified' | 'probable' | 'unverified';
  corroboratedBy: string[];
}

export interface SynthesizedFact {
  fieldType: PersonaFact['field_type'];
  value: string;
  confidenceLevel: PersonaFact['confidence_level'];
  reasoningNote: string;
  timeframe: string | null;
  sources: { url: string; title: string; sourceTier: 1 | 2 | 3; sourceName: string; snippet: string }[];
}

export interface SynthesizedPersona {
  facts: SynthesizedFact[];
  confidencePct: number;
  confidenceLevel: 'high' | 'medium' | 'low';
  decisionRole: 'budget-holder' | 'influencer' | 'unknown';
}

export interface ScoreResult {
  roleScore: number;
  industryScore: number;
  painpointScore: number;
  techreadinessScore: number;
  totalScore: number;
  confidenceCapped: boolean;
  reasoning: string;
}

export interface InvitationDraft {
  subject: string;
  body: string;
  citedFactIds: string[];
}

// ── Provider identifiers ─────────────────────────
export type ProviderName = 'ai' | 'search' | 'reader' | 'crawl' | 'news' | 'enrichment' | 'memory';

export interface ProviderInfo {
  name: ProviderName;
  implementation: string;
  isMock: boolean;
}
