// ── MP6: Strategic Decision Intelligence Engine ───────────
//
// Barrel exports for the decision module.
// All MP6 engines consume ExecutiveIntelligenceReport (MP4),
// RelationshipIntelligenceReport (MP5), EventContext, and OrganizationObjectives.
// No MP1–MP5 component is modified.

export { DecisionCoordinator } from './DecisionCoordinator';
export { getDecisionCoordinator, generateStrategicDecisionReport } from './DecisionCoordinator';
export { EventFitEngine } from './EventFitEngine';
export { InviteRecommendationEngine } from './InviteRecommendationEngine';
export { PriorityRankingEngine } from './PriorityRankingEngine';
export { OpportunityMatchingEngine } from './OpportunityMatchingEngine';
export { DecisionRiskEngine } from './DecisionRiskEngine';
export { DecisionConfidenceEngine } from './DecisionConfidenceEngine';
export { DecisionReasoningEngine } from './DecisionReasoningEngine';
export { DecisionReportBuilder } from './DecisionReportBuilder';
export { DecisionHelper } from './DecisionHelper';

export type {
  EventContext,
  OrganizationObjectives,
  OpportunityRole,
  DecisionCitation,
  DecisionScore,
  EventFitDimension,
  EventFitAnalysis,
  InviteDecision,
  InviteRecommendation,
  PriorityTier,
  PriorityRanking,
  StrategicBenefit,
  DecisionRiskType,
  DecisionRiskSeverity,
  DecisionRisk,
  OpportunityMatch,
  DecisionConfidenceSummary,
  ReasoningChainStep,
  DecisionReasoning,
  DecisionRecommendation,
  DecisionExplainability,
  DecisionMetadata,
  StrategicDecisionReport,
  DecisionLogEntry,
  ExecutiveReport,
  RelationshipReport,
} from './DecisionTypes';
