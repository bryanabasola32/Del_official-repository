import type { ExecutiveIntelligenceReport } from '../intelligence/IntelligenceTypes';
import type { RelationshipIntelligenceReport } from '../relationship/RelationshipTypes';
import type { EventFitAnalysis, OpportunityMatch, DecisionRisk, DecisionConfidenceSummary } from './DecisionTypes';
import { DecisionHelper } from './DecisionHelper';

/*
 * DecisionConfidenceEngine — computes overall decision confidence.
 *
 * Formula (documented, deterministic):
 *   overall = eventFit×0.25 + relationship×0.20 + executive×0.20 +
 *             evidence×0.15 + opportunityMatch×0.10 - riskPenalty
 *
 *   riskPenalty = sum(highRisks×15 + mediumRisks×8 + lowRisks×3), capped at 30
 *
 *   level = high (>=65) | medium (>=35) | low (<35)
 *
 * No randomness.
 */

export class DecisionConfidenceEngine {
  compute(
    execReport: ExecutiveIntelligenceReport,
    relReport: RelationshipIntelligenceReport,
    eventFit: EventFitAnalysis,
    opportunities: OpportunityMatch[],
    risks: DecisionRisk[],
  ): DecisionConfidenceSummary {
    const eventFitConfidence = eventFit.confidence;
    const relationshipScoreConfidence = relReport.confidenceSummary.overallConfidence;
    const executiveConfidence = DecisionHelper.executiveConfidence(execReport);
    const evidenceConfidence = DecisionHelper.evidenceConfidence(execReport);
    const opportunityMatchConfidence = opportunities.length > 0
      ? DecisionHelper.aggregateConfidence(opportunities)
      : 0;

    // ── Risk penalty ──
    const highRisks = risks.filter((r) => r.severity === 'high').length;
    const mediumRisks = risks.filter((r) => r.severity === 'medium').length;
    const lowRisks = risks.filter((r) => r.severity === 'low').length;
    const rawPenalty = highRisks * 15 + mediumRisks * 8 + lowRisks * 3;
    const riskPenalty = Math.min(30, rawPenalty);

    // ── If invite decision is Unknown, force overall confidence to 0 ──
    // This prevents Unknown + High Confidence contradiction.
    // The confidence engine receives the invite via the risks array,
    // but the Unknown state is already reflected by execConfidence=0
    // and eventFitConfidence=0 which the InviteEngine checks before producing Unknown.
    // This guard is a secondary safety net.
    const inviteUnknown = execReport.confidenceSummary.overall === 0;

    const overallConfidence = inviteUnknown
      ? 0
      : DecisionHelper.clampScore(
          eventFitConfidence * 0.25 +
          relationshipScoreConfidence * 0.20 +
          executiveConfidence * 0.20 +
          evidenceConfidence * 0.15 +
          opportunityMatchConfidence * 0.10 -
          riskPenalty,
        );

    const level: 'high' | 'medium' | 'low' =
      overallConfidence >= 65 ? 'high' : overallConfidence >= 35 ? 'medium' : 'low';

    const reasoning = `overall = eventFit(${eventFitConfidence})×0.25 + relationship(${relationshipScoreConfidence})×0.20 + executive(${executiveConfidence})×0.20 + evidence(${evidenceConfidence})×0.15 + opportunity(${opportunityMatchConfidence})×0.10 - riskPenalty(${riskPenalty}) = ${overallConfidence}. Level: ${level}.`;

    return {
      overallConfidence,
      eventFitConfidence,
      relationshipScoreConfidence,
      executiveConfidence,
      evidenceConfidence,
      opportunityMatchConfidence,
      riskPenalty,
      level,
      reasoning,
    };
  }
}
