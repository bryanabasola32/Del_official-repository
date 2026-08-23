import type { ExecutiveIntelligenceReport } from '../intelligence/IntelligenceTypes';
import type { RelationshipIntelligenceReport } from '../relationship/RelationshipTypes';

/*
 * DecisionTypes — strong TypeScript interfaces for MP6.
 *
 * Every recommendation object includes:
 *   confidence, reasoning, citations (factIds + sourceIds), formula
 *
 * No "any" is used anywhere in this module.
 * Every output is derived from ExecutiveIntelligenceReport (MP4),
 * RelationshipIntelligenceReport (MP5), EventContext, and OrganizationObjectives.
 */

// ── Event Context ─────────────────────────────────

export interface EventContext {
  id: string;
  eventName: string;
  theme: string | null;
  primaryTheme: string | null;
  description: string | null;
  targetIndustries: string[];
  targetAudience: string | null;
  eventGoals: string[];
  date: string | null;
  venue: string | null;
}

// ── Organization Objectives ───────────────────────

export interface OrganizationObjectives {
  strategicGoals: string[];
  targetIndustries: string[];
  desiredOpportunities: OpportunityRole[];
  eventGoals: string[];
  riskTolerance: 'low' | 'medium' | 'high';
}

// ── Opportunity Roles ─────────────────────────────

export type OpportunityRole =
  | 'speaker'
  | 'sponsor'
  | 'VIP guest'
  | 'panelist'
  | 'mentor'
  | 'partner'
  | 'investor'
  | 'advisor';

// ── Citation ──────────────────────────────────────

export interface DecisionCitation {
  factIds: string[];
  sourceIds: string[];
}

// ── Decision Score ────────────────────────────────

export interface DecisionScore {
  score: number;
  confidence: number;
  reasoning: string;
  formula: string;
  citations: DecisionCitation;
}

// ── Event Fit Analysis ────────────────────────────

export interface EventFitDimension {
  dimension: string;
  score: number;
  confidence: number;
  reasoning: string;
  factIds: string[];
  sourceIds: string[];
}

export interface EventFitAnalysis {
  overallFitScore: number;
  confidence: number;
  reasoning: string;
  formula: string;
  dimensions: EventFitDimension[];
  citations: DecisionCitation;
}

// ── Invite Recommendation ─────────────────────────

export type InviteDecision =
  | 'Invite Immediately'
  | 'Invite'
  | 'Invite Later'
  | 'Observe'
  | 'Do Not Invite'
  | 'Unknown';

export interface InviteRecommendation {
  decision: InviteDecision;
  confidence: number;
  reasoning: string;
  factIds: string[];
  sourceIds: string[];
  conditions: string[];
}

// ── Priority Ranking ──────────────────────────────

export type PriorityTier = 'Tier 1' | 'Tier 2' | 'Tier 3';

export interface PriorityRanking {
  tier: PriorityTier;
  rank: number;
  score: number;
  confidence: number;
  reasoning: string;
  formula: string;
  factIds: string[];
  sourceIds: string[];
}

// ── Strategic Benefit ─────────────────────────────

export interface StrategicBenefit {
  benefit: string;
  alignment: string;
  confidence: number;
  reasoning: string;
  factIds: string[];
  sourceIds: string[];
}

// ── Decision Risk ─────────────────────────────────

export type DecisionRiskType =
  | 'poor_invite_timing'
  | 'low_confidence_recommendation'
  | 'weak_evidence'
  | 'organizational_mismatch'
  | 'event_mismatch'
  | 'uncertain_priorities'
  | 'strategic_conflict';

export type DecisionRiskSeverity = 'low' | 'medium' | 'high';

export interface DecisionRisk {
  type: DecisionRiskType;
  description: string;
  severity: DecisionRiskSeverity;
  confidence: number;
  reasoning: string;
  factIds: string[];
  sourceIds: string[];
}

// ── Opportunity Match ─────────────────────────────

export interface OpportunityMatch {
  role: OpportunityRole;
  matchScore: number;
  confidence: number;
  reasoning: string;
  factIds: string[];
  sourceIds: string[];
}

// ── Confidence Summary ────────────────────────────

export interface DecisionConfidenceSummary {
  overallConfidence: number;
  eventFitConfidence: number;
  relationshipScoreConfidence: number;
  executiveConfidence: number;
  evidenceConfidence: number;
  opportunityMatchConfidence: number;
  riskPenalty: number;
  level: 'high' | 'medium' | 'low';
  reasoning: string;
}

// ── Decision Reasoning ────────────────────────────

export interface ReasoningChainStep {
  observation: string;
  evidence: string;
  analysis: string;
  decision: string;
  factIds: string[];
  sourceIds: string[];
}

export interface DecisionReasoning {
  recommendation: string;
  chain: ReasoningChainStep[];
  summary: string;
  confidence: number;
}

// ── Decision Recommendation ───────────────────────

export interface DecisionRecommendation {
  action: string;
  priority: 'high' | 'medium' | 'low';
  confidence: number;
  reasoning: string;
  factIds: string[];
  sourceIds: string[];
}

// ── Explainability ────────────────────────────────

export interface DecisionExplainability {
  totalRecommendations: number;
  groundedRecommendations: number;
  ungroundedRecommendations: number;
  groundingRate: number;
  citationCoverage: number;
  explanation: string;
}

// ── Metadata ──────────────────────────────────────

export interface DecisionMetadata {
  generatedAt: string;
  pipelineDurationMs: number;
  modules: string[];
  recommendationCount: number;
  riskCount: number;
  opportunityCount: number;
  sourceReportConfidence: number;
  relationshipReportConfidence: number;
}

// ── Strategic Decision Report ─────────────────────

export interface StrategicDecisionReport {
  contact: { id: string; name: string; title: string; company: string };
  event: { id: string; name: string; theme: string | null };

  executiveSummary: {
    summary: string;
    keyFindings: string[];
    overallConfidence: number;
    inviteDecision: InviteDecision;
    priorityTier: PriorityTier;
  };

  decisionSummary: {
    primaryRecommendation: string;
    confidence: number;
    reasoning: string;
  };

  inviteRecommendation: InviteRecommendation;
  priorityRanking: PriorityRanking;
  eventFit: EventFitAnalysis;
  opportunityAnalysis: OpportunityMatch[];
  strategicBenefits: StrategicBenefit[];
  decisionRisks: DecisionRisk[];
  confidenceSummary: DecisionConfidenceSummary;
  reasoning: DecisionReasoning;
  recommendations: DecisionRecommendation[];
  citations: {
    factIds: string[];
    sourceIds: string[];
    sources: { sourceId: string; sourceName: string; url: string; authorityScore: number; tier: number }[];
  };
  explainability: DecisionExplainability;
  metadata: DecisionMetadata;
}

// ── Decision Log Entry ────────────────────────────

export interface DecisionLogEntry {
  module: string;
  latencyMs: number;
  confidence: number;
  recommendationCount: number;
  warnings: string[];
  timestamp: string;
}

// ── Input type aliases ────────────────────────────

export type ExecutiveReport = ExecutiveIntelligenceReport;
export type RelationshipReport = RelationshipIntelligenceReport;
