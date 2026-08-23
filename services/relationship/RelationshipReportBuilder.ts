import type { ExecutiveIntelligenceReport } from '../intelligence/IntelligenceTypes';
import type {
  RelationshipIntelligenceReport,
  RelationshipProfile,
  EngagementStrategy,
  ConversationStarter,
  RapportAssessment,
  AlignmentObject,
  RelationshipRisk,
  FollowUpRecommendation,
  RelationshipScores,
  RelationshipConfidenceSummary,
  RelationshipExplainability,
  RelationshipMetadata,
} from './RelationshipTypes';
import { RelationshipHelper } from './RelationshipHelper';

/*
 * RelationshipReportBuilder — assembles the final RelationshipIntelligenceReport.
 *
 * Consumes outputs from all MP5 engines and produces one structured object
 * containing:
 *   Executive Summary, Relationship Profile, Engagement Strategy,
 *   Conversation Guide, Alignment Analysis, Risks, Follow-up Plan,
 *   Scores, Confidence Summary, Recommendations, Citations,
 *   Explainability, Metadata
 */

export class RelationshipReportBuilder {
  build(
    report: ExecutiveIntelligenceReport,
    profile: RelationshipProfile,
    strategies: EngagementStrategy[],
    starters: ConversationStarter[],
    rapport: RapportAssessment,
    alignments: AlignmentObject[],
    risks: RelationshipRisk[],
    followUps: FollowUpRecommendation[],
    scores: RelationshipScores,
    pipelineDurationMs: number,
  ): RelationshipIntelligenceReport {
    const executiveSummary = this.buildExecutiveSummary(report, profile, scores, strategies, starters, risks);
    const recommendations = this.buildRecommendations(strategies, starters, followUps, risks, scores);
    const confidenceSummary = this.buildConfidenceSummary(profile, strategies, starters, rapport, alignments, risks, followUps, scores);
    const explainability = this.buildExplainability(strategies, starters, followUps, alignments, risks);
    const citations = this.buildCitations(report, strategies, starters, followUps, alignments);
    const metadata = this.buildMetadata(pipelineDurationMs, strategies, risks, alignments, followUps, report);

    return {
      contact: {
        id: report.contact.id,
        name: report.contact.name,
        title: report.contact.title,
        company: report.contact.company,
      },
      executiveSummary,
      relationshipProfile: profile,
      engagementStrategies: strategies,
      conversationStarters: starters,
      rapport,
      alignmentAnalysis: alignments,
      risks,
      followUpPlan: followUps,
      scores,
      confidenceSummary,
      recommendations,
      citations,
      explainability,
      metadata,
    };
  }

  // ── Executive Summary ──────────────────────────────

  private buildExecutiveSummary(
    report: ExecutiveIntelligenceReport,
    profile: RelationshipProfile,
    scores: RelationshipScores,
    strategies: EngagementStrategy[],
    starters: ConversationStarter[],
    risks: RelationshipRisk[],
  ): RelationshipIntelligenceReport['executiveSummary'] {
    const keyFindings: string[] = [];

    keyFindings.push(`Relationship stage: ${profile.stage} (${profile.stageConfidence}% confidence)`);
    keyFindings.push(`Engagement readiness: ${profile.engagementReadiness} (${profile.readinessConfidence}% confidence)`);
    keyFindings.push(`Networking potential: ${profile.networkingPotential} (${profile.networkingConfidence}% confidence)`);
    keyFindings.push(`${strategies.length} engagement strategy(ies) generated`);
    keyFindings.push(`${starters.length} conversation starter(s) generated`);
    keyFindings.push(`${risks.length} relationship risk(s) detected`);
    keyFindings.push(`Overall relationship score: ${scores.overallScore}/100`);

    const summary = `${report.contact.name} (${report.contact.title || 'N/A'} at ${report.contact.company}) is assessed at the "${profile.stage}" relationship stage with ${profile.stageConfidence}% confidence. Engagement readiness is "${profile.engagementReadiness}" and networking potential is "${profile.networkingPotential}". The overall relationship score is ${scores.overallScore}/100, derived from ${strategies.length} strategies, ${starters.length} conversation starters, and ${risks.length} detected risk(s). Source intelligence confidence: ${RelationshipHelper.overallConfidence(report)}%.`;

    return {
      summary,
      keyFindings,
      overallConfidence: scores.overallScore,
      relationshipStage: profile.stage,
    };
  }

  // ── Recommendations ────────────────────────────────

  private buildRecommendations(
    strategies: EngagementStrategy[],
    starters: ConversationStarter[],
    followUps: FollowUpRecommendation[],
    risks: RelationshipRisk[],
    scores: RelationshipScores,
  ): RelationshipIntelligenceReport['recommendations'] {
    const recommendations: RelationshipIntelligenceReport['recommendations'] = [];

    for (const strategy of strategies.slice(0, 3)) {
      recommendations.push({
        value: `Pursue ${strategy.type} strategy`,
        reasoning: strategy.reasoning,
        confidence: strategy.confidence,
        citations: strategy.citations,
      });
    }

    for (const starter of starters.slice(0, 3)) {
      recommendations.push({
        value: `Use conversation starter: "${starter.suggestedQuestion}"`,
        reasoning: starter.reasoning,
        confidence: starter.confidence,
        citations: starter.citations,
      });
    }

    const groundedFollowUps = followUps.filter((f) => f.confidence > 0);
    for (const followUp of groundedFollowUps.slice(0, 3)) {
      recommendations.push({
        value: `${followUp.phase}: ${followUp.action}`,
        reasoning: followUp.reasoning,
        confidence: followUp.confidence,
        citations: followUp.citations,
      });
    }

    const highRisks = risks.filter((r) => r.severity === 'high');
    if (highRisks.length > 0) {
      recommendations.push({
        value: `Address ${highRisks.length} high-severity relationship risk(s) before proceeding`,
        reasoning: highRisks.map((r) => r.description).join('; '),
        confidence: 100,
        citations: RelationshipHelper.emptyCitation(),
      });
    }

    if (scores.overallScore < 40) {
      recommendations.push({
        value: 'Supplement with additional research before engaging',
        reasoning: `Overall relationship score is ${scores.overallScore}/100. Additional evidence collection is recommended before using this intelligence for engagement decisions.`,
        confidence: 100,
        citations: RelationshipHelper.emptyCitation(),
      });
    }

    return recommendations;
  }

  // ── Confidence Summary ─────────────────────────────

  private buildConfidenceSummary(
    profile: RelationshipProfile,
    strategies: EngagementStrategy[],
    starters: ConversationStarter[],
    rapport: RapportAssessment,
    alignments: AlignmentObject[],
    risks: RelationshipRisk[],
    followUps: FollowUpRecommendation[],
    scores: RelationshipScores,
  ): RelationshipConfidenceSummary {
    const profileConfidence = Math.round(
      (profile.stageConfidence + profile.readinessConfidence + profile.depthConfidence + profile.networkingConfidence) / 4,
    );
    const strategyConfidence = strategies.length > 0
      ? RelationshipHelper.averageConfidence(strategies)
      : 0;
    const conversationConfidence = starters.length > 0
      ? RelationshipHelper.averageConfidence(starters)
      : 0;
    const rapportConfidence = rapport.overallRapportScore;
    const alignmentConfidence = alignments.length > 0
      ? Math.round(alignments.reduce((s, a) => s + a.alignmentScore, 0) / alignments.length)
      : 0;
    const riskConfidence = risks.length > 0 ? 100 : 0;
    const followUpConfidence = followUps.length > 0
      ? RelationshipHelper.averageConfidence(followUps)
      : 0;
    const scoringConfidence = scores.overallScore;

    const overallConfidence = Math.round(
      profileConfidence * 0.20 +
      strategyConfidence * 0.15 +
      conversationConfidence * 0.15 +
      rapportConfidence * 0.15 +
      alignmentConfidence * 0.10 +
      riskConfidence * 0.05 +
      followUpConfidence * 0.10 +
      scoringConfidence * 0.10,
    );

    const level: 'high' | 'medium' | 'low' =
      overallConfidence >= 65 ? 'high' : overallConfidence >= 35 ? 'medium' : 'low';

    return {
      overallConfidence,
      profileConfidence,
      strategyConfidence,
      conversationConfidence,
      rapportConfidence,
      alignmentConfidence,
      riskConfidence,
      followUpConfidence,
      scoringConfidence,
      level,
      reasoning: `Overall confidence = profile(${profileConfidence})×0.20 + strategy(${strategyConfidence})×0.15 + conversation(${conversationConfidence})×0.15 + rapport(${rapportConfidence})×0.15 + alignment(${alignmentConfidence})×0.10 + risk(${riskConfidence})×0.05 + followUp(${followUpConfidence})×0.10 + scoring(${scoringConfidence})×0.10 = ${overallConfidence}. Level: ${level}.`,
    };
  }

  // ── Explainability ─────────────────────────────────

  private buildExplainability(
    strategies: EngagementStrategy[],
    starters: ConversationStarter[],
    followUps: FollowUpRecommendation[],
    alignments: AlignmentObject[],
    risks: RelationshipRisk[],
  ): RelationshipExplainability {
    const allRecommendations: { citations: { factIds: string[]; sourceIds: string[] }; confidence: number }[] = [
      ...strategies,
      ...starters,
      ...followUps,
    ];

    const totalRecommendations = allRecommendations.length;
    const groundedRecommendations = allRecommendations.filter((r) => r.citations.factIds.length > 0).length;
    const ungroundedRecommendations = totalRecommendations - groundedRecommendations;
    const groundingRate = totalRecommendations > 0
      ? Math.round((groundedRecommendations / totalRecommendations) * 100)
      : 0;

    const allFactIds = new Set<string>();
    for (const r of allRecommendations) {
      for (const fid of r.citations.factIds) allFactIds.add(fid);
    }
    for (const a of alignments) {
      for (const fid of a.citations.factIds) allFactIds.add(fid);
    }
    const citationCoverage = totalRecommendations > 0
      ? Math.round((allFactIds.size / Math.max(totalRecommendations, 1)) * 100)
      : 0;

    const explanation = `This report contains ${totalRecommendations} recommendation(s): ${groundedRecommendations} grounded in evidence (${groundingRate}% grounding rate), ${ungroundedRecommendations} ungrounded. ${alignments.length} alignment object(s) and ${risks.length} risk(s) were generated. Citation coverage: ${citationCoverage}%.`;

    return {
      totalRecommendations,
      groundedRecommendations,
      ungroundedRecommendations,
      groundingRate,
      citationCoverage,
      explanation,
    };
  }

  // ── Citations ──────────────────────────────────────

  private buildCitations(
    report: ExecutiveIntelligenceReport,
    strategies: EngagementStrategy[],
    starters: ConversationStarter[],
    followUps: FollowUpRecommendation[],
    alignments: AlignmentObject[],
  ): RelationshipIntelligenceReport['citations'] {
    const factIds = new Set<string>();
    const sourceIds = new Set<string>();

    for (const s of strategies) {
      for (const fid of s.citations.factIds) factIds.add(fid);
      for (const sid of s.citations.sourceIds) sourceIds.add(sid);
    }
    for (const st of starters) {
      for (const fid of st.citations.factIds) factIds.add(fid);
      for (const sid of st.citations.sourceIds) sourceIds.add(sid);
    }
    for (const f of followUps) {
      for (const fid of f.citations.factIds) factIds.add(fid);
      for (const sid of f.citations.sourceIds) sourceIds.add(sid);
    }
    for (const a of alignments) {
      for (const fid of a.citations.factIds) factIds.add(fid);
      for (const sid of a.citations.sourceIds) sourceIds.add(sid);
    }

    return {
      factIds: Array.from(factIds),
      sourceIds: Array.from(sourceIds),
      sources: report.citations.sources,
    };
  }

  // ── Metadata ───────────────────────────────────────

  private buildMetadata(
    pipelineDurationMs: number,
    strategies: EngagementStrategy[],
    risks: RelationshipRisk[],
    alignments: AlignmentObject[],
    followUps: FollowUpRecommendation[],
    report: ExecutiveIntelligenceReport,
  ): RelationshipMetadata {
    return {
      generatedAt: new Date().toISOString(),
      pipelineDurationMs,
      modules: [
        'RelationshipProfileEngine',
        'EngagementStrategyEngine',
        'ConversationStarterEngine',
        'RapportEngine',
        'InterestAlignmentEngine',
        'RelationshipRiskEngine',
        'FollowUpEngine',
        'RelationshipScoringEngine',
        'RelationshipReportBuilder',
      ],
      recommendationCount: strategies.length + followUps.length,
      riskCount: risks.length,
      alignmentCount: alignments.length,
      followUpCount: followUps.length,
      sourceReportConfidence: RelationshipHelper.overallConfidence(report),
    };
  }
}
