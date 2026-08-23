import type { ExecutiveIntelligenceReport } from '../intelligence/IntelligenceTypes';
import type { RelationshipIntelligenceReport } from '../relationship/RelationshipTypes';
import type { StrategicDecisionReport } from '../decision/DecisionTypes';
import type {
  ActionExecutionReport,
  ActionPlan,
  MeetingStrategy,
  ConversationFlow,
  EmailStrategy,
  OutreachSequence,
  FollowUpWorkflow,
  TaskList,
  SuccessMetrics,
  ActionRecommendation,
  ActionRisk,
  ActionConfidenceSummary,
  ActionExplainability,
  ActionMetadata,
} from './ActionTypes';
import { ActionHelper } from './ActionHelper';

/*
 * ActionReportBuilder — assembles the final ActionExecutionReport.
 *
 * Consumes MP4, MP5, MP6 public interfaces and the outputs of all 8 MP7 engines.
 * Produces a complete report with executive summary, all engine outputs,
 * recommendations, risks, confidence summary, explainability, citations, and metadata.
 */

export class ActionReportBuilder {
  build(
    execReport: ExecutiveIntelligenceReport,
    relReport: RelationshipIntelligenceReport,
    decisionReport: StrategicDecisionReport,
    actionPlan: ActionPlan,
    meetingStrategy: MeetingStrategy,
    conversationFlow: ConversationFlow,
    emailStrategy: EmailStrategy,
    outreachSequence: OutreachSequence,
    followUpWorkflow: FollowUpWorkflow,
    taskList: TaskList,
    successMetrics: SuccessMetrics,
    pipelineDurationMs: number,
  ): ActionExecutionReport {
    const recommendations = this.buildRecommendations(
      execReport, relReport, decisionReport,
      actionPlan, taskList, successMetrics,
    );
    const risks = this.assessRisks(execReport, relReport, decisionReport, actionPlan, taskList);
    const confidenceSummary = this.buildConfidenceSummary(
      actionPlan, meetingStrategy, conversationFlow, emailStrategy,
      outreachSequence, followUpWorkflow, taskList, successMetrics,
    );
    const explainability = this.buildExplainability(
      actionPlan, meetingStrategy, conversationFlow, emailStrategy,
      outreachSequence, followUpWorkflow, taskList, successMetrics, recommendations,
    );
    const citations = ActionHelper.aggregateCitations(execReport, relReport, decisionReport);
    const sources = ActionHelper.aggregateSources(execReport, relReport, decisionReport);

    return {
      contact: { ...execReport.contact },
      event: { ...decisionReport.event },

      executiveSummary: this.buildExecutiveSummary(
        execReport, relReport, decisionReport, actionPlan, confidenceSummary,
      ),

      actionPlan,
      meetingStrategy,
      conversationFlow,
      emailStrategy,
      outreachSequence,
      followUpWorkflow,
      taskList,
      successMetrics,

      recommendations,
      risks,

      confidenceSummary,
      explainability,

      citations: {
        factIds: citations.factIds,
        sourceIds: citations.sourceIds,
        sources,
      },

      metadata: this.buildMetadata(
        execReport, relReport, decisionReport,
        actionPlan, taskList, successMetrics, pipelineDurationMs,
      ),
    };
  }

  private buildExecutiveSummary(
    execReport: ExecutiveIntelligenceReport,
    relReport: RelationshipIntelligenceReport,
    decisionReport: StrategicDecisionReport,
    actionPlan: ActionPlan,
    confidenceSummary: ActionConfidenceSummary,
  ): ActionExecutionReport['executiveSummary'] {
    const invite = decisionReport.inviteRecommendation.decision;
    const totalActions = actionPlan.immediate.length + actionPlan.shortTerm.length + actionPlan.mediumTerm.length + actionPlan.longTerm.length;

    const keyFindings: string[] = [
      `Invite decision: ${invite} (confidence ${decisionReport.inviteRecommendation.confidence})`,
      `Priority tier: ${decisionReport.priorityRanking.tier} (score ${decisionReport.priorityRanking.score})`,
      `Executive archetype: ${ActionHelper.archetype(execReport)} (confidence ${execReport.archetypeClassification.confidence})`,
      `Relationship stage: ${ActionHelper.relationshipStage(relReport)} (confidence ${relReport.relationshipProfile.stageConfidence})`,
      `Action plan: ${totalActions} actions across 4 timeframes`,
      `Overall action confidence: ${confidenceSummary.overallConfidence}% (${confidenceSummary.level})`,
    ];

    const topRoles = ActionHelper.topOpportunityRoles(decisionReport);
    if (topRoles.length > 0) {
      keyFindings.push(`Top opportunity roles: ${topRoles.join(', ')}`);
    }

    const primaryAction = actionPlan.immediate[0]?.title ?? 'Monitor and gather additional evidence';

    return {
      summary: `Action execution plan for engaging ${execReport.contact.name} (${execReport.contact.title}, ${execReport.contact.company}) around ${decisionReport.event.name}. Invite decision is "${invite}" with ${totalActions} planned actions across immediate, short-term, medium-term, and long-term timeframes.`,
      keyFindings,
      overallConfidence: confidenceSummary.overallConfidence,
      primaryAction,
      inviteDecision: invite,
    };
  }

  private buildRecommendations(
    execReport: ExecutiveIntelligenceReport,
    relReport: RelationshipIntelligenceReport,
    decisionReport: StrategicDecisionReport,
    actionPlan: ActionPlan,
    taskList: TaskList,
    successMetrics: SuccessMetrics,
  ): ActionRecommendation[] {
    const recs: ActionRecommendation[] = [];
    const invite = decisionReport.inviteRecommendation.decision;

    // Recommendation 1: Based on invite decision
    if (invite === 'Invite Immediately' || invite === 'Invite') {
      recs.push({
        action: `Send personalized invitation to ${execReport.contact.name} for ${decisionReport.event.name} within 2 days`,
        priority: invite === 'Invite Immediately' ? 'critical' : 'high',
        confidence: ActionHelper.clampConfidence(decisionReport.inviteRecommendation.confidence),
        reasoning: `Invite decision is "${invite}" with confidence ${decisionReport.inviteRecommendation.confidence}.`,
        factIds: [...decisionReport.inviteRecommendation.factIds],
        sourceIds: [...decisionReport.inviteRecommendation.sourceIds],
      });
    }

    // Recommendation 2: Based on top opportunity
    const topOpp = decisionReport.opportunityAnalysis
      .filter((o) => o.matchScore >= 50)
      .sort((a, b) => b.matchScore - a.matchScore)[0];
    if (topOpp) {
      recs.push({
        action: `Prepare ${topOpp.role} materials and case studies for ${execReport.contact.name}`,
        priority: 'high',
        confidence: ActionHelper.clampConfidence(topOpp.confidence),
        reasoning: `Top opportunity role is "${topOpp.role}" with match score ${topOpp.matchScore}.`,
        factIds: [...topOpp.factIds],
        sourceIds: [...topOpp.sourceIds],
      });
    }

    // Recommendation 3: Based on relationship stage
    const stage = ActionHelper.relationshipStage(relReport);
    if (stage === 'Ready' || stage === 'Highly Ready') {
      recs.push({
        action: `Schedule a pre-event call with ${execReport.contact.name} to build rapport`,
        priority: 'medium',
        confidence: ActionHelper.clampConfidence(relReport.relationshipProfile.readinessConfidence),
        reasoning: `Engagement readiness is "${ActionHelper.engagementReadiness(relReport)}" with confidence ${relReport.relationshipProfile.readinessConfidence}.`,
        factIds: [...relReport.relationshipProfile.citations.factIds],
        sourceIds: [...relReport.relationshipProfile.citations.sourceIds],
      });
    }

    // Recommendation 4: Post-event follow-up
    if (invite !== 'Do Not Invite' && invite !== 'Unknown') {
      recs.push({
        action: `Execute post-event follow-up workflow: send thank-you, executive brief, and schedule strategy meeting`,
        priority: 'high',
        confidence: ActionHelper.clampConfidence(
          ActionHelper.mergeConfidence([
            { confidence: relReport.confidenceSummary.followUpConfidence },
            { confidence: ActionHelper.executiveConfidence(execReport) },
          ]),
        ),
        reasoning: `Follow-up confidence is ${relReport.confidenceSummary.followUpConfidence}. Executive confidence is ${ActionHelper.executiveConfidence(execReport)}.`,
        factIds: ActionHelper.collectRelationshipFactIds(relReport).slice(0, 3),
        sourceIds: ActionHelper.collectRelationshipSourceIds(relReport).slice(0, 3),
      });
    }

    // Recommendation 5: Low confidence guard
    if (confidenceSummaryLow(actionPlan, taskList, successMetrics)) {
      recs.push({
        action: 'Gather additional evidence before proceeding with high-commitment actions',
        priority: 'medium',
        confidence: 50,
        reasoning: 'Action plan or task confidence is below 50. Additional evidence gathering is recommended before high-commitment outreach.',
        factIds: [],
        sourceIds: [],
      });
    }

    return recs;
  }

  private assessRisks(
    execReport: ExecutiveIntelligenceReport,
    relReport: RelationshipIntelligenceReport,
    decisionReport: StrategicDecisionReport,
    actionPlan: ActionPlan,
    taskList: TaskList,
  ): ActionRisk[] {
    const risks: ActionRisk[] = [];
    const execConf = ActionHelper.executiveConfidence(execReport);
    const relConf = ActionHelper.relationshipConfidence(relReport);
    const invite = decisionReport.inviteRecommendation.decision;

    // Risk 1: Low executive confidence
    if (execConf < 40) {
      risks.push({
        type: 'evidence_risk',
        description: `Executive intelligence confidence is low (${execConf}%). Action plan may be based on incomplete evidence.`,
        severity: 'high',
        confidence: ActionHelper.clampConfidence(100 - execConf),
        reasoning: `Executive confidence is ${execConf}%, below the 40% threshold for reliable action planning.`,
        factIds: [],
        sourceIds: [],
      });
    }

    // Risk 2: Low relationship confidence
    if (relConf < 40) {
      risks.push({
        type: 'alignment_risk',
        description: `Relationship intelligence confidence is low (${relConf}%). Engagement strategy may not resonate.`,
        severity: 'medium',
        confidence: ActionHelper.clampConfidence(100 - relConf),
        reasoning: `Relationship confidence is ${relConf}%, below the 40% threshold for reliable engagement planning.`,
        factIds: [],
        sourceIds: [],
      });
    }

    // Risk 3: Too many tasks / overload
    if (taskList.tasks.length > 8) {
      risks.push({
        type: 'overload_risk',
        description: `Task list contains ${taskList.tasks.length} tasks. Team may be overloaded.`,
        severity: 'medium',
        confidence: 70,
        reasoning: `${taskList.tasks.length} tasks exceeds the recommended maximum of 8 for a single executive engagement cycle.`,
        factIds: [],
        sourceIds: [],
      });
    }

    // Risk 4: Timing risk — invite later but immediate actions planned
    if (invite === 'Invite Later' && actionPlan.immediate.length > 1) {
      risks.push({
        type: 'timing_risk',
        description: `Invite decision is "Invite Later" but ${actionPlan.immediate.length} immediate actions are planned. Timing may be premature.`,
        severity: 'medium',
        confidence: 75,
        reasoning: `Invite decision "${invite}" suggests delayed engagement, but immediate actions are queued.`,
        factIds: [...decisionReport.inviteRecommendation.factIds],
        sourceIds: [...decisionReport.inviteRecommendation.sourceIds],
      });
    }

    // Risk 5: Engagement risk — Not Ready but meeting scheduled
    if (relReport.relationshipProfile.engagementReadiness === 'Not Ready' && taskList.tasks.some((t) => t.title.includes('Schedule'))) {
      risks.push({
        type: 'engagement_risk',
        description: `Executive engagement readiness is "Not Ready" but scheduling tasks are planned. Meeting may be declined.`,
        severity: 'high',
        confidence: ActionHelper.clampConfidence(relReport.relationshipProfile.readinessConfidence),
        reasoning: `Readiness is "Not Ready" with confidence ${relReport.relationshipProfile.readinessConfidence}. Scheduling tasks may fail.`,
        factIds: [...relReport.relationshipProfile.citations.factIds],
        sourceIds: [...relReport.relationshipProfile.citations.sourceIds],
      });
    }

    // Risk 6: Resource risk — long-term dependencies
    const longTermDeps = actionPlan.longTerm.filter((a) => a.dependencies.length > 0);
    if (longTermDeps.length > 2) {
      risks.push({
        type: 'resource_risk',
        description: `${longTermDeps.length} long-term actions have dependencies. Sustained resource commitment required.`,
        severity: 'low',
        confidence: 60,
        reasoning: `${longTermDeps.length} long-term actions depend on earlier actions completing successfully.`,
        factIds: [],
        sourceIds: [],
      });
    }

    return risks;
  }

  private buildConfidenceSummary(
    actionPlan: ActionPlan,
    meetingStrategy: MeetingStrategy,
    conversationFlow: ConversationFlow,
    emailStrategy: EmailStrategy,
    outreachSequence: OutreachSequence,
    followUpWorkflow: FollowUpWorkflow,
    taskList: TaskList,
    successMetrics: SuccessMetrics,
  ): ActionConfidenceSummary {
    const actionPlanConfidence = actionPlan.confidence;
    const meetingStrategyConfidence = meetingStrategy.confidence;
    const conversationFlowConfidence = conversationFlow.confidence;
    const emailStrategyConfidence = emailStrategy.confidence;
    const outreachSequenceConfidence = outreachSequence.confidence;
    const followUpWorkflowConfidence = followUpWorkflow.confidence;
    const taskConfidence = taskList.confidence;
    const successMetricConfidence = successMetrics.confidence;

    const overallConfidence = ActionHelper.clampConfidence(
      ActionHelper.weightedConfidence([
        { confidence: actionPlanConfidence, weight: 0.20 },
        { confidence: meetingStrategyConfidence, weight: 0.15 },
        { confidence: conversationFlowConfidence, weight: 0.15 },
        { confidence: emailStrategyConfidence, weight: 0.10 },
        { confidence: outreachSequenceConfidence, weight: 0.10 },
        { confidence: followUpWorkflowConfidence, weight: 0.10 },
        { confidence: taskConfidence, weight: 0.10 },
        { confidence: successMetricConfidence, weight: 0.10 },
      ]),
    );

    const level = overallConfidence >= 65 ? 'high' : overallConfidence >= 35 ? 'medium' : 'low';

    return {
      overallConfidence,
      actionPlanConfidence,
      meetingStrategyConfidence,
      conversationFlowConfidence,
      emailStrategyConfidence,
      outreachSequenceConfidence,
      followUpWorkflowConfidence,
      taskConfidence,
      successMetricConfidence,
      level,
      reasoning: `Overall confidence computed as weighted average of 8 engine outputs. Weights: actionPlan 20%, meeting 15%, conversation 15%, email 10%, outreach 10%, followUp 10%, tasks 10%, metrics 10%. Result: ${overallConfidence}% (${level}).`,
    };
  }

  private buildExplainability(
    actionPlan: ActionPlan,
    meetingStrategy: MeetingStrategy,
    conversationFlow: ConversationFlow,
    emailStrategy: EmailStrategy,
    outreachSequence: OutreachSequence,
    followUpWorkflow: FollowUpWorkflow,
    taskList: TaskList,
    successMetrics: SuccessMetrics,
    recommendations: ActionRecommendation[],
  ): ActionExplainability {
    const allItems: { factIds: string[]; sourceIds: string[] }[] = [
      ...actionPlan.immediate,
      ...actionPlan.shortTerm,
      ...actionPlan.mediumTerm,
      ...actionPlan.longTerm,
      ...meetingStrategy.agenda,
      ...conversationFlow.sections,
      emailStrategy,
      ...outreachSequence.steps,
      ...followUpWorkflow.actions,
      ...taskList.tasks,
      ...successMetrics.metrics,
      ...recommendations,
    ];

    const total = allItems.length;
    const grounded = ActionHelper.countGrounded(allItems);
    const groundingRate = ActionHelper.groundingRate(total, grounded);

    const allCitations = ActionHelper.mergeCitations(allItems);
    const citationCoverage = allCitations.factIds.length > 0 ? 100 : 0;

    const explanation = `${total} total recommendations generated. ${grounded} are grounded with fact citations (grounding rate: ${groundingRate}%). ${total - grounded} recommendations lack direct fact citations. Citation coverage: ${citationCoverage}%.`;

    return {
      totalRecommendations: total,
      groundedRecommendations: grounded,
      ungroundedRecommendations: total - grounded,
      groundingRate,
      citationCoverage,
      explanation,
    };
  }

  private buildMetadata(
    execReport: ExecutiveIntelligenceReport,
    relReport: RelationshipIntelligenceReport,
    decisionReport: StrategicDecisionReport,
    actionPlan: ActionPlan,
    taskList: TaskList,
    successMetrics: SuccessMetrics,
    pipelineDurationMs: number,
  ): ActionMetadata {
    const actionCount =
      actionPlan.immediate.length +
      actionPlan.shortTerm.length +
      actionPlan.mediumTerm.length +
      actionPlan.longTerm.length;

    return {
      generatedAt: new Date().toISOString(),
      pipelineDurationMs,
      modules: [
        'ActionPlanEngine',
        'MeetingStrategyEngine',
        'ConversationFlowEngine',
        'EmailStrategyEngine',
        'OutreachSequenceEngine',
        'FollowUpWorkflowEngine',
        'TaskGenerationEngine',
        'SuccessMetricEngine',
        'ActionReportBuilder',
      ],
      actionCount,
      taskCount: taskList.tasks.length,
      metricCount: successMetrics.metrics.length,
      sourceReportConfidence: execReport.confidenceSummary.overall,
      relationshipReportConfidence: relReport.confidenceSummary.overallConfidence,
      decisionReportConfidence: decisionReport.confidenceSummary.overallConfidence,
    };
  }
}

// ── Helper function (not exported) ─────────────────

function confidenceSummaryLow(
  actionPlan: ActionPlan,
  taskList: TaskList,
  successMetrics: SuccessMetrics,
): boolean {
  return (
    actionPlan.confidence < 50 ||
    taskList.confidence < 50 ||
    successMetrics.confidence < 50
  );
}
