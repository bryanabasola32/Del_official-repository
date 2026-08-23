import type { ExecutiveIntelligenceReport } from '../intelligence/IntelligenceTypes';
import type { RelationshipIntelligenceReport } from '../relationship/RelationshipTypes';
import type { StrategicDecisionReport } from '../decision/DecisionTypes';
import type { ActionExecutionReport, ActionLogEntry } from './ActionTypes';
import { ActionPlanEngine } from './ActionPlanEngine';
import { MeetingStrategyEngine } from './MeetingStrategyEngine';
import { ConversationFlowEngine } from './ConversationFlowEngine';
import { EmailStrategyEngine } from './EmailStrategyEngine';
import { OutreachSequenceEngine } from './OutreachSequenceEngine';
import { FollowUpWorkflowEngine } from './FollowUpWorkflowEngine';
import { TaskGenerationEngine } from './TaskGenerationEngine';
import { SuccessMetricEngine } from './SuccessMetricEngine';
import { ActionReportBuilder } from './ActionReportBuilder';

/*
 * ActionCoordinator — orchestrates the MP7 pipeline.
 *
 * Pipeline:
 *   ExecutiveIntelligenceReport + RelationshipIntelligenceReport + StrategicDecisionReport
 *     → ActionPlanEngine (action plan)
 *     → MeetingStrategyEngine (meeting strategy)
 *     → ConversationFlowEngine (conversation flow)
 *     → EmailStrategyEngine (email strategy)
 *     → OutreachSequenceEngine (outreach timeline)
 *     → FollowUpWorkflowEngine (follow-up workflow)
 *     → TaskGenerationEngine (executable tasks)
 *     → SuccessMetricEngine (success metrics)
 *     → ActionReportBuilder (final report)
 *
 * Logs each module's execution time and metrics.
 * Does NOT modify any MP1–MP6 component.
 */

export class ActionCoordinator {
  private actionPlanEngine: ActionPlanEngine;
  private meetingStrategyEngine: MeetingStrategyEngine;
  private conversationFlowEngine: ConversationFlowEngine;
  private emailStrategyEngine: EmailStrategyEngine;
  private outreachSequenceEngine: OutreachSequenceEngine;
  private followUpWorkflowEngine: FollowUpWorkflowEngine;
  private taskGenerationEngine: TaskGenerationEngine;
  private successMetricEngine: SuccessMetricEngine;
  private reportBuilder: ActionReportBuilder;

  private logs: ActionLogEntry[] = [];

  constructor() {
    this.actionPlanEngine = new ActionPlanEngine();
    this.meetingStrategyEngine = new MeetingStrategyEngine();
    this.conversationFlowEngine = new ConversationFlowEngine();
    this.emailStrategyEngine = new EmailStrategyEngine();
    this.outreachSequenceEngine = new OutreachSequenceEngine();
    this.followUpWorkflowEngine = new FollowUpWorkflowEngine();
    this.taskGenerationEngine = new TaskGenerationEngine();
    this.successMetricEngine = new SuccessMetricEngine();
    this.reportBuilder = new ActionReportBuilder();
  }

  generateReport(
    execReport: ExecutiveIntelligenceReport,
    relReport: RelationshipIntelligenceReport,
    decisionReport: StrategicDecisionReport,
  ): ActionExecutionReport {
    const pipelineStart = Date.now();

    // ── Step 1: Action Plan Engine ──
    const s1 = Date.now();
    const actionPlan = this.actionPlanEngine.generate(execReport, relReport, decisionReport);
    this.log('ActionPlanEngine', s1, {
      confidence: actionPlan.confidence,
      recommendationCount: actionPlan.immediate.length + actionPlan.shortTerm.length + actionPlan.mediumTerm.length + actionPlan.longTerm.length,
      warnings: actionPlan.confidence === 0 ? ['Action plan confidence is 0 — insufficient evidence'] : [],
    });

    // ── Step 2: Meeting Strategy Engine ──
    const s2 = Date.now();
    const meetingStrategy = this.meetingStrategyEngine.generate(execReport, relReport, decisionReport);
    this.log('MeetingStrategyEngine', s2, {
      confidence: meetingStrategy.confidence,
      recommendationCount: meetingStrategy.agenda.length,
      warnings: meetingStrategy.meetingType === 'Unknown' ? ['Meeting type is Unknown — insufficient evidence'] : [],
    });

    // ── Step 3: Conversation Flow Engine ──
    const s3 = Date.now();
    const conversationFlow = this.conversationFlowEngine.generate(execReport, relReport, decisionReport);
    this.log('ConversationFlowEngine', s3, {
      confidence: conversationFlow.confidence,
      recommendationCount: conversationFlow.sections.length,
      warnings: conversationFlow.sections.length === 0 ? ['No conversation sections — insufficient evidence'] : [],
    });

    // ── Step 4: Email Strategy Engine ──
    const s4 = Date.now();
    const emailStrategy = this.emailStrategyEngine.generate(execReport, relReport, decisionReport);
    this.log('EmailStrategyEngine', s4, {
      confidence: emailStrategy.confidence,
      recommendationCount: emailStrategy.executiveInterests.length,
      warnings: emailStrategy.tone === 'Unknown' ? ['Email tone is Unknown — insufficient evidence'] : [],
    });

    // ── Step 5: Outreach Sequence Engine ──
    const s5 = Date.now();
    const outreachSequence = this.outreachSequenceEngine.generate(execReport, relReport, decisionReport);
    this.log('OutreachSequenceEngine', s5, {
      confidence: outreachSequence.confidence,
      recommendationCount: outreachSequence.steps.length,
      warnings: outreachSequence.steps.length === 0 ? ['No outreach steps — insufficient evidence'] : [],
    });

    // ── Step 6: Follow-up Workflow Engine ──
    const s6 = Date.now();
    const followUpWorkflow = this.followUpWorkflowEngine.generate(execReport, relReport, decisionReport);
    this.log('FollowUpWorkflowEngine', s6, {
      confidence: followUpWorkflow.confidence,
      recommendationCount: followUpWorkflow.actions.length,
      warnings: followUpWorkflow.actions.length === 0 ? ['No follow-up actions — insufficient evidence'] : [],
    });

    // ── Step 7: Task Generation Engine ──
    const s7 = Date.now();
    const taskList = this.taskGenerationEngine.generate(execReport, relReport, decisionReport);
    this.log('TaskGenerationEngine', s7, {
      confidence: taskList.confidence,
      recommendationCount: taskList.tasks.length,
      warnings: taskList.tasks.length === 0 ? ['No tasks generated — insufficient evidence'] : [],
    });

    // ── Step 8: Success Metric Engine ──
    const s8 = Date.now();
    const successMetrics = this.successMetricEngine.generate(execReport, relReport, decisionReport);
    this.log('SuccessMetricEngine', s8, {
      confidence: successMetrics.confidence,
      recommendationCount: successMetrics.metrics.length,
      warnings: successMetrics.metrics.length === 0 ? ['No success metrics — insufficient evidence'] : [],
    });

    // ── Step 9: Report Builder ──
    const s9 = Date.now();
    const pipelineDurationMs = Date.now() - pipelineStart;
    const finalReport = this.reportBuilder.build(
      execReport, relReport, decisionReport,
      actionPlan, meetingStrategy, conversationFlow, emailStrategy,
      outreachSequence, followUpWorkflow, taskList, successMetrics,
      pipelineDurationMs,
    );
    this.log('ActionReportBuilder', s9, {
      confidence: finalReport.confidenceSummary.overallConfidence,
      recommendationCount: finalReport.recommendations.length,
      warnings: [],
    });

    return finalReport;
  }

  getLogs(): ActionLogEntry[] {
    return [...this.logs];
  }

  private log(
    module: string,
    start: number,
    metrics: {
      confidence: number;
      recommendationCount: number;
      warnings: string[];
    },
  ): void {
    this.logs.push({
      module,
      latencyMs: Date.now() - start,
      confidence: metrics.confidence,
      recommendationCount: metrics.recommendationCount,
      warnings: metrics.warnings,
      timestamp: new Date().toISOString(),
    });
  }
}

// ── Singleton ────────────────────────────────────────

let _coordinator: ActionCoordinator | null = null;

export function getActionCoordinator(): ActionCoordinator {
  if (!_coordinator) {
    _coordinator = new ActionCoordinator();
  }
  return _coordinator;
}

export function generateActionExecutionReport(
  execReport: ExecutiveIntelligenceReport,
  relReport: RelationshipIntelligenceReport,
  decisionReport: StrategicDecisionReport,
): ActionExecutionReport {
  return getActionCoordinator().generateReport(execReport, relReport, decisionReport);
}
