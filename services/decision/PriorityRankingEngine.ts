import type { ExecutiveIntelligenceReport } from '../intelligence/IntelligenceTypes';
import type { RelationshipIntelligenceReport } from '../relationship/RelationshipTypes';
import type { EventFitAnalysis, PriorityRanking, PriorityTier, DecisionCitation } from './DecisionTypes';
import { DecisionHelper } from './DecisionHelper';

/*
 * PriorityRankingEngine — assigns a tier and rank to the executive.
 *
 * Tier 1: score >= 70  (high-priority target)
 * Tier 2: score >= 45  (moderate-priority target)
 * Tier 3: score < 45   (low-priority / observe)
 *
 * Score formula (documented, deterministic):
 *   priorityScore = eventFit×0.30 + relationship×0.25 + influence×0.20 +
 *                   strategicImportance×0.15 + confidence×0.10
 *
 * No randomness. Unknown inputs propagate as score=0, confidence=0.
 */

export class PriorityRankingEngine {
  rank(
    execReport: ExecutiveIntelligenceReport,
    relReport: RelationshipIntelligenceReport,
    eventFit: EventFitAnalysis,
  ): PriorityRanking {
    const fit = eventFit.overallFitScore;
    const fitConf = eventFit.confidence;
    const relationship = relReport.scores.overallScore;
    const relConf = relReport.confidenceSummary.overallConfidence;
    const influence = this.scoreInfluence(execReport);
    const strategicImportance = this.scoreStrategicImportance(execReport);
    const execConf = DecisionHelper.executiveConfidence(execReport);
    const evidenceConf = DecisionHelper.evidenceConfidence(execReport);

    const score = DecisionHelper.clampScore(
      fit * 0.30 + relationship * 0.25 + influence * 0.20 + strategicImportance * 0.15 + execConf * 0.10,
    );

    const confidence = DecisionHelper.clampScore(
      fitConf * 0.30 + relConf * 0.25 + execConf * 0.25 + evidenceConf * 0.20,
    );

    const tier: PriorityTier = score >= 70 ? 'Tier 1' : score >= 45 ? 'Tier 2' : 'Tier 3';

    const citations: DecisionCitation = DecisionHelper.mergeCitations([
      eventFit.citations,
      relReport.scores.citations,
    ]);

    const formula = 'priorityScore = eventFit×0.30 + relationship×0.25 + influence×0.20 + strategicImportance×0.15 + execConfidence×0.10';
    const reasoning = `eventFit=${fit}, relationship=${relationship}, influence=${influence}, strategicImportance=${strategicImportance}, execConfidence=${execConf}. ${formula} = ${score}. Tier: ${tier}.`;

    return {
      tier,
      rank: score,
      score,
      confidence,
      reasoning,
      formula,
      factIds: citations.factIds,
      sourceIds: citations.sourceIds,
    };
  }

  private scoreInfluence(report: ExecutiveIntelligenceReport): number {
    const inf = report.persona.influenceLevel;
    if (inf.value === 'Unknown') return 0;
    const map: Record<string, number> = {
      'Industry Leader': 100,
      'Sector Influencer': 80,
      'Company Leader': 60,
      'Emerging Voice': 40,
    };
    const base = map[inf.value] ?? 0;
    return Math.round(base * (inf.confidence / 100));
  }

  private scoreStrategicImportance(report: ExecutiveIntelligenceReport): number {
    const priorities = report.persona.strategicPriorities;
    if (priorities.length === 0) return 0;
    const avgConf = DecisionHelper.aggregateConfidence(priorities);
    const opportunityBonus = report.opportunities.length > 0
      ? Math.min(20, report.opportunities.length * 5)
      : 0;
    return DecisionHelper.clampScore(avgConf * 0.8 + opportunityBonus);
  }
}
