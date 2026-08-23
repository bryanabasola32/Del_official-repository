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
  ReasoningChainStep,
} from './DecisionTypes';
import { DecisionHelper } from './DecisionHelper';

/*
 * DecisionReasoningEngine — the most important engine.
 *
 * Every recommendation must explain WHY via a reasoning chain:
 *   Observation → Evidence → Analysis → Decision
 *
 * Never invents observations. All observations derive from
 * ExecutiveIntelligenceReport (MP4), RelationshipIntelligenceReport (MP5),
 * EventContext, and OrganizationObjectives.
 */

export class DecisionReasoningEngine {
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
  ): DecisionReasoning {
    const chain: ReasoningChainStep[] = [];

    // ── Step 1: Executive observation ──
    chain.push(this.executiveObservation(execReport));

    // ── Step 2: Relationship observation ──
    chain.push(this.relationshipObservation(relReport));

    // ── Step 3: Event fit analysis ──
    chain.push(this.eventFitAnalysis(eventFit, event));

    // ── Step 4: Opportunity analysis ──
    chain.push(this.opportunityAnalysis(opportunities, objectives));

    // ── Step 5: Risk analysis ──
    chain.push(this.riskAnalysis(risks));

    // ── Step 6: Final decision ──
    chain.push(this.decisionStep(invite, priority, confidence));

    const topOpp = opportunities.length > 0 ? opportunities[0] : null;
    const summary = `Based on ${execReport.evidenceSummary.totalFacts} facts and ${execReport.evidenceSummary.totalSources} sources, ${execReport.contact.name} is assessed as ${priority.tier} (score ${priority.score}) for "${event.eventName}". Invite decision: ${invite.decision} at ${invite.confidence}% confidence. ${topOpp ? `Top opportunity: ${topOpp.role} (${topOpp.matchScore}/100). ` : ''}${risks.length} risk(s) identified. Overall confidence: ${confidence.overallConfidence}% (${confidence.level}).`;

    return {
      recommendation: invite.decision,
      chain,
      summary,
      confidence: confidence.overallConfidence,
    };
  }

  // ── Chain step builders ──────────────────────────

  private executiveObservation(report: ExecutiveIntelligenceReport): ReasoningChainStep {
    const archetype = report.archetypeClassification.archetype;
    const influence = report.persona.influenceLevel.value;
    const industry = report.persona.industryFocus.value;
    const conf = report.confidenceSummary.overall;

    return {
      observation: `${report.contact.name} is a ${archetype} with ${influence} influence in ${industry}.`,
      evidence: `Based on ${report.evidenceSummary.totalFacts} facts from ${report.evidenceSummary.totalSources} sources (trust: ${report.evidenceSummary.trustScore}, completeness: ${report.evidenceSummary.completeness}%).`,
      analysis: `Executive confidence is ${conf}%. Archetype confidence: ${report.archetypeClassification.confidence}%.`,
      decision: `Executive is ${conf >= 50 ? 'sufficiently characterized' : 'insufficiently characterized'} for strategic decision-making.`,
      factIds: [
        ...report.archetypeClassification.factIds,
        ...report.persona.influenceLevel.factIds,
        ...report.persona.industryFocus.factIds,
      ],
      sourceIds: [
        ...report.archetypeClassification.sourceIds,
        ...report.persona.influenceLevel.sourceIds,
        ...report.persona.industryFocus.sourceIds,
      ],
    };
  }

  private relationshipObservation(relReport: RelationshipIntelligenceReport): ReasoningChainStep {
    const stage = relReport.relationshipProfile.stage;
    const readiness = relReport.relationshipProfile.engagementReadiness;
    const score = relReport.scores.overallScore;

    return {
      observation: `Relationship is at "${stage}" stage with "${readiness}" engagement readiness.`,
      evidence: `Relationship score: ${score}/100. Relationship confidence: ${relReport.confidenceSummary.overallConfidence}%.`,
      analysis: `Engagement readiness ${readiness === 'Highly Ready' || readiness === 'Ready' ? 'supports' : 'may not support'} immediate engagement.`,
      decision: `${score >= 50 ? 'Relationship is strong enough to proceed' : 'Relationship needs development before proceeding'}.`,
      factIds: [...relReport.relationshipProfile.citations.factIds, ...relReport.scores.citations.factIds],
      sourceIds: [...relReport.relationshipProfile.citations.sourceIds, ...relReport.scores.citations.sourceIds],
    };
  }

  private eventFitAnalysis(eventFit: EventFitAnalysis, event: EventContext): ReasoningChainStep {
    const dims = eventFit.dimensions.map((d) => `${d.dimension}=${d.score}`).join(', ');

    return {
      observation: `Event fit for "${event.eventName}" is ${eventFit.overallFitScore}/100.`,
      evidence: `Dimension breakdown: ${dims}. Formula: ${eventFit.formula}.`,
      analysis: `Fit confidence is ${eventFit.confidence}%. ${eventFit.overallFitScore >= 55 ? 'Strong event fit.' : eventFit.overallFitScore >= 40 ? 'Moderate event fit.' : 'Weak event fit.'}`,
      decision: `${eventFit.overallFitScore >= 55 ? 'Executive is a good fit for this event.' : 'Event fit is marginal — consider alternative events or evidence gathering.'}`,
      factIds: [...eventFit.citations.factIds],
      sourceIds: [...eventFit.citations.sourceIds],
    };
  }

  private opportunityAnalysis(
    opportunities: OpportunityMatch[],
    objectives: OrganizationObjectives,
  ): ReasoningChainStep {
    if (opportunities.length === 0) {
      return {
        observation: 'No opportunity matches identified.',
        evidence: 'No evidence supports any specific engagement role.',
        analysis: 'Without opportunity matches, engagement value is uncertain.',
        decision: 'Opportunity analysis is inconclusive.',
        factIds: [],
        sourceIds: [],
      };
    }

    const top = opportunities[0];
    const allRoles = opportunities.map((o) => `${o.role}(${o.matchScore})`).join(', ');

    return {
      observation: `${opportunities.length} opportunity match(es) identified. Top: ${top.role} at ${top.matchScore}/100.`,
      evidence: `Matches: ${allRoles}. Org desired opportunities: [${objectives.desiredOpportunities.join(', ')}].`,
      analysis: `${top.reasoning}`,
      decision: `Best engagement role is ${top.role} at ${top.confidence}% confidence.`,
      factIds: [...top.factIds],
      sourceIds: [...top.sourceIds],
    };
  }

  private riskAnalysis(risks: DecisionRisk[]): ReasoningChainStep {
    if (risks.length === 0) {
      return {
        observation: 'No decision risks identified.',
        evidence: 'All risk checks passed.',
        analysis: 'Risk profile is clean.',
        decision: 'No risk-based objections to the recommendation.',
        factIds: [],
        sourceIds: [],
      };
    }

    const high = risks.filter((r) => r.severity === 'high');
    const medium = risks.filter((r) => r.severity === 'medium');
    const low = risks.filter((r) => r.severity === 'low');

    return {
      observation: `${risks.length} risk(s) identified: ${high.length} high, ${medium.length} medium, ${low.length} low.`,
      evidence: risks.map((r) => r.description).join('; '),
      analysis: `${high.length > 0 ? 'High-severity risks must be addressed before proceeding. ' : ''}${medium.length > 0 ? 'Medium-severity risks warrant caution. ' : ''}`,
      decision: `${high.length > 0 ? 'Recommendation is conditional on mitigating high-severity risks.' : 'Risks are manageable within current recommendation.'}`,
      factIds: risks.flatMap((r) => r.factIds),
      sourceIds: risks.flatMap((r) => r.sourceIds),
    };
  }

  private decisionStep(
    invite: InviteRecommendation,
    priority: PriorityRanking,
    confidence: DecisionConfidenceSummary,
  ): ReasoningChainStep {
    return {
      observation: `Invite decision: ${invite.decision}. Priority: ${priority.tier} (score ${priority.score}).`,
      evidence: `Invite confidence: ${invite.confidence}%. Priority confidence: ${priority.confidence}%. Overall confidence: ${confidence.overallConfidence}% (${confidence.level}).`,
      analysis: `Confidence formula: ${confidence.reasoning}`,
      decision: `${invite.decision === 'Invite Immediately' || invite.decision === 'Invite'
        ? 'Proceed with invitation per stated conditions.'
        : invite.decision === 'Invite Later'
        ? 'Defer invitation while building relationship.'
        : invite.decision === 'Observe'
        ? 'Monitor and reassess with additional evidence.'
        : invite.decision === 'Do Not Invite'
        ? 'Do not invite — insufficient fit or confidence.'
        : 'Cannot make recommendation — insufficient evidence.'} ${invite.conditions.length > 0 ? `Conditions: ${invite.conditions.join('; ')}.` : ''}`,
      factIds: [...invite.factIds, ...priority.factIds],
      sourceIds: [...invite.sourceIds, ...priority.sourceIds],
    };
  }
}
