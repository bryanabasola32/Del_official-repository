import type { ExecutiveIntelligenceReport } from '../intelligence/IntelligenceTypes';
import type {
  RelationshipProfile,
  RelationshipStage,
  EngagementReadiness,
  InteractionDepth,
  NetworkingPotential,
} from './RelationshipTypes';
import { RelationshipHelper } from './RelationshipHelper';

/*
 * RelationshipProfileEngine — determines the relationship stage and engagement readiness.
 *
 * Derives everything from the ExecutiveIntelligenceReport (MP4).
 * Never invents data — returns "Unknown" when evidence is insufficient.
 */

export class RelationshipProfileEngine {
  buildProfile(report: ExecutiveIntelligenceReport): RelationshipProfile {
    const stage = this.determineStage(report);
    const readiness = this.determineReadiness(report);
    const depth = this.determineInteractionDepth(report);
    const networking = this.determineNetworkingPotential(report);

    const allInferences = [
      report.persona.leadershipStyle,
      report.persona.communicationStyle,
      report.persona.decisionStyle,
      report.persona.networkingStyle,
      report.persona.influenceLevel,
      report.persona.innovationOrientation,
      ...report.persona.strategicPriorities,
      ...report.persona.businessInterests,
      ...report.opportunities,
    ];

    const citations = RelationshipHelper.collectFromInferences(allInferences);

    return {
      stage: stage.value,
      stageConfidence: stage.confidence,
      stageReasoning: stage.reasoning,
      engagementReadiness: readiness.value,
      readinessConfidence: readiness.confidence,
      readinessReasoning: readiness.reasoning,
      preferredInteractionDepth: depth.value,
      depthConfidence: depth.confidence,
      depthReasoning: depth.reasoning,
      networkingPotential: networking.value,
      networkingConfidence: networking.confidence,
      networkingReasoning: networking.reasoning,
      citations,
    };
  }

  // ── Relationship Stage ────────────────────────────

  private determineStage(report: ExecutiveIntelligenceReport): {
    value: RelationshipStage;
    confidence: number;
    reasoning: string;
  } {
    const overallConf = RelationshipHelper.overallConfidence(report);
    const factCount = RelationshipHelper.totalFacts(report);
    const sourceCount = RelationshipHelper.totalSources(report);
    const hasPriorities = RelationshipHelper.hasStrategicPriorities(report);
    const hasInterests = RelationshipHelper.hasBusinessInterests(report);
    const hasOpps = RelationshipHelper.hasOpportunities(report);
    const hasTimeline = RelationshipHelper.hasTimeline(report);

    if (factCount === 0 || overallConf === 0) {
      return {
        value: 'Unknown',
        confidence: 0,
        reasoning: 'No evidence base available. Relationship stage cannot be determined.',
      };
    }

    if (overallConf >= 70 && sourceCount >= 5 && hasPriorities && hasInterests && hasOpps && hasTimeline) {
      return {
        value: 'Strategic',
        confidence: Math.min(95, overallConf + 10),
        reasoning: `Overall confidence is ${overallConf}% with ${sourceCount} sources, ${factCount} facts, ${report.persona.strategicPriorities.length} strategic priorities, ${report.persona.businessInterests.length} business interests, ${report.opportunities.length} opportunities, and ${report.timeline.length} timeline entries. This depth of intelligence supports a Strategic relationship stage.`,
      };
    }

    if (overallConf >= 55 && sourceCount >= 3 && (hasPriorities || hasInterests) && hasOpps) {
      return {
        value: 'Established',
        confidence: Math.min(85, overallConf + 5),
        reasoning: `Overall confidence is ${overallConf}% with ${sourceCount} sources and ${factCount} facts. Strategic priorities and/or business interests are identified with ${report.opportunities.length} opportunities. Sufficient evidence for an Established relationship stage.`,
      };
    }

    if (overallConf >= 40 && sourceCount >= 2 && (hasPriorities || hasInterests || hasOpps)) {
      return {
        value: 'Developing',
        confidence: Math.min(75, overallConf),
        reasoning: `Overall confidence is ${overallConf}% with ${sourceCount} sources and ${factCount} facts. Some strategic priorities, business interests, or opportunities are identified. Evidence supports a Developing relationship stage.`,
      };
    }

    if (overallConf >= 25 && factCount >= 3) {
      return {
        value: 'Initial Connection',
        confidence: Math.min(60, overallConf),
        reasoning: `Overall confidence is ${overallConf}% with ${factCount} facts from ${sourceCount} source(s). Limited but non-zero evidence. An Initial Connection stage is appropriate.`,
      };
    }

    if (factCount > 0) {
      return {
        value: 'First Contact',
        confidence: Math.min(40, overallConf),
        reasoning: `Only ${factCount} fact(s) from ${sourceCount} source(s) with ${overallConf}% confidence. Evidence is minimal — a First Contact stage is the most that can be supported.`,
      };
    }

    return {
      value: 'Unknown',
      confidence: 0,
      reasoning: 'Insufficient evidence to determine relationship stage.',
    };
  }

  // ── Engagement Readiness ───────────────────────────

  private determineReadiness(report: ExecutiveIntelligenceReport): {
    value: EngagementReadiness;
    confidence: number;
    reasoning: string;
  } {
    const overallConf = RelationshipHelper.overallConfidence(report);
    const hasNetworking = RelationshipHelper.hasKnownNetworkingStyle(report);
    const hasComm = RelationshipHelper.hasKnownCommunicationStyle(report);
    const hasInfluence = RelationshipHelper.hasKnownInfluenceLevel(report);
    const hasPriorities = RelationshipHelper.hasStrategicPriorities(report);
    const hasInterests = RelationshipHelper.hasBusinessInterests(report);
    const hasOpps = RelationshipHelper.hasOpportunities(report);
    const sourceRiskCount = RelationshipHelper.sourceRiskCount(report);

    if (overallConf === 0) {
      return {
        value: 'Unknown',
        confidence: 0,
        reasoning: 'No evidence base. Engagement readiness cannot be determined.',
      };
    }

    const knownAttributes = [hasNetworking, hasComm, hasInfluence, hasPriorities, hasInterests, hasOpps].filter(Boolean).length;
    const highRiskCount = report.risks.filter((r) => r.severity === 'high').length;

    if (highRiskCount > 2) {
      return {
        value: 'Not Ready',
        confidence: 90,
        reasoning: `${highRiskCount} high-severity risk(s) detected in the source intelligence report. Engagement should be deferred until evidence quality improves.`,
      };
    }

    if (overallConf >= 65 && knownAttributes >= 5 && highRiskCount === 0) {
      return {
        value: 'Highly Ready',
        confidence: Math.min(90, overallConf + 5),
        reasoning: `Overall confidence is ${overallConf}% with ${knownAttributes}/6 key attributes known and no high-severity risks. The executive is highly ready for engagement.`,
      };
    }

    if (overallConf >= 45 && knownAttributes >= 3) {
      return {
        value: 'Ready',
        confidence: Math.min(80, overallConf),
        reasoning: `Overall confidence is ${overallConf}% with ${knownAttributes}/6 key attributes known. Sufficient evidence to proceed with engagement.`,
      };
    }

    if (overallConf >= 25 && knownAttributes >= 1) {
      return {
        value: 'Tentative',
        confidence: Math.min(55, overallConf),
        reasoning: `Overall confidence is ${overallConf}% with only ${knownAttributes}/6 key attributes known. Engagement is possible but should be tentative and exploratory. ${sourceRiskCount} risk(s) detected.`,
      };
    }

    return {
      value: 'Not Ready',
      confidence: 80,
      reasoning: `Overall confidence is ${overallConf}% with ${knownAttributes}/6 key attributes known. Insufficient evidence for meaningful engagement.`,
    };
  }

  // ── Interaction Depth ──────────────────────────────

  private determineInteractionDepth(report: ExecutiveIntelligenceReport): {
    value: InteractionDepth;
    confidence: number;
    reasoning: string;
  } {
    const overallConf = RelationshipHelper.overallConfidence(report);
    const hasPriorities = RelationshipHelper.hasStrategicPriorities(report);
    const hasInterests = RelationshipHelper.hasBusinessInterests(report);
    const hasOpps = RelationshipHelper.hasOpportunities(report);
    const hasTimeline = RelationshipHelper.hasTimeline(report);
    const priorityCount = report.persona.strategicPriorities.length;
    const interestCount = report.persona.businessInterests.length;
    const oppCount = report.opportunities.length;

    if (overallConf === 0) {
      return {
        value: 'Unknown',
        confidence: 0,
        reasoning: 'No evidence base. Preferred interaction depth cannot be determined.',
      };
    }

    const depthSignals = [hasPriorities, hasInterests, hasOpps, hasTimeline].filter(Boolean).length;
    const totalItems = priorityCount + interestCount + oppCount;

    if (overallConf >= 60 && depthSignals >= 3 && totalItems >= 5) {
      return {
        value: 'Deep',
        confidence: Math.min(85, overallConf),
        reasoning: `Overall confidence ${overallConf}% with ${depthSignals}/4 depth signals and ${totalItems} total items (priorities, interests, opportunities). Supports deep interaction.`,
      };
    }

    if (overallConf >= 35 && depthSignals >= 2) {
      return {
        value: 'Moderate',
        confidence: Math.min(70, overallConf),
        reasoning: `Overall confidence ${overallConf}% with ${depthSignals}/4 depth signals and ${totalItems} total items. Supports moderate interaction depth.`,
      };
    }

    if (overallConf >= 15 && depthSignals >= 1) {
      return {
        value: 'Surface',
        confidence: Math.min(50, overallConf),
        reasoning: `Overall confidence ${overallConf}% with ${depthSignals}/4 depth signals and ${totalItems} total items. Only surface-level interaction is supported.`,
      };
    }

    return {
      value: 'Unknown',
      confidence: 0,
      reasoning: 'Insufficient evidence to determine preferred interaction depth.',
    };
  }

  // ── Networking Potential ──────────────────────────

  private determineNetworkingPotential(report: ExecutiveIntelligenceReport): {
    value: NetworkingPotential;
    confidence: number;
    reasoning: string;
  } {
    const networkingStyle = RelationshipHelper.networkingStyle(report);
    const influenceLevel = RelationshipHelper.influenceLevel(report);
    const overallConf = RelationshipHelper.overallConfidence(report);

    if (overallConf === 0) {
      return {
        value: 'Unknown',
        confidence: 0,
        reasoning: 'No evidence base. Networking potential cannot be determined.',
      };
    }

    const isNetworker =
      networkingStyle === 'Relationship Builder' ||
      networkingStyle === 'Strategic Networker' ||
      networkingStyle === 'Community Builder';
    const isInfluential =
      influenceLevel === 'Industry Leader' ||
      influenceLevel === 'Sector Influencer';

    if (isNetworker && isInfluential) {
      return {
        value: 'High',
        confidence: Math.min(90, overallConf),
        reasoning: `Networking style is "${networkingStyle}" and influence level is "${influenceLevel}". Both indicate high networking potential.`,
      };
    }

    if (isNetworker || isInfluential) {
      return {
        value: 'Moderate',
        confidence: Math.min(70, overallConf),
        reasoning: `Networking style is "${networkingStyle}" and influence level is "${influenceLevel}". One of the two indicators supports networking potential.`,
      };
    }

    if (networkingStyle === 'Reserved' || influenceLevel === 'Emerging Voice') {
      return {
        value: 'Low',
        confidence: Math.min(60, overallConf),
        reasoning: `Networking style is "${networkingStyle}" and influence level is "${influenceLevel}". Both suggest limited networking potential.`,
      };
    }

    return {
      value: 'Unknown',
      confidence: 0,
      reasoning: `Networking style is "${networkingStyle}" and influence level is "${influenceLevel}". Insufficient evidence to assess networking potential.`,
    };
  }
}
