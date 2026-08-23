// ── MP4: Executive Intelligence Engine ──────────────
//
// Barrel exports for the intelligence module.
// All MP4 engines consume EvidenceContext from MP3.
// No MP3 component is modified.

export { ExecutiveIntelligenceCoordinator } from './ExecutiveIntelligenceCoordinator';
export { getExecutiveIntelligenceCoordinator, generateExecutiveIntelligenceReport } from './ExecutiveIntelligenceCoordinator';
export { ExecutivePersonaEngine } from './ExecutivePersonaEngine';
export { PersonaReasoningEngine } from './PersonaReasoningEngine';
export { ExecutiveArchetypeClassifier } from './ExecutiveArchetypeClassifier';
export { ExecutiveOpportunityEngine } from './ExecutiveOpportunityEngine';
export { ExecutiveRiskEngine } from './ExecutiveRiskEngine';
export { PersonaConfidenceEngine } from './PersonaConfidenceEngine';
export { ExecutiveTimelineBuilder } from './ExecutiveTimelineBuilder';
export { ExecutiveReportBuilder } from './ExecutiveReportBuilder';
export { FactHelper } from './FactHelper';

export type {
  Inference,
  ExecutivePersona,
  LeadershipStyle,
  CommunicationStyle,
  DecisionStyle,
  RiskAppetite,
  InnovationOrientation,
  InfluenceLevel,
  NetworkingStyle,
  NegotiationStyle,
  ReasonedInference,
  ReasoningChain,
  ReasoningStep,
  ExecutiveArchetype,
  ArchetypeClassification,
  OpportunityType,
  ExecutiveOpportunity,
  RiskType,
  RiskSeverity,
  ExecutiveRisk,
  PersonaConfidenceSummary,
  TimelineEventType,
  TimelineEntry,
  ExecutiveIntelligenceReport,
  IntelligenceLogEntry,
} from './IntelligenceTypes';
