import type { ExecutiveIntelligenceReport } from '../intelligence/IntelligenceTypes';

/*
 * RelationshipTypes — strong TypeScript interfaces for MP5.
 *
 * Every recommendation object includes:
 *   confidence, reasoning, citations (factIds + sourceIds)
 *
 * No "any" is used anywhere in this module.
 * Every output is derived from ExecutiveIntelligenceReport (MP4).
 */

// ── Citation Helper ────────────────────────────────

export interface RelationshipCitation {
  factIds: string[];
  sourceIds: string[];
}

// ── Relationship Profile ──────────────────────────

export type RelationshipStage =
  | 'Unknown'
  | 'First Contact'
  | 'Initial Connection'
  | 'Developing'
  | 'Established'
  | 'Strategic';

export type EngagementReadiness =
  | 'Not Ready'
  | 'Tentative'
  | 'Ready'
  | 'Highly Ready'
  | 'Unknown';

export type InteractionDepth =
  | 'Surface'
  | 'Moderate'
  | 'Deep'
  | 'Unknown';

export type NetworkingPotential =
  | 'Low'
  | 'Moderate'
  | 'High'
  | 'Unknown';

export interface RelationshipProfile {
  stage: RelationshipStage;
  stageConfidence: number;
  stageReasoning: string;
  engagementReadiness: EngagementReadiness;
  readinessConfidence: number;
  readinessReasoning: string;
  preferredInteractionDepth: InteractionDepth;
  depthConfidence: number;
  depthReasoning: string;
  networkingPotential: NetworkingPotential;
  networkingConfidence: number;
  networkingReasoning: string;
  citations: RelationshipCitation;
}

// ── Engagement Strategy ────────────────────────────

export type EngagementStrategyType =
  | 'First Meeting'
  | 'Conference Networking'
  | 'VIP Engagement'
  | 'Executive Roundtable'
  | 'Speaker Interaction'
  | 'Sponsor Conversation'
  | 'Investor Discussion'
  | 'Corporate Partnership';

export interface EngagementStrategy {
  type: EngagementStrategyType;
  objectives: string[];
  reasoning: string;
  confidence: number;
  citations: RelationshipCitation;
}

// ── Conversation Starter ───────────────────────────

export type ConversationCategory =
  | 'Industry Trends'
  | 'Technology Interests'
  | 'Leadership Topics'
  | 'Innovation Initiatives'
  | 'Business Priorities'
  | 'Conference Themes'
  | 'Mutual Interests'
  | 'Open-ended Questions';

export interface ConversationStarter {
  category: ConversationCategory;
  topic: string;
  suggestedQuestion: string;
  reasoning: string;
  confidence: number;
  citations: RelationshipCitation;
}

// ── Rapport ───────────────────────────────────────

export type CompatibilityLevel =
  | 'Low'
  | 'Moderate'
  | 'High'
  | 'Unknown';

export interface RapportAssessment {
  communicationCompatibility: CompatibilityLevel;
  communicationScore: number;
  communicationReasoning: string;
  engagementCompatibility: CompatibilityLevel;
  engagementScore: number;
  engagementReasoning: string;
  networkingCompatibility: CompatibilityLevel;
  networkingScore: number;
  networkingReasoning: string;
  expectedResponsiveness: CompatibilityLevel;
  responsivenessScore: number;
  responsivenessReasoning: string;
  overallRapportScore: number;
  citations: RelationshipCitation;
}

// ── Interest Alignment ─────────────────────────────

export type AlignmentDimension =
  | 'Executive ↔ Business Interests'
  | 'Business Interests ↔ Strategic Priorities'
  | 'Strategic Priorities ↔ Event Themes'
  | 'Executive ↔ Event Themes';

export interface AlignmentObject {
  dimension: AlignmentDimension;
  alignmentScore: number;
  reasoning: string;
  matchedItems: string[];
  citations: RelationshipCitation;
}

// ── Relationship Risk ──────────────────────────────

export type RelationshipRiskType =
  | 'weak_evidence'
  | 'sensitive_topics'
  | 'contradictory_interests'
  | 'low_confidence_recommendations'
  | 'bias_risk'
  | 'evidence_gap';

export type RelationshipRiskSeverity = 'low' | 'medium' | 'high';

export interface RelationshipRisk {
  type: RelationshipRiskType;
  description: string;
  severity: RelationshipRiskSeverity;
  reason: string;
  supportingEvidence: string;
  citations: RelationshipCitation;
}

// ── Follow-up ──────────────────────────────────────

export type FollowUpPhase =
  | 'Before Event'
  | 'During Event'
  | 'Immediately After'
  | 'One Week Later'
  | 'Long-term Relationship';

export interface FollowUpRecommendation {
  phase: FollowUpPhase;
  action: string;
  reasoning: string;
  confidence: number;
  citations: RelationshipCitation;
}

// ── Relationship Scoring ───────────────────────────

export interface RelationshipScores {
  relationshipReadiness: number;
  readinessReasoning: string;
  networkingValue: number;
  networkingReasoning: string;
  conversationQuality: number;
  conversationReasoning: string;
  expectedEngagement: number;
  engagementReasoning: string;
  followUpPotential: number;
  followUpReasoning: string;
  overallScore: number;
  overallReasoning: string;
  formula: string;
  citations: RelationshipCitation;
}

// ── Confidence Summary ────────────────────────────

export interface RelationshipConfidenceSummary {
  overallConfidence: number;
  profileConfidence: number;
  strategyConfidence: number;
  conversationConfidence: number;
  rapportConfidence: number;
  alignmentConfidence: number;
  riskConfidence: number;
  followUpConfidence: number;
  scoringConfidence: number;
  level: 'high' | 'medium' | 'low';
  reasoning: string;
}

// ── Explainability ─────────────────────────────────

export interface RelationshipExplainability {
  totalRecommendations: number;
  groundedRecommendations: number;
  ungroundedRecommendations: number;
  groundingRate: number;
  citationCoverage: number;
  explanation: string;
}

// ── Metadata ───────────────────────────────────────

export interface RelationshipMetadata {
  generatedAt: string;
  pipelineDurationMs: number;
  modules: string[];
  recommendationCount: number;
  riskCount: number;
  alignmentCount: number;
  followUpCount: number;
  sourceReportConfidence: number;
}

// ── Relationship Intelligence Report ───────────────

export interface RelationshipIntelligenceReport {
  contact: { id: string; name: string; title: string; company: string };

  executiveSummary: {
    summary: string;
    keyFindings: string[];
    overallConfidence: number;
    relationshipStage: RelationshipStage;
  };

  relationshipProfile: RelationshipProfile;
  engagementStrategies: EngagementStrategy[];
  conversationStarters: ConversationStarter[];
  rapport: RapportAssessment;
  alignmentAnalysis: AlignmentObject[];
  risks: RelationshipRisk[];
  followUpPlan: FollowUpRecommendation[];
  scores: RelationshipScores;
  confidenceSummary: RelationshipConfidenceSummary;
  recommendations: {
    value: string;
    reasoning: string;
    confidence: number;
    citations: RelationshipCitation;
  }[];
  citations: {
    factIds: string[];
    sourceIds: string[];
    sources: { sourceId: string; sourceName: string; url: string; authorityScore: number; tier: number }[];
  };
  explainability: RelationshipExplainability;
  metadata: RelationshipMetadata;
}

// ── Relationship Log Entry ─────────────────────────

export interface RelationshipLogEntry {
  module: string;
  latencyMs: number;
  confidence: number;
  recommendationCount: number;
  warnings: string[];
  timestamp: string;
}

// ── Input type alias ──────────────────────────────

export type SourceReport = ExecutiveIntelligenceReport;
