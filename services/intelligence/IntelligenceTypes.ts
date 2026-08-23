import type { EvidenceContext, ContextFact, ContextSourceRef, ContextConflict } from '../research/EvidenceContextBuilder';
import type { ConfidenceAssessment } from '../research/ConfidencePropagator';
import type { FactCategory, VerificationStatus } from '../research/Fact';

/*
 * IntelligenceTypes — strong TypeScript interfaces for MP4.
 *
 * Every inference object includes:
 *   value, confidence, reasoning, factIds, sourceIds, trustScore
 *
 * No "any" is used anywhere in this module.
 * Every inference is grounded in EvidenceContext.
 */

// ── Core Inference Object ─────────────────────────

export interface Inference {
  /** The inferred value (e.g. "Transformational") */
  value: string;
  /** Confidence score (0-100) */
  confidence: number;
  /** Human-readable explanation of WHY this inference exists */
  reasoning: string;
  /** Fact IDs from EvidenceContext that support this inference */
  factIds: string[];
  /** Source IDs from EvidenceContext that support this inference */
  sourceIds: string[];
  /** Trust score from the evidence context at time of inference */
  trustScore: number;
}

// ── Persona Attributes ────────────────────────────

export type LeadershipStyle =
  | 'Transformational'
  | 'Transactional'
  | 'Servant'
  | 'Autocratic'
  | 'Democratic'
  | 'Laissez-faire'
  | 'Strategic'
  | 'Cross-functional'
  | 'Unknown';

export type CommunicationStyle =
  | 'Direct'
  | 'Analytical'
  | 'Visionary'
  | 'Collaborative'
  | 'Data-driven'
  | 'Storytelling'
  | 'Diplomatic'
  | 'Unknown';

export type DecisionStyle =
  | 'Data-driven'
  | 'Consensus-oriented'
  | 'Decisive'
  | 'Analytical'
  | 'Intuitive'
  | 'Collaborative'
  | 'Risk-aware'
  | 'Unknown';

export type RiskAppetite =
  | 'High'
  | 'Moderate'
  | 'Low'
  | 'Unknown';

export type InnovationOrientation =
  | 'Pioneer'
  | 'Early Adopter'
  | 'Pragmatic'
  | 'Conservative'
  | 'Unknown';

export type InfluenceLevel =
  | 'Industry Leader'
  | 'Sector Influencer'
  | 'Company Leader'
  | 'Emerging Voice'
  | 'Unknown';

export type NetworkingStyle =
  | 'Relationship Builder'
  | 'Strategic Networker'
  | 'Community Builder'
  | 'Reserved'
  | 'Unknown';

export type NegotiationStyle =
  | 'Win-win'
  | 'Competitive'
  | 'Collaborative'
  | 'Principled'
  | 'Unknown';

export interface ExecutivePersona {
  leadershipStyle: Inference;
  communicationStyle: Inference;
  decisionStyle: Inference;
  riskAppetite: Inference;
  innovationOrientation: Inference;
  strategicPriorities: Inference[];
  businessInterests: Inference[];
  technologyInterest: Inference;
  industryFocus: Inference;
  influenceLevel: Inference;
  networkingStyle: Inference;
  negotiationStyle: Inference;
}

// ── Reasoning ─────────────────────────────────────

export interface ReasonedInference extends Inference {
  /** The attribute this inference is about (e.g. "leadership_style") */
  attribute: string;
  /** Category of the inference */
  category: 'persona' | 'archetype' | 'opportunity' | 'risk' | 'timeline' | 'confidence';
}

export interface ReasoningChain {
  /** The attribute being reasoned about */
  attribute: string;
  /** The inferred value */
  value: string;
  /** WHY this inference exists — the reasoning chain */
  reasoning: string;
  /** Confidence (0-100) */
  confidence: number;
  /** Supporting fact IDs */
  factIds: string[];
  /** Supporting source IDs */
  sourceIds: string[];
  /** Trust score from evidence */
  trustScore: number;
  /** The individual reasoning steps */
  reasoningSteps: ReasoningStep[];
}

export interface ReasoningStep {
  /** What was observed in the evidence */
  observation: string;
  /** Which facts support this observation */
  factIds: string[];
  /** What was inferred from this observation */
  inference: string;
}

// ── Archetype ─────────────────────────────────────

export type ExecutiveArchetype =
  | 'Digital Transformer'
  | 'Innovation Leader'
  | 'Operational Optimizer'
  | 'Financial Strategist'
  | 'Growth Executive'
  | 'Technology Visionary'
  | 'Customer Champion'
  | 'Sustainability Advocate'
  | 'Unknown';

export interface ArchetypeClassification {
  /** The primary archetype */
  archetype: ExecutiveArchetype;
  /** Confidence (0-100) */
  confidence: number;
  /** WHY this archetype was chosen */
  reasoning: string;
  /** Supporting fact IDs */
  factIds: string[];
  /** Supporting source IDs */
  sourceIds: string[];
  /** Trust score */
  trustScore: number;
  /** All archetype scores (for ranking) */
  archetypeScores: { archetype: ExecutiveArchetype; score: number }[];
}

// ── Opportunity ───────────────────────────────────

export type OpportunityType =
  | 'technology_adoption'
  | 'digital_transformation'
  | 'ai_adoption'
  | 'cloud'
  | 'cybersecurity'
  | 'partnership'
  | 'innovation'
  | 'esg'
  | 'investment'
  | 'expansion'
  | 'recruitment';

export interface ExecutiveOpportunity {
  /** Type of opportunity */
  type: OpportunityType;
  /** Description of the opportunity */
  value: string;
  /** Confidence (0-100) */
  confidence: number;
  /** WHY this opportunity was identified */
  reasoning: string;
  /** Supporting fact IDs */
  factIds: string[];
  /** Supporting source IDs */
  sourceIds: string[];
  /** Trust score */
  trustScore: number;
  /** Suggested event themes that align */
  suggestedEventThemes: string[];
}

// ── Risk ──────────────────────────────────────────

export type RiskType =
  | 'missing_evidence'
  | 'weak_evidence'
  | 'contradiction'
  | 'low_confidence'
  | 'unknown_attribute'
  | 'bias_risk'
  | 'inference_risk';

export type RiskSeverity = 'low' | 'medium' | 'high';

export interface ExecutiveRisk {
  /** Type of risk */
  type: RiskType;
  /** Description of the risk */
  value: string;
  /** Severity */
  severity: RiskSeverity;
  /** WHY this risk was identified */
  reasoning: string;
  /** Confidence in the risk assessment (0-100) */
  confidence: number;
  /** Related fact IDs (if any) */
  factIds: string[];
  /** Related source IDs (if any) */
  sourceIds: string[];
  /** Trust score */
  trustScore: number;
}

// ── Confidence ────────────────────────────────────

export interface PersonaConfidenceSummary {
  leadershipStyle: number;
  decisionStyle: number;
  innovation: number;
  communication: number;
  strategicVision: number;
  networking: number;
  overall: number;
  /** Breakdown of how overall confidence was computed */
  breakdown: {
    evidenceConfidence: number;
    verificationConfidence: number;
    sourceDiversity: number;
    trustScore: number;
    evidenceCompleteness: number;
  };
  /** Confidence level bucket */
  level: 'high' | 'medium' | 'low';
  /** Explanation */
  reasoning: string;
}

// ── Timeline ─────────────────────────────────────

export type TimelineEventType =
  | 'career'
  | 'promotion'
  | 'award'
  | 'speaking'
  | 'news'
  | 'investment'
  | 'board_seat'
  | 'education'
  | 'publication'
  | 'company_event';

export interface TimelineEntry {
  /** Type of event */
  type: TimelineEventType;
  /** Title of the event */
  title: string;
  /** Description */
  description: string;
  /** ISO date string (if known) */
  date: string | null;
  /** Sortable date (for ordering; null sorts last) */
  sortDate: number | null;
  /** Supporting fact IDs */
  factIds: string[];
  /** Supporting source IDs */
  sourceIds: string[];
  /** Confidence (0-100) */
  confidence: number;
}

// ── Executive Intelligence Report ─────────────────

export interface ExecutiveIntelligenceReport {
  /** Contact this report is about */
  contact: { id: string; name: string; title: string; company: string };

  // ── Executive Summary ──
  executiveSummary: {
    summary: string;
    keyFindings: string[];
    overallConfidence: number;
    archetype: ExecutiveArchetype;
  };

  // ── Persona ──
  persona: ExecutivePersona;

  // ── Reasoning ──
  reasoning: ReasoningChain[];

  // ── Archetype ──
  archetypeClassification: ArchetypeClassification;

  // ── Analysis Sections ──
  leadershipAnalysis: {
    summary: string;
    style: Inference;
    indicators: string[];
  };

  decisionAnalysis: {
    summary: string;
    style: Inference;
    indicators: string[];
  };

  communicationAnalysis: {
    summary: string;
    style: Inference;
    indicators: string[];
  };

  strategicPriorities: Inference[];
  businessInterests: Inference[];
  influence: Inference;

  // ── Opportunities & Risks ──
  opportunities: ExecutiveOpportunity[];
  risks: ExecutiveRisk[];

  // ── Timeline ──
  timeline: TimelineEntry[];

  // ── Confidence ──
  confidenceSummary: PersonaConfidenceSummary;

  // ── Evidence Summary ──
  evidenceSummary: {
    totalSources: number;
    totalFacts: number;
    verifiedFacts: number;
    conflictingFacts: number;
    trustScore: number;
    completeness: number;
    averageAuthority: number;
    tier1Count: number;
    tier2Count: number;
    tier3Count: number;
  };

  // ── Recommendations ──
  recommendations: {
    value: string;
    reasoning: string;
    confidence: number;
    factIds: string[];
  }[];

  // ── Citations ──
  citations: {
    factIds: string[];
    sourceIds: string[];
    sources: { sourceId: string; sourceName: string; url: string; authorityScore: number; tier: number }[];
  };

  // ── Explainability ──
  explainability: {
    totalInferences: number;
    groundedInferences: number;
    ungroundedInferences: number;
    groundingRate: number;
    reasoningCoverage: number;
    citationCoverage: number;
    explanation: string;
  };

  // ── Metadata ──
  metadata: {
    generatedAt: string;
    pipelineDurationMs: number;
    modules: string[];
    inferenceCount: number;
    reasoningCount: number;
    riskCount: number;
    opportunityCount: number;
  };
}

// ── Intelligence Log Entry ────────────────────────

export interface IntelligenceLogEntry {
  module: string;
  latencyMs: number;
  confidence: number;
  reasoningCount: number;
  inferenceCount: number;
  riskCount: number;
  opportunityCount: number;
  timestamp: string;
}

// ── Re-exports for convenience ─────────────────────

export type {
  EvidenceContext,
  ContextFact,
  ContextSourceRef,
  ContextConflict,
  ConfidenceAssessment,
  FactCategory,
  VerificationStatus,
};
