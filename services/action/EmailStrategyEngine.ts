import type { ExecutiveIntelligenceReport } from '../intelligence/IntelligenceTypes';
import type { RelationshipIntelligenceReport } from '../relationship/RelationshipTypes';
import type { StrategicDecisionReport } from '../decision/DecisionTypes';
import type { EmailStrategy, EmailTone, EmailCallToAction, FollowUpStyle } from './ActionTypes';
import { ActionHelper } from './ActionHelper';

/*
 * EmailStrategyEngine — generates email outreach strategy.
 *
 * Does NOT generate email text. Generates only strategy parameters:
 *   tone, openingAngle, coreValueProposition, executiveInterests,
 *   topicsToHighlight, topicsToAvoid, callToAction, followUpStyle
 *
 * Consumes MP4, MP5, and MP6 public interfaces.
 * Every recommendation is evidence-grounded.
 * Returns Unknown when insufficient evidence.
 */

export class EmailStrategyEngine {
  generate(
    execReport: ExecutiveIntelligenceReport,
    relReport: RelationshipIntelligenceReport,
    decisionReport: StrategicDecisionReport,
  ): EmailStrategy {
    if (ActionHelper.isInsufficientEvidence(execReport, relReport, decisionReport)) {
      return this.unknownStrategy();
    }

    const tone = this.determineTone(execReport, relReport);
    const openingAngle = this.buildOpeningAngle(execReport, relReport, decisionReport);
    const coreValueProposition = this.buildValueProposition(execReport, relReport, decisionReport);
    const executiveInterests = this.deriveInterests(execReport);
    const topicsToHighlight = this.deriveHighlightTopics(execReport, relReport, decisionReport);
    const topicsToAvoid = this.deriveAvoidTopics(execReport, relReport);
    const callToAction = this.determineCallToAction(decisionReport, relReport);
    const followUpStyle = this.determineFollowUpStyle(execReport, relReport);

    const factIds = [
      ...execReport.persona.communicationStyle.factIds,
      ...execReport.persona.businessInterests.flatMap((b) => b.factIds).slice(0, 5),
      ...relReport.relationshipProfile.citations.factIds,
      ...decisionReport.inviteRecommendation.factIds,
    ];
    const sourceIds = [
      ...execReport.persona.communicationStyle.sourceIds,
      ...execReport.persona.businessInterests.flatMap((b) => b.sourceIds).slice(0, 5),
      ...relReport.relationshipProfile.citations.sourceIds,
      ...decisionReport.inviteRecommendation.sourceIds,
    ];

    const confidence = ActionHelper.clampConfidence(
      ActionHelper.mergeConfidence([
        { confidence: execReport.persona.communicationStyle.confidence },
        { confidence: relReport.confidenceSummary.overallConfidence },
        { confidence: decisionReport.inviteRecommendation.confidence },
      ]),
    );

    return {
      tone,
      openingAngle,
      coreValueProposition,
      executiveInterests,
      topicsToHighlight,
      topicsToAvoid,
      callToAction,
      followUpStyle,
      confidence,
      reasoning: `Email strategy derived from communication style "${ActionHelper.communicationStyle(execReport)}", relationship stage "${ActionHelper.relationshipStage(relReport)}", and invite decision "${decisionReport.inviteRecommendation.decision}". Tone: ${tone}, CTA: ${callToAction}.`,
      factIds,
      sourceIds,
    };
  }

  private determineTone(
    execReport: ExecutiveIntelligenceReport,
    relReport: RelationshipIntelligenceReport,
  ): EmailTone {
    const commStyle = ActionHelper.communicationStyle(execReport);
    const stage = ActionHelper.relationshipStage(relReport);

    if (ActionHelper.isUnknown(commStyle)) return 'Professional';

    if (commStyle === 'Direct') return 'Direct';
    if (commStyle === 'Analytical' || commStyle === 'Data-driven') return 'Professional';
    if (commStyle === 'Visionary') return 'Consultative';
    if (commStyle === 'Collaborative') return 'Warm Professional';
    if (commStyle === 'Diplomatic') return 'Formal';
    if (commStyle === 'Storytelling') return 'Warm Professional';

    if (stage === 'Strategic' || stage === 'Established') return 'Warm Professional';

    return 'Professional';
  }

  private buildOpeningAngle(
    execReport: ExecutiveIntelligenceReport,
    relReport: RelationshipIntelligenceReport,
    decisionReport: StrategicDecisionReport,
  ): string {
    const stage = ActionHelper.relationshipStage(relReport);
    const industry = ActionHelper.industryFocus(execReport);
    const topRoles = ActionHelper.topOpportunityRoles(decisionReport);

    if (stage === 'First Contact' || stage === 'Unknown') {
      if (!ActionHelper.isUnknown(industry)) {
        return `Open with a reference to a recent development in ${industry} that aligns with ${execReport.contact.name}'s strategic priorities.`;
      }
      return `Open with a personalized reference to ${execReport.contact.name}'s role at ${execReport.contact.company} and their professional background.`;
    }

    if (topRoles.length > 0) {
      return `Open by referencing the ${topRoles[0]} opportunity identified through shared interests in ${decisionReport.event.name}.`;
    }

    return `Open by acknowledging the existing ${stage} relationship and referencing previous interactions or shared context.`;
  }

  private buildValueProposition(
    execReport: ExecutiveIntelligenceReport,
    relReport: RelationshipIntelligenceReport,
    decisionReport: StrategicDecisionReport,
  ): string {
    const archetype = ActionHelper.archetype(execReport);
    const topBenefit = decisionReport.strategicBenefits[0];
    const topOpp = decisionReport.opportunityAnalysis
      .filter((o) => o.matchScore >= 50)
      .sort((a, b) => b.matchScore - a.matchScore)[0];

    if (topBenefit) {
      return `Value proposition centered on: ${topBenefit.benefit}. This aligns with ${execReport.contact.name}'s ${archetype} archetype and the ${topOpp?.role ?? 'collaboration'} opportunity.`;
    }

    const priorities = ActionHelper.strategicPriorityValues(execReport).slice(0, 2);
    if (priorities.length > 0) {
      return `Value proposition: help ${execReport.contact.name} advance ${priorities.join(' and ')} through collaboration around ${decisionReport.event.name}.`;
    }

    return `Value proposition: connect ${execReport.contact.name} with relevant industry insights and networking opportunities through ${decisionReport.event.name}.`;
  }

  private deriveInterests(execReport: ExecutiveIntelligenceReport): string[] {
    const interests: string[] = [];

    const businessInterests = execReport.persona.businessInterests
      .filter((b) => b.confidence >= 30)
      .slice(0, 4)
      .map((b) => b.value);
    interests.push(...businessInterests);

    const tech = ActionHelper.technologyInterest(execReport);
    if (!ActionHelper.isUnknown(tech)) {
      interests.push(tech);
    }

    const priorities = execReport.persona.strategicPriorities
      .filter((p) => p.confidence >= 40)
      .slice(0, 2)
      .map((p) => p.value);
    interests.push(...priorities);

    return Array.from(new Set(interests));
  }

  private deriveHighlightTopics(
    execReport: ExecutiveIntelligenceReport,
    relReport: RelationshipIntelligenceReport,
    decisionReport: StrategicDecisionReport,
  ): string[] {
    const topics: string[] = [];

    // Event themes that align
    if (decisionReport.eventFit.overallFitScore >= 50) {
      const fitDims = decisionReport.eventFit.dimensions.filter((d) => d.score >= 50);
      for (const dim of fitDims.slice(0, 3)) {
        topics.push(dim.dimension);
      }
    }

    // Strategic benefits
    for (const benefit of decisionReport.strategicBenefits.slice(0, 2)) {
      topics.push(benefit.benefit);
    }

    // High-alignment items from MP5
    const alignments = relReport.alignmentAnalysis.filter((a) => a.alignmentScore >= 50);
    for (const align of alignments.slice(0, 2)) {
      topics.push(...align.matchedItems.slice(0, 1));
    }

    // Conversation starters with high confidence
    const starters = relReport.conversationStarters
      .filter((s) => s.confidence >= 50)
      .slice(0, 2)
      .map((s) => s.topic);
    topics.push(...starters);

    return Array.from(new Set(topics));
  }

  private deriveAvoidTopics(
    execReport: ExecutiveIntelligenceReport,
    relReport: RelationshipIntelligenceReport,
  ): string[] {
    const avoid: string[] = [];

    // Relationship risks identify sensitive topics
    const sensitiveRisks = relReport.risks.filter((r) => r.type === 'sensitive_topics');
    for (const risk of sensitiveRisks) {
      avoid.push(risk.description);
    }

    // Decision risks
    const orgMismatch = execReport.risks.filter((r) => r.type === 'contradiction');
    for (const risk of orgMismatch) {
      avoid.push(risk.value);
    }

    // Always avoid these
    avoid.push('Direct competitor comparisons');
    avoid.push('Pricing discussions in initial outreach');
    avoid.push('Unverified claims about their company');

    return Array.from(new Set(avoid));
  }

  private determineCallToAction(
    decisionReport: StrategicDecisionReport,
    relReport: RelationshipIntelligenceReport,
  ): EmailCallToAction {
    const invite = decisionReport.inviteRecommendation.decision;
    const readiness = ActionHelper.engagementReadiness(relReport);

    if (invite === 'Invite Immediately' || invite === 'Invite') {
      if (readiness === 'Ready' || readiness === 'Highly Ready') {
        return 'Schedule Meeting';
      }
      return 'RSVP to Event';
    }

    if (invite === 'Invite Later' || invite === 'Observe') {
      return 'Share Resources';
    }

    if (invite === 'Do Not Invite') {
      return 'None';
    }

    return 'Unknown';
  }

  private determineFollowUpStyle(
    execReport: ExecutiveIntelligenceReport,
    relReport: RelationshipIntelligenceReport,
  ): FollowUpStyle {
    const commStyle = ActionHelper.communicationStyle(execReport);
    const responsiveness = relReport.rapport.expectedResponsiveness;

    if (responsiveness === 'Low') return 'Persistent';
    if (responsiveness === 'High') return 'Gentle';

    if (commStyle === 'Direct') return 'Measured';
    if (commStyle === 'Collaborative' || commStyle === 'Diplomatic') return 'Strategic';

    if (relReport.relationshipProfile.stage === 'Strategic' || relReport.relationshipProfile.stage === 'Established') {
      return 'Strategic';
    }

    return 'Measured';
  }

  private unknownStrategy(): EmailStrategy {
    return {
      tone: 'Unknown',
      openingAngle: 'Unknown',
      coreValueProposition: 'Unknown',
      executiveInterests: [],
      topicsToHighlight: [],
      topicsToAvoid: [],
      callToAction: 'Unknown',
      followUpStyle: 'Unknown',
      confidence: 0,
      reasoning: ActionHelper.insufficientReasoning(),
      factIds: [],
      sourceIds: [],
    };
  }
}
