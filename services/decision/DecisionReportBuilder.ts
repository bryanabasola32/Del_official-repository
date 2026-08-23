import type { ExecutiveIntelligenceReport } from '../intelligence/IntelligenceTypes';
import type { RelationshipIntelligenceReport } from '../relationship/RelationshipTypes';
import type {
  EventContext,
  OrganizationObjectives,
  EventFitAnalysis,
  InviteRecommendation,
  PriorityRanking,
  OpportunityMatch,
  StrategicBenefit,
  DecisionRisk,
  DecisionConfidenceSummary,
  DecisionReasoning,
  DecisionRecommendation,
  DecisionExplainability,
  DecisionMetadata,
  StrategicDecisionReport,
} from './DecisionTypes';
import { DecisionHelper } from './DecisionHelper';

/*
 * DecisionReportBuilder — assembles the final StrategicDecisionReport.
 *
 * Sections:
 *   Executive Summary, Decision Summary, Invite Recommendation,
 *   Priority Ranking, Event Fit, Opportunity Analysis, Strategic Benefits,
 *   Decision Risks, Confidence Summary, Reasoning, Recommendations,
 *   Citations, Explainability, Metadata
 */

export class DecisionReportBuilder {
  build(
    execReport: ExecutiveIntelligenceReport,
    relReport: RelationshipIntelligenceReport,
    event: EventContext,
    objectives: OrganizationObjectives,
    eventFit: EventFitAnalysis,
    invite: InviteRecommendation,
    priority: PriorityRanking,
    opportunities: OpportunityMatch[],
    benefits: StrategicBenefit[],
    risks: DecisionRisk[],
    confidence: DecisionConfidenceSummary,
    reasoning: DecisionReasoning,
    pipelineDurationMs: number,
  ): StrategicDecisionReport {
    const executiveSummary = this.buildExecutiveSummary(
      execReport, relReport, event, invite, priority, confidence, risks,
    );
    const decisionSummary = this.buildDecisionSummary(invite, priority, confidence);
    const recommendations = this.buildRecommendations(
      invite, priority, opportunities, benefits, risks, confidence,
    );
    const explainability = this.buildExplainability(
      invite, priority, opportunities, benefits, risks,
    );
    const citations = this.buildCitations(execReport, relReport, eventFit, invite, priority, opportunities, benefits, risks);
    const metadata = this.buildMetadata(pipelineDurationMs, recommendations, risks, opportunities, execReport, relReport);

    return {
      contact: {
        id: execReport.contact.id,
        name: execReport.contact.name,
        title: execReport.contact.title,
        company: execReport.contact.company,
      },
      event: {
        id: event.id,
        name: event.eventName,
        theme: event.theme,
      },
      executiveSummary,
      decisionSummary,
      inviteRecommendation: invite,
      priorityRanking: priority,
      eventFit,
      opportunityAnalysis: opportunities,
      strategicBenefits: benefits,
      decisionRisks: risks,
      confidenceSummary: confidence,
      reasoning,
      recommendations,
      citations,
      explainability,
      metadata,
    };
  }

  // ── Executive Summary ────────────────────────────

  private buildExecutiveSummary(
    execReport: ExecutiveIntelligenceReport,
    relReport: RelationshipIntelligenceReport,
    event: EventContext,
    invite: InviteRecommendation,
    priority: PriorityRanking,
    confidence: DecisionConfidenceSummary,
    risks: DecisionRisk[],
  ): StrategicDecisionReport['executiveSummary'] {
    const keyFindings: string[] = [];

    keyFindings.push(`Invite decision: ${invite.decision} (${invite.confidence}% confidence)`);
    keyFindings.push(`Priority: ${priority.tier} (score ${priority.score}/100)`);
    keyFindings.push(`Event fit: ${eventFit_overallFit_placeholder(invite, event)}`);
    keyFindings.push(`Overall confidence: ${confidence.overallConfidence}% (${confidence.level})`);
    keyFindings.push(`${risks.length} decision risk(s) identified (${risks.filter((r) => r.severity === 'high').length} high)`);
    keyFindings.push(`Executive intelligence confidence: ${DecisionHelper.executiveConfidence(execReport)}%`);
    keyFindings.push(`Relationship score: ${relReport.scores.overallScore}/100`);

    const summary = `${execReport.contact.name} (${execReport.contact.title || 'N/A'} at ${execReport.contact.company}) is assessed for event "${event.eventName}". Recommendation: ${invite.decision} at ${invite.confidence}% confidence. Priority: ${priority.tier}. Overall decision confidence: ${confidence.overallConfidence}% (${confidence.level}). ${risks.length} risk(s) identified.`;

    return {
      summary,
      keyFindings,
      overallConfidence: confidence.overallConfidence,
      inviteDecision: invite.decision,
      priorityTier: priority.tier,
    };
  }

  // ── Decision Summary ─────────────────────────────

  private buildDecisionSummary(
    invite: InviteRecommendation,
    priority: PriorityRanking,
    confidence: DecisionConfidenceSummary,
  ): StrategicDecisionReport['decisionSummary'] {
    return {
      primaryRecommendation: `${invite.decision} — ${priority.tier}`,
      confidence: confidence.overallConfidence,
      reasoning: `${invite.reasoning} Priority score: ${priority.score}/100. ${confidence.reasoning}`,
    };
  }

  // ── Recommendations ──────────────────────────────

  private buildRecommendations(
    invite: InviteRecommendation,
    priority: PriorityRanking,
    opportunities: OpportunityMatch[],
    benefits: StrategicBenefit[],
    risks: DecisionRisk[],
    confidence: DecisionConfidenceSummary,
  ): DecisionRecommendation[] {
    const recs: DecisionRecommendation[] = [];

    recs.push({
      action: `${invite.decision} ${invite.conditions.length > 0 ? '— conditions: ' + invite.conditions.join('; ') : ''}`,
      priority: invite.decision === 'Invite Immediately' || invite.decision === 'Invite' ? 'high' : 'medium',
      confidence: invite.confidence,
      reasoning: invite.reasoning,
      factIds: [...invite.factIds],
      sourceIds: [...invite.sourceIds],
    });

    for (const opp of opportunities.slice(0, 3)) {
      recs.push({
        action: `Consider engaging as ${opp.role}`,
        priority: opp.matchScore >= 60 ? 'high' : 'medium',
        confidence: opp.confidence,
        reasoning: opp.reasoning,
        factIds: [...opp.factIds],
        sourceIds: [...opp.sourceIds],
      });
    }

    for (const benefit of benefits.slice(0, 3)) {
      recs.push({
        action: benefit.benefit,
        priority: benefit.confidence >= 60 ? 'high' : 'medium',
        confidence: benefit.confidence,
        reasoning: benefit.reasoning,
        factIds: [...benefit.factIds],
        sourceIds: [...benefit.sourceIds],
      });
    }

    const highRisks = risks.filter((r) => r.severity === 'high');
    if (highRisks.length > 0) {
      recs.push({
        action: `Address ${highRisks.length} high-severity decision risk(s) before proceeding`,
        priority: 'high',
        confidence: 100,
        reasoning: highRisks.map((r) => r.description).join('; '),
        factIds: highRisks.flatMap((r) => r.factIds),
        sourceIds: highRisks.flatMap((r) => r.sourceIds),
      });
    }

    if (confidence.overallConfidence < 35) {
      recs.push({
        action: 'Gather additional evidence before acting on this recommendation',
        priority: 'high',
        confidence: 100,
        reasoning: `Overall decision confidence is ${confidence.overallConfidence}% (low). Additional research is recommended.`,
        factIds: [],
        sourceIds: [],
      });
    }

    return recs;
  }

  // ── Explainability ───────────────────────────────

  private buildExplainability(
    invite: InviteRecommendation,
    priority: PriorityRanking,
    opportunities: OpportunityMatch[],
    benefits: StrategicBenefit[],
    risks: DecisionRisk[],
  ): DecisionExplainability {
    const allRecommendations: { factIds: string[] }[] = [
      { factIds: invite.factIds },
      { factIds: priority.factIds },
      ...opportunities,
      ...benefits,
      ...risks,
    ];

    const totalRecommendations = allRecommendations.length;
    const groundedRecommendations = DecisionHelper.countGrounded(allRecommendations);
    const ungroundedRecommendations = totalRecommendations - groundedRecommendations;
    const groundingRate = DecisionHelper.groundingRate(totalRecommendations, groundedRecommendations);

    const allFactIds = new Set<string>();
    for (const r of allRecommendations) {
      for (const fid of r.factIds) allFactIds.add(fid);
    }
    const citationCoverage = totalRecommendations > 0
      ? Math.round((allFactIds.size / Math.max(totalRecommendations, 1)) * 100)
      : 0;

    const explanation = `This report contains ${totalRecommendations} recommendation(s): ${groundedRecommendations} grounded in evidence (${groundingRate}% grounding rate), ${ungroundedRecommendations} ungrounded. ${opportunities.length} opportunity match(es), ${benefits.length} strategic benefit(s), and ${risks.length} risk(s) generated. Citation coverage: ${citationCoverage}%.`;

    return {
      totalRecommendations,
      groundedRecommendations,
      ungroundedRecommendations,
      groundingRate,
      citationCoverage,
      explanation,
    };
  }

  // ── Citations ────────────────────────────────────

  private buildCitations(
    execReport: ExecutiveIntelligenceReport,
    relReport: RelationshipIntelligenceReport,
    eventFit: EventFitAnalysis,
    invite: InviteRecommendation,
    priority: PriorityRanking,
    opportunities: OpportunityMatch[],
    benefits: StrategicBenefit[],
    risks: DecisionRisk[],
  ): StrategicDecisionReport['citations'] {
    const factIds = new Set<string>();
    const sourceIds = new Set<string>();

    for (const fid of DecisionHelper.collectFactIds(execReport)) factIds.add(fid);
    for (const sid of DecisionHelper.collectSourceIds(execReport)) sourceIds.add(sid);
    for (const fid of DecisionHelper.collectRelationshipFactIds(relReport)) factIds.add(fid);
    for (const sid of DecisionHelper.collectRelationshipSourceIds(relReport)) sourceIds.add(sid);
    for (const fid of eventFit.citations.factIds) factIds.add(fid);
    for (const sid of eventFit.citations.sourceIds) sourceIds.add(sid);
    for (const fid of invite.factIds) factIds.add(fid);
    for (const sid of invite.sourceIds) sourceIds.add(sid);
    for (const fid of priority.factIds) factIds.add(fid);
    for (const sid of priority.sourceIds) sourceIds.add(sid);
    for (const opp of opportunities) {
      for (const fid of opp.factIds) factIds.add(fid);
      for (const sid of opp.sourceIds) sourceIds.add(sid);
    }
    for (const b of benefits) {
      for (const fid of b.factIds) factIds.add(fid);
      for (const sid of b.sourceIds) sourceIds.add(sid);
    }
    for (const r of risks) {
      for (const fid of r.factIds) factIds.add(fid);
      for (const sid of r.sourceIds) sourceIds.add(sid);
    }

    return {
      factIds: Array.from(factIds),
      sourceIds: Array.from(sourceIds),
      sources: execReport.citations.sources,
    };
  }

  // ── Metadata ─────────────────────────────────────

  private buildMetadata(
    pipelineDurationMs: number,
    recommendations: DecisionRecommendation[],
    risks: DecisionRisk[],
    opportunities: OpportunityMatch[],
    execReport: ExecutiveIntelligenceReport,
    relReport: RelationshipIntelligenceReport,
  ): DecisionMetadata {
    return {
      generatedAt: new Date().toISOString(),
      pipelineDurationMs,
      modules: [
        'EventFitEngine',
        'InviteRecommendationEngine',
        'PriorityRankingEngine',
        'OpportunityMatchingEngine',
        'DecisionRiskEngine',
        'DecisionConfidenceEngine',
        'DecisionReasoningEngine',
        'DecisionReportBuilder',
      ],
      recommendationCount: recommendations.length,
      riskCount: risks.length,
      opportunityCount: opportunities.length,
      sourceReportConfidence: DecisionHelper.executiveConfidence(execReport),
      relationshipReportConfidence: DecisionHelper.relationshipConfidence(relReport),
    };
  }
}

function eventFit_overallFit_placeholder(invite: InviteRecommendation, event: EventContext): string {
  return `Invite decision for "${event.eventName}": ${invite.decision}`;
}
