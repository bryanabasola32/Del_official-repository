import type { ExecutiveIntelligenceReport } from '../intelligence/IntelligenceTypes';
import type { RelationshipScores } from './RelationshipTypes';
import { RelationshipHelper } from './RelationshipHelper';

/*
 * RelationshipScoringEngine — computes transparent, weighted relationship scores.
 *
 * Scores:
 *   - Relationship Readiness
 *   - Networking Value
 *   - Conversation Quality
 *   - Expected Engagement
 *   - Follow-up Potential
 *   - Overall Score
 *
 * Every score exposes how it was calculated, evidence used, and confidence.
 * No arbitrary random values. All formulas are transparent and deterministic.
 */

export class RelationshipScoringEngine {
  compute(
    report: ExecutiveIntelligenceReport,
    profile: { stageConfidence: number; readinessConfidence: number; networkingConfidence: number; depthConfidence: number },
    strategies: { confidence: number }[],
    starters: { confidence: number }[],
    rapport: { overallRapportScore: number },
    alignments: { alignmentScore: number }[],
    followUps: { confidence: number }[],
  ): RelationshipScores {
    const readiness = this.computeReadiness(report, profile);
    const networking = this.computeNetworkingValue(report, profile);
    const conversation = this.computeConversationQuality(report, starters);
    const engagement = this.computeExpectedEngagement(report, strategies, rapport);
    const followUp = this.computeFollowUpPotential(report, followUps);

    const overall = Math.round(
      readiness.score * 0.25 +
      networking.score * 0.20 +
      conversation.score * 0.20 +
      engagement.score * 0.20 +
      followUp.score * 0.15,
    );

    const allCitations = RelationshipHelper.collectFromInferences([
      report.persona.networkingStyle,
      report.persona.influenceLevel,
      report.persona.communicationStyle,
      report.persona.innovationOrientation,
      ...report.persona.strategicPriorities,
      ...report.persona.businessInterests,
      ...report.opportunities,
    ]);

    return {
      relationshipReadiness: readiness.score,
      readinessReasoning: readiness.reasoning,
      networkingValue: networking.score,
      networkingReasoning: networking.reasoning,
      conversationQuality: conversation.score,
      conversationReasoning: conversation.reasoning,
      expectedEngagement: engagement.score,
      engagementReasoning: engagement.reasoning,
      followUpPotential: followUp.score,
      followUpReasoning: followUp.reasoning,
      overallScore: overall,
      overallReasoning: `Overall = Readiness(${readiness.score})×0.25 + Networking(${networking.score})×0.20 + Conversation(${conversation.score})×0.20 + Engagement(${engagement.score})×0.20 + Follow-up(${followUp.score})×0.15 = ${overall}.`,
      formula: 'overall = readiness*0.25 + networking*0.20 + conversation*0.20 + engagement*0.20 + followUp*0.15',
      citations: allCitations,
    };
  }

  // ── Relationship Readiness ────────────────────────

  private computeReadiness(
    report: ExecutiveIntelligenceReport,
    profile: { stageConfidence: number; readinessConfidence: number; depthConfidence: number },
  ): { score: number; reasoning: string } {
    const overallConf = RelationshipHelper.overallConfidence(report);
    const completeness = RelationshipHelper.completeness(report);
    const highRisks = report.risks.filter((r) => r.severity === 'high').length;

    let score = 0;
    score += Math.round(overallConf * 0.35);
    score += Math.round(completeness * 0.20);
    score += Math.round(profile.readinessConfidence * 0.25);
    score += Math.round(profile.stageConfidence * 0.20);
    score -= highRisks * 10;
    score = Math.max(0, Math.min(100, score));

    return {
      score,
      reasoning: `Readiness = overallConfidence(${overallConf})×0.35 + completeness(${completeness})×0.20 + readinessConfidence(${profile.readinessConfidence})×0.25 + stageConfidence(${profile.stageConfidence})×0.20 - highRisks(${highRisks})×10 = ${score}.`,
    };
  }

  // ── Networking Value ───────────────────────────────

  private computeNetworkingValue(
    report: ExecutiveIntelligenceReport,
    profile: { networkingConfidence: number },
  ): { score: number; reasoning: string } {
    const influence = report.persona.influenceLevel;
    const networkingStyle = report.persona.networkingStyle;

    let score = 30;
    if (influence.value === 'Industry Leader') score += 30;
    else if (influence.value === 'Sector Influencer') score += 25;
    else if (influence.value === 'Company Leader') score += 15;
    else if (influence.value === 'Emerging Voice') score += 5;

    if (networkingStyle.value === 'Relationship Builder' || networkingStyle.value === 'Strategic Networker') score += 25;
    else if (networkingStyle.value === 'Community Builder') score += 20;
    else if (networkingStyle.value === 'Reserved') score += 5;

    score += Math.round(profile.networkingConfidence * 0.15);
    score = Math.max(0, Math.min(100, score));

    return {
      score,
      reasoning: `Networking value = base(30) + influence(${influence.value}) + networkingStyle(${networkingStyle.value}) + networkingConfidence(${profile.networkingConfidence})×0.15 = ${score}.`,
    };
  }

  // ── Conversation Quality ──────────────────────────

  private computeConversationQuality(
    report: ExecutiveIntelligenceReport,
    starters: { confidence: number }[],
  ): { score: number; reasoning: string } {
    const hasPriorities = RelationshipHelper.hasStrategicPriorities(report);
    const hasInterests = RelationshipHelper.hasBusinessInterests(report);
    const hasTech = report.persona.technologyInterest.value !== 'Unknown';
    const hasIndustry = report.persona.industryFocus.value !== 'Unknown';

    let score = 20;
    if (hasPriorities) score += 20;
    if (hasInterests) score += 20;
    if (hasTech) score += 15;
    if (hasIndustry) score += 15;

    if (starters.length > 0) {
      const avgStarterConf = RelationshipHelper.averageConfidence(starters);
      score += Math.round(avgStarterConf * 0.10);
    }

    score = Math.max(0, Math.min(100, score));

    return {
      score,
      reasoning: `Conversation quality = base(20) + priorities(${hasPriorities ? 20 : 0}) + interests(${hasInterests ? 20 : 0}) + techInterest(${hasTech ? 15 : 0}) + industryFocus(${hasIndustry ? 15 : 0}) + avgStarterConfidence×0.10 = ${score}.`,
    };
  }

  // ── Expected Engagement ────────────────────────────

  private computeExpectedEngagement(
    report: ExecutiveIntelligenceReport,
    strategies: { confidence: number }[],
    rapport: { overallRapportScore: number },
  ): { score: number; reasoning: string } {
    const overallConf = RelationshipHelper.overallConfidence(report);
    const oppCount = RelationshipHelper.sourceOpportunityCount(report);

    let score = 20;
    score += Math.round(overallConf * 0.20);
    score += Math.round(rapport.overallRapportScore * 0.30);
    score += Math.min(20, oppCount * 5);

    if (strategies.length > 0) {
      score += Math.round(RelationshipHelper.averageConfidence(strategies) * 0.10);
    }

    score = Math.max(0, Math.min(100, score));

    return {
      score,
      reasoning: `Expected engagement = base(20) + overallConfidence(${overallConf})×0.20 + rapportScore(${rapport.overallRapportScore})×0.30 + opportunities(${oppCount}×5, capped at 20) + avgStrategyConfidence×0.10 = ${score}.`,
    };
  }

  // ── Follow-up Potential ─────────────────────────────

  private computeFollowUpPotential(
    report: ExecutiveIntelligenceReport,
    followUps: { confidence: number }[],
  ): { score: number; reasoning: string } {
    const hasTimeline = RelationshipHelper.hasTimeline(report);
    const hasPriorities = RelationshipHelper.hasStrategicPriorities(report);
    const hasInterests = RelationshipHelper.hasBusinessInterests(report);
    const influence = report.persona.influenceLevel;

    let score = 25;
    if (hasTimeline) score += 15;
    if (hasPriorities) score += 15;
    if (hasInterests) score += 15;
    if (influence.value === 'Industry Leader' || influence.value === 'Sector Influencer') score += 15;

    if (followUps.length > 0) {
      const grounded = followUps.filter((f) => f.confidence > 0).length;
      score += Math.round((grounded / followUps.length) * 15);
    }

    score = Math.max(0, Math.min(100, score));

    return {
      score,
      reasoning: `Follow-up potential = base(25) + timeline(${hasTimeline ? 15 : 0}) + priorities(${hasPriorities ? 15 : 0}) + interests(${hasInterests ? 15 : 0}) + influence(${influence.value}) + groundedFollowUps×15 = ${score}.`,
    };
  }
}
