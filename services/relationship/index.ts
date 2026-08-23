// ── MP5: Relationship Intelligence Engine ──────────────
//
// Barrel exports for the relationship module.
// All MP5 engines consume ExecutiveIntelligenceReport from MP4.
// No MP1–MP4 component is modified.

export { RelationshipCoordinator } from './RelationshipCoordinator';
export { getRelationshipCoordinator, generateRelationshipIntelligenceReport } from './RelationshipCoordinator';
export { RelationshipProfileEngine } from './RelationshipProfileEngine';
export { EngagementStrategyEngine } from './EngagementStrategyEngine';
export { ConversationStarterEngine } from './ConversationStarterEngine';
export { RapportEngine } from './RapportEngine';
export { InterestAlignmentEngine } from './InterestAlignmentEngine';
export { RelationshipRiskEngine } from './RelationshipRiskEngine';
export { FollowUpEngine } from './FollowUpEngine';
export { RelationshipScoringEngine } from './RelationshipScoringEngine';
export { RelationshipReportBuilder } from './RelationshipReportBuilder';
export { RelationshipHelper } from './RelationshipHelper';

export type {
  RelationshipCitation,
  RelationshipStage,
  EngagementReadiness,
  InteractionDepth,
  NetworkingPotential,
  RelationshipProfile,
  EngagementStrategyType,
  EngagementStrategy,
  ConversationCategory,
  ConversationStarter,
  CompatibilityLevel,
  RapportAssessment,
  AlignmentDimension,
  AlignmentObject,
  RelationshipRiskType,
  RelationshipRiskSeverity,
  RelationshipRisk,
  FollowUpPhase,
  FollowUpRecommendation,
  RelationshipScores,
  RelationshipConfidenceSummary,
  RelationshipExplainability,
  RelationshipMetadata,
  RelationshipIntelligenceReport,
  RelationshipLogEntry,
  SourceReport,
} from './RelationshipTypes';
