import type { ExecutiveIntelligenceReport } from '../intelligence/IntelligenceTypes';
import type { RapportAssessment, CompatibilityLevel } from './RelationshipTypes';
import { RelationshipHelper } from './RelationshipHelper';

/*
 * RapportEngine — estimates communication, engagement, networking
 * compatibility, and expected responsiveness.
 *
 * Everything is deterministic — derived from the MP4 report's persona,
 * confidence, and evidence quality. No external calls.
 */

export class RapportEngine {
  assess(report: ExecutiveIntelligenceReport): RapportAssessment {
    const comm = this.assessCommunication(report);
    const eng = this.assessEngagement(report);
    const net = this.assessNetworking(report);
    const resp = this.assessResponsiveness(report);

    const overall = Math.round(
      (comm.score + eng.score + net.score + resp.score) / 4,
    );

    const allCitations = [
      report.persona.communicationStyle,
      report.persona.networkingStyle,
      report.persona.influenceLevel,
      report.persona.decisionStyle,
      ...report.persona.businessInterests,
      ...report.opportunities,
    ];

    return {
      communicationCompatibility: comm.level,
      communicationScore: comm.score,
      communicationReasoning: comm.reasoning,
      engagementCompatibility: eng.level,
      engagementScore: eng.score,
      engagementReasoning: eng.reasoning,
      networkingCompatibility: net.level,
      networkingScore: net.score,
      networkingReasoning: net.reasoning,
      expectedResponsiveness: resp.level,
      responsivenessScore: resp.score,
      responsivenessReasoning: resp.reasoning,
      overallRapportScore: overall,
      citations: RelationshipHelper.collectFromInferences(allCitations),
    };
  }

  // ── Communication Compatibility ───────────────────

  private assessCommunication(report: ExecutiveIntelligenceReport): {
    level: CompatibilityLevel;
    score: number;
    reasoning: string;
  } {
    const style = report.persona.communicationStyle;
    const overallConf = RelationshipHelper.overallConfidence(report);

    if (style.value === 'Unknown' || overallConf === 0) {
      return {
        level: 'Unknown',
        score: 0,
        reasoning: 'Communication style is Unknown. Cannot assess communication compatibility.',
      };
    }

    let score = 40;

    if (style.value === 'Direct' || style.value === 'Analytical' || style.value === 'Data-driven') {
      score += 25;
    } else if (style.value === 'Collaborative' || style.value === 'Diplomatic') {
      score += 20;
    } else if (style.value === 'Visionary' || style.value === 'Storytelling') {
      score += 15;
    }

    score += Math.round(style.confidence * 0.2);
    score = Math.min(100, score);

    const level: CompatibilityLevel = score >= 70 ? 'High' : score >= 45 ? 'Moderate' : 'Low';

    return {
      level,
      score,
      reasoning: `Communication style is "${style.value}" with ${style.confidence}% confidence. This style yields ${level.toLowerCase()} communication compatibility (score: ${score}/100).`,
    };
  }

  // ── Engagement Compatibility ───────────────────────

  private assessEngagement(report: ExecutiveIntelligenceReport): {
    level: CompatibilityLevel;
    score: number;
    reasoning: string;
  } {
    const hasOpps = RelationshipHelper.hasOpportunities(report);
    const hasPriorities = RelationshipHelper.hasStrategicPriorities(report);
    const hasInterests = RelationshipHelper.hasBusinessInterests(report);
    const overallConf = RelationshipHelper.overallConfidence(report);

    if (overallConf === 0) {
      return {
        level: 'Unknown',
        score: 0,
        reasoning: 'No evidence base. Cannot assess engagement compatibility.',
      };
    }

    let score = 30;
    if (hasOpps) score += 25;
    if (hasPriorities) score += 20;
    if (hasInterests) score += 15;
    score += Math.round(overallConf * 0.1);
    score = Math.min(100, score);

    const level: CompatibilityLevel = score >= 70 ? 'High' : score >= 45 ? 'Moderate' : 'Low';

    return {
      level,
      score,
      reasoning: `Engagement compatibility is ${level.toLowerCase()} (score: ${score}/100). Contributing factors: ${hasOpps ? `${report.opportunities.length} opportunities` : 'no opportunities'}, ${hasPriorities ? `${report.persona.strategicPriorities.length} strategic priorities` : 'no strategic priorities'}, ${hasInterests ? `${report.persona.businessInterests.length} business interests` : 'no business interests'}, overall confidence ${overallConf}%.`,
    };
  }

  // ── Networking Compatibility ──────────────────────

  private assessNetworking(report: ExecutiveIntelligenceReport): {
    level: CompatibilityLevel;
    score: number;
    reasoning: string;
  } {
    const ns = report.persona.networkingStyle;
    const il = report.persona.influenceLevel;
    const overallConf = RelationshipHelper.overallConfidence(report);

    if (ns.value === 'Unknown' || overallConf === 0) {
      return {
        level: 'Unknown',
        score: 0,
        reasoning: 'Networking style is Unknown. Cannot assess networking compatibility.',
      };
    }

    let score = 35;

    if (ns.value === 'Relationship Builder' || ns.value === 'Strategic Networker') {
      score += 30;
    } else if (ns.value === 'Community Builder') {
      score += 25;
    } else if (ns.value === 'Reserved') {
      score += 5;
    }

    if (il.value === 'Industry Leader' || il.value === 'Sector Influencer') {
      score += 15;
    } else if (il.value === 'Company Leader') {
      score += 10;
    }

    score += Math.round(ns.confidence * 0.1);
    score = Math.min(100, score);

    const level: CompatibilityLevel = score >= 70 ? 'High' : score >= 45 ? 'Moderate' : 'Low';

    return {
      level,
      score,
      reasoning: `Networking style is "${ns.value}" with influence level "${il.value}". Networking compatibility is ${level.toLowerCase()} (score: ${score}/100).`,
    };
  }

  // ── Expected Responsiveness ────────────────────────

  private assessResponsiveness(report: ExecutiveIntelligenceReport): {
    level: CompatibilityLevel;
    score: number;
    reasoning: string;
  } {
    const ns = report.persona.networkingStyle;
    const comm = report.persona.communicationStyle;
    const overallConf = RelationshipHelper.overallConfidence(report);
    const highRisks = report.risks.filter((r) => r.severity === 'high').length;

    if (overallConf === 0) {
      return {
        level: 'Unknown',
        score: 0,
        reasoning: 'No evidence base. Cannot assess expected responsiveness.',
      };
    }

    let score = 35;

    if (ns.value === 'Relationship Builder' || ns.value === 'Strategic Networker') {
      score += 25;
    } else if (ns.value === 'Community Builder') {
      score += 20;
    } else if (ns.value === 'Reserved') {
      score -= 10;
    }

    if (comm.value === 'Direct' || comm.value === 'Collaborative') {
      score += 15;
    }

    if (highRisks > 0) {
      score -= highRisks * 10;
    }

    score += Math.round(overallConf * 0.1);
    score = Math.max(0, Math.min(100, score));

    const level: CompatibilityLevel = score >= 70 ? 'High' : score >= 45 ? 'Moderate' : 'Low';

    return {
      level,
      score,
      reasoning: `Expected responsiveness is ${level.toLowerCase()} (score: ${score}/100). Networking style "${ns.value}", communication style "${comm.value}", ${highRisks} high-severity risk(s), overall confidence ${overallConf}%.`,
    };
  }
}
