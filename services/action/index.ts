// ── MP7: Action Intelligence Engine ─────────────────
//
// Barrel exports for the action module.
// All MP7 engines consume ExecutiveIntelligenceReport (MP4),
// RelationshipIntelligenceReport (MP5), and StrategicDecisionReport (MP6).
// No MP1–MP6 component is modified.

export { ActionCoordinator } from './ActionCoordinator';
export { getActionCoordinator, generateActionExecutionReport } from './ActionCoordinator';
export { ActionPlanEngine } from './ActionPlanEngine';
export { MeetingStrategyEngine } from './MeetingStrategyEngine';
export { ConversationFlowEngine } from './ConversationFlowEngine';
export { EmailStrategyEngine } from './EmailStrategyEngine';
export { OutreachSequenceEngine } from './OutreachSequenceEngine';
export { FollowUpWorkflowEngine } from './FollowUpWorkflowEngine';
export { TaskGenerationEngine } from './TaskGenerationEngine';
export { SuccessMetricEngine } from './SuccessMetricEngine';
export { ActionReportBuilder } from './ActionReportBuilder';
export { ActionHelper } from './ActionHelper';

export type {
  ExecReport,
  RelReport,
  DecisionReport,
  ActionCitation,
  ActionTimeframe,
  ActionPriority,
  PlannedAction,
  ActionPlan,
  MeetingType,
  MeetingAttendee,
  MeetingAgendaItem,
  MeetingStrategy,
  ConversationSectionType,
  ConversationSection,
  ConversationFlow,
  EmailTone,
  EmailCallToAction,
  FollowUpStyle,
  EmailStrategy,
  OutreachTrigger,
  OutreachStep,
  OutreachSequence,
  FollowUpActionType,
  FollowUpAction,
  FollowUpWorkflow,
  TaskStatus,
  GeneratedTask,
  TaskList,
  MetricType,
  SuccessMetric,
  SuccessMetrics,
  ActionRecommendation,
  ActionRiskType,
  ActionRiskSeverity,
  ActionRisk,
  ActionConfidenceSummary,
  ActionExplainability,
  ActionMetadata,
  ActionExecutionReport,
  ActionLogEntry,
} from './ActionTypes';
