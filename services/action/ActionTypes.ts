import type { ExecutiveIntelligenceReport } from '../intelligence/IntelligenceTypes';
import type { RelationshipIntelligenceReport } from '../relationship/RelationshipTypes';
import type { StrategicDecisionReport } from '../decision/DecisionTypes';

/*
 * ActionTypes — strong TypeScript interfaces for MP7 Action Intelligence.
 *
 * Every recommendation object includes:
 *   confidence, reasoning, factIds, sourceIds
 *
 * No "any" is used anywhere in this module.
 * Every output is derived from MP4, MP5, and MP6 public interfaces.
 */

// ── Input type aliases ────────────────────────────

export type ExecReport = ExecutiveIntelligenceReport;
export type RelReport = RelationshipIntelligenceReport;
export type DecisionReport = StrategicDecisionReport;

// ── Citation ──────────────────────────────────────

export interface ActionCitation {
  factIds: string[];
  sourceIds: string[];
}

// ── Action Plan ───────────────────────────────────

export type ActionTimeframe = 'immediate' | 'short-term' | 'medium-term' | 'long-term';
export type ActionPriority = 'critical' | 'high' | 'medium' | 'low';

export interface PlannedAction {
  id: string;
  title: string;
  description: string;
  timeframe: ActionTimeframe;
  priority: ActionPriority;
  confidence: number;
  reasoning: string;
  factIds: string[];
  sourceIds: string[];
  estimatedImpact: number;
  estimatedEffort: number;
  dependencies: string[];
}

export interface ActionPlan {
  immediate: PlannedAction[];
  shortTerm: PlannedAction[];
  mediumTerm: PlannedAction[];
  longTerm: PlannedAction[];
  confidence: number;
  reasoning: string;
  factIds: string[];
  sourceIds: string[];
}

// ── Meeting Strategy ──────────────────────────────

export type MeetingType =
  | 'Introductory Call'
  | 'Conference Networking'
  | 'Executive Briefing'
  | 'Strategy Discussion'
  | 'Partnership Exploration'
  | 'Follow-up Meeting'
  | 'Unknown';

export interface MeetingAttendee {
  role: string;
  rationale: string;
  required: boolean;
}

export interface MeetingAgendaItem {
  topic: string;
  duration: number;
  objective: string;
  confidence: number;
  reasoning: string;
  factIds: string[];
  sourceIds: string[];
}

export interface MeetingStrategy {
  objective: string;
  meetingType: MeetingType;
  duration: number;
  recommendedAttendees: MeetingAttendee[];
  agenda: MeetingAgendaItem[];
  desiredOutcome: string;
  preparationChecklist: string[];
  confidence: number;
  reasoning: string;
  factIds: string[];
  sourceIds: string[];
}

// ── Conversation Flow ─────────────────────────────

export type ConversationSectionType =
  | 'Opening'
  | 'Rapport'
  | 'Industry Discussion'
  | 'Technology Discussion'
  | 'Business Discussion'
  | 'Strategic Opportunity'
  | 'Call to Action'
  | 'Closing';

export interface ConversationSection {
  section: ConversationSectionType;
  purpose: string;
  talkingPoints: string[];
  avoidTopics: string[];
  confidence: number;
  reasoning: string;
  factIds: string[];
  sourceIds: string[];
}

export interface ConversationFlow {
  sections: ConversationSection[];
  confidence: number;
  reasoning: string;
  factIds: string[];
  sourceIds: string[];
}

// ── Email Strategy ────────────────────────────────

export type EmailTone =
  | 'Formal'
  | 'Professional'
  | 'Warm Professional'
  | 'Direct'
  | 'Consultative'
  | 'Unknown';

export type EmailCallToAction =
  | 'Schedule Meeting'
  | 'RSVP to Event'
  | 'Request Introduction'
  | 'Share Resources'
  | 'None'
  | 'Unknown';

export type FollowUpStyle =
  | 'Persistent'
  | 'Measured'
  | 'Gentle'
  | 'Strategic'
  | 'Unknown';

export interface EmailStrategy {
  tone: EmailTone;
  openingAngle: string;
  coreValueProposition: string;
  executiveInterests: string[];
  topicsToHighlight: string[];
  topicsToAvoid: string[];
  callToAction: EmailCallToAction;
  followUpStyle: FollowUpStyle;
  confidence: number;
  reasoning: string;
  factIds: string[];
  sourceIds: string[];
}

// ── Outreach Sequence ─────────────────────────────

export type OutreachTrigger =
  | 'Day 0'
  | 'Day 2'
  | 'Pre-Event'
  | 'During Event'
  | 'Day 1 After'
  | 'Week 1'
  | 'Week 2'
  | 'Month 1'
  | 'Quarterly';

export interface OutreachStep {
  trigger: OutreachTrigger;
  label: string;
  objective: string;
  confidence: number;
  reasoning: string;
  factIds: string[];
  sourceIds: string[];
}

export interface OutreachSequence {
  steps: OutreachStep[];
  confidence: number;
  reasoning: string;
  factIds: string[];
  sourceIds: string[];
}

// ── Follow-up Workflow ────────────────────────────

export type FollowUpActionType =
  | 'Document'
  | 'Introduction'
  | 'Product Demo'
  | 'Executive Brief'
  | 'Future Meeting'
  | 'Networking Opportunity';

export interface FollowUpAction {
  type: FollowUpActionType;
  description: string;
  priority: ActionPriority;
  timing: string;
  confidence: number;
  reasoning: string;
  factIds: string[];
  sourceIds: string[];
}

export interface FollowUpWorkflow {
  actions: FollowUpAction[];
  confidence: number;
  reasoning: string;
  factIds: string[];
  sourceIds: string[];
}

// ── Task Generation ───────────────────────────────

export type TaskStatus = 'not_started' | 'in_progress' | 'blocked' | 'completed';

export interface GeneratedTask {
  title: string;
  description: string;
  owner: string;
  priority: ActionPriority;
  deadline: string;
  dependencies: string[];
  status: TaskStatus;
  confidence: number;
  reasoning: string;
  factIds: string[];
  sourceIds: string[];
}

export interface TaskList {
  tasks: GeneratedTask[];
  confidence: number;
  reasoning: string;
  factIds: string[];
  sourceIds: string[];
}

// ── Success Metrics ───────────────────────────────

export type MetricType =
  | 'Meeting Scheduled'
  | 'Meeting Completed'
  | 'Response Received'
  | 'Proposal Sent'
  | 'Pilot Started'
  | 'Strategic Partnership'
  | 'Executive Referral'
  | 'Event Attendance';

export interface SuccessMetric {
  metric: MetricType;
  target: string;
  measurementMethod: string;
  confidence: number;
  reasoning: string;
  factIds: string[];
  sourceIds: string[];
}

export interface SuccessMetrics {
  metrics: SuccessMetric[];
  confidence: number;
  reasoning: string;
  factIds: string[];
  sourceIds: string[];
}

// ── Recommendations ───────────────────────────────

export interface ActionRecommendation {
  action: string;
  priority: ActionPriority;
  confidence: number;
  reasoning: string;
  factIds: string[];
  sourceIds: string[];
}

// ── Action Risk ───────────────────────────────────

export type ActionRiskType =
  | 'timing_risk'
  | 'engagement_risk'
  | 'resource_risk'
  | 'alignment_risk'
  | 'evidence_risk'
  | 'overload_risk';

export type ActionRiskSeverity = 'low' | 'medium' | 'high';

export interface ActionRisk {
  type: ActionRiskType;
  description: string;
  severity: ActionRiskSeverity;
  confidence: number;
  reasoning: string;
  factIds: string[];
  sourceIds: string[];
}

// ── Confidence Summary ────────────────────────────

export interface ActionConfidenceSummary {
  overallConfidence: number;
  actionPlanConfidence: number;
  meetingStrategyConfidence: number;
  conversationFlowConfidence: number;
  emailStrategyConfidence: number;
  outreachSequenceConfidence: number;
  followUpWorkflowConfidence: number;
  taskConfidence: number;
  successMetricConfidence: number;
  level: 'high' | 'medium' | 'low';
  reasoning: string;
}

// ── Explainability ────────────────────────────────

export interface ActionExplainability {
  totalRecommendations: number;
  groundedRecommendations: number;
  ungroundedRecommendations: number;
  groundingRate: number;
  citationCoverage: number;
  explanation: string;
}

// ── Metadata ──────────────────────────────────────

export interface ActionMetadata {
  generatedAt: string;
  pipelineDurationMs: number;
  modules: string[];
  actionCount: number;
  taskCount: number;
  metricCount: number;
  sourceReportConfidence: number;
  relationshipReportConfidence: number;
  decisionReportConfidence: number;
}

// ── Action Execution Report ───────────────────────

export interface ActionExecutionReport {
  contact: { id: string; name: string; title: string; company: string };
  event: { id: string; name: string; theme: string | null };

  executiveSummary: {
    summary: string;
    keyFindings: string[];
    overallConfidence: number;
    primaryAction: string;
    inviteDecision: string;
  };

  actionPlan: ActionPlan;
  meetingStrategy: MeetingStrategy;
  conversationFlow: ConversationFlow;
  emailStrategy: EmailStrategy;
  outreachSequence: OutreachSequence;
  followUpWorkflow: FollowUpWorkflow;
  taskList: TaskList;
  successMetrics: SuccessMetrics;

  recommendations: ActionRecommendation[];
  risks: ActionRisk[];

  confidenceSummary: ActionConfidenceSummary;
  explainability: ActionExplainability;

  citations: {
    factIds: string[];
    sourceIds: string[];
    sources: { sourceId: string; sourceName: string; url: string; authorityScore: number; tier: number }[];
  };

  metadata: ActionMetadata;
}

// ── Log Entry ─────────────────────────────────────

export interface ActionLogEntry {
  module: string;
  latencyMs: number;
  confidence: number;
  recommendationCount: number;
  warnings: string[];
  timestamp: string;
}
