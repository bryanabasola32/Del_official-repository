import type { ExecutiveIntelligenceReport } from '../intelligence/IntelligenceTypes';
import type { FollowUpRecommendation, FollowUpPhase } from './RelationshipTypes';
import { RelationshipHelper } from './RelationshipHelper';

/*
 * FollowUpEngine — generates follow-up recommendations across five phases.
 *
 * Every recommendation cites supporting evidence from the MP4 report.
 * If evidence is insufficient for a phase, the phase returns an "Unknown"
 * recommendation with confidence = 0.
 */

export class FollowUpEngine {
  generate(report: ExecutiveIntelligenceReport): FollowUpRecommendation[] {
    const recommendations: FollowUpRecommendation[] = [];

    recommendations.push(...this.beforeEvent(report));
    recommendations.push(...this.duringEvent(report));
    recommendations.push(...this.immediatelyAfter(report));
    recommendations.push(...this.oneWeekLater(report));
    recommendations.push(...this.longTerm(report));

    return recommendations;
  }

  // ── Before Event ──────────────────────────────────

  private beforeEvent(report: ExecutiveIntelligenceReport): FollowUpRecommendation[] {
    const recs: FollowUpRecommendation[] = [];
    const overallConf = RelationshipHelper.overallConfidence(report);

    if (overallConf >= 30 && RelationshipHelper.hasBusinessInterests(report)) {
      const topInterest = report.persona.businessInterests[0];
      recs.push({
        phase: 'Before Event',
        action: `Send ${report.contact.name} a brief on DEL's work related to ${topInterest.value} to establish common ground before the event`,
        reasoning: `The executive's top business interest is "${topInterest.value}" with ${topInterest.confidence}% confidence. Pre-event outreach aligned to this interest increases the likelihood of meaningful engagement.`,
        confidence: Math.min(80, topInterest.confidence),
        citations: RelationshipHelper.collectFromInferences([topInterest]),
      });
    }

    if (RelationshipHelper.hasStrategicPriorities(report)) {
      const topPriority = report.persona.strategicPriorities[0];
      recs.push({
        phase: 'Before Event',
        action: `Prepare a one-page summary connecting DEL's mission to ${report.contact.name}'s strategic priority: ${topPriority.value}`,
        reasoning: `The executive's top strategic priority is "${topPriority.value}" with ${topPriority.confidence}% confidence. Aligning DEL's value proposition to this priority before the event creates a stronger foundation for the conversation.`,
        confidence: Math.min(75, topPriority.confidence),
        citations: RelationshipHelper.collectFromInferences([topPriority]),
      });
    }

    if (recs.length === 0) {
      recs.push({
        phase: 'Before Event',
        action: 'Unknown',
        reasoning: 'Insufficient evidence to generate a pre-event follow-up recommendation. No business interests or strategic priorities with sufficient confidence were found.',
        confidence: 0,
        citations: RelationshipHelper.emptyCitation(),
      });
    }

    return recs;
  }

  // ── During Event ──────────────────────────────────

  private duringEvent(report: ExecutiveIntelligenceReport): FollowUpRecommendation[] {
    const recs: FollowUpRecommendation[] = [];

    if (RelationshipHelper.hasOpportunities(report)) {
      const topOpp = report.opportunities[0];
      recs.push({
        phase: 'During Event',
        action: `Introduce ${topOpp.value} as a conversation topic during the event`,
        reasoning: `The top identified opportunity is "${topOpp.value}" (${topOpp.type}) with ${topOpp.confidence}% confidence. This provides a natural, evidence-grounded conversation topic for the event.`,
        confidence: Math.min(80, topOpp.confidence),
        citations: RelationshipHelper.collectFromInferences([topOpp]),
      });
    }

    const networkingStyle = RelationshipHelper.networkingStyle(report);
    if (networkingStyle === 'Relationship Builder' || networkingStyle === 'Strategic Networker') {
      recs.push({
        phase: 'During Event',
        action: `Facilitate introductions to other executives — ${report.contact.name}'s "${networkingStyle}" style supports group networking`,
        reasoning: `Networking style is "${networkingStyle}" with ${report.persona.networkingStyle.confidence}% confidence. This style supports and benefits from facilitated group introductions during events.`,
        confidence: Math.min(85, report.persona.networkingStyle.confidence),
        citations: RelationshipHelper.collectFromInferences([report.persona.networkingStyle]),
      });
    }

    if (recs.length === 0) {
      recs.push({
        phase: 'During Event',
        action: 'Unknown',
        reasoning: 'Insufficient evidence to generate a during-event follow-up recommendation. No opportunities or networking style with sufficient confidence were found.',
        confidence: 0,
        citations: RelationshipHelper.emptyCitation(),
      });
    }

    return recs;
  }

  // ── Immediately After ─────────────────────────────

  private immediatelyAfter(report: ExecutiveIntelligenceReport): FollowUpRecommendation[] {
    const recs: FollowUpRecommendation[] = [];

    if (RelationshipHelper.hasBusinessInterests(report)) {
      const topInterest = report.persona.businessInterests[0];
      recs.push({
        phase: 'Immediately After',
        action: `Send a personalized thank-you note referencing the discussion about ${topInterest.value}`,
        reasoning: `The executive's top business interest is "${topInterest.value}" with ${topInterest.confidence}% confidence. Referencing this in a post-event thank-you reinforces the connection.`,
        confidence: Math.min(80, topInterest.confidence),
        citations: RelationshipHelper.collectFromInferences([topInterest]),
      });
    }

    if (report.timeline.some((t) => t.type === 'speaking')) {
      const speakingEntry = report.timeline.find((t) => t.type === 'speaking');
      if (speakingEntry) {
        recs.push({
          phase: 'Immediately After',
          action: `Reference ${report.contact.name}'s speaking topic "${speakingEntry.title}" in the follow-up message`,
          reasoning: `The executive has a speaking engagement ("${speakingEntry.title}") in the timeline with ${speakingEntry.confidence}% confidence. Referencing their speaking topic demonstrates attentiveness.`,
          confidence: Math.min(85, speakingEntry.confidence),
          citations: RelationshipHelper.collectFromInferences([speakingEntry]),
        });
      }
    }

    if (recs.length === 0) {
      recs.push({
        phase: 'Immediately After',
        action: 'Unknown',
        reasoning: 'Insufficient evidence to generate an immediate post-event follow-up recommendation.',
        confidence: 0,
        citations: RelationshipHelper.emptyCitation(),
      });
    }

    return recs;
  }

  // ── One Week Later ────────────────────────────────

  private oneWeekLater(report: ExecutiveIntelligenceReport): FollowUpRecommendation[] {
    const recs: FollowUpRecommendation[] = [];

    if (RelationshipHelper.hasStrategicPriorities(report)) {
      const topPriority = report.persona.strategicPriorities[0];
      recs.push({
        phase: 'One Week Later',
        action: `Share a relevant article or resource related to ${topPriority.value}`,
        reasoning: `The executive's top strategic priority is "${topPriority.value}" with ${topPriority.confidence}% confidence. Sharing a resource one week after the event sustains engagement around their priorities.`,
        confidence: Math.min(75, topPriority.confidence),
        citations: RelationshipHelper.collectFromInferences([topPriority]),
      });
    }

    if (RelationshipHelper.hasOpportunities(report)) {
      const partnershipOpp = report.opportunities.find((o) => o.type === 'partnership');
      if (partnershipOpp) {
        recs.push({
          phase: 'One Week Later',
          action: `Propose a follow-up meeting to explore the partnership opportunity: ${partnershipOpp.value}`,
          reasoning: `A partnership opportunity ("${partnershipOpp.value}") was identified with ${partnershipOpp.confidence}% confidence. A one-week follow-up to propose a deeper discussion is appropriate.`,
          confidence: Math.min(80, partnershipOpp.confidence),
          citations: RelationshipHelper.collectFromInferences([partnershipOpp]),
        });
      }
    }

    if (recs.length === 0) {
      recs.push({
        phase: 'One Week Later',
        action: 'Unknown',
        reasoning: 'Insufficient evidence to generate a one-week follow-up recommendation. No strategic priorities or partnership opportunities with sufficient confidence were found.',
        confidence: 0,
        citations: RelationshipHelper.emptyCitation(),
      });
    }

    return recs;
  }

  // ── Long-term Relationship ────────────────────────

  private longTerm(report: ExecutiveIntelligenceReport): FollowUpRecommendation[] {
    const recs: FollowUpRecommendation[] = [];

    const influence = RelationshipHelper.influenceLevel(report);
    if (influence === 'Industry Leader' || influence === 'Sector Influencer') {
      recs.push({
        phase: 'Long-term Relationship',
        action: `Invite ${report.contact.name} to join DEL's advisory board or speaker faculty as a ${influence}`,
        reasoning: `Influence level is "${influence}" with ${report.persona.influenceLevel.confidence}% confidence. Industry leaders and sector influencers are strong candidates for long-term strategic relationships.`,
        confidence: Math.min(85, report.persona.influenceLevel.confidence),
        citations: RelationshipHelper.collectFromInferences([report.persona.influenceLevel]),
      });
    }

    if (RelationshipHelper.hasOpportunities(report)) {
      const innovationOpp = report.opportunities.find((o) => o.type === 'innovation' || o.type === 'ai_adoption' || o.type === 'technology_adoption');
      if (innovationOpp) {
        recs.push({
          phase: 'Long-term Relationship',
          action: `Co-develop an innovation initiative around ${innovationOpp.value}`,
          reasoning: `An innovation/technology opportunity ("${innovationOpp.value}") was identified with ${innovationOpp.confidence}% confidence. Long-term co-development of innovation initiatives creates sustained mutual value.`,
          confidence: Math.min(80, innovationOpp.confidence),
          citations: RelationshipHelper.collectFromInferences([innovationOpp]),
        });
      }
    }

    if (RelationshipHelper.allEventThemes(report).length > 0) {
      const themes = RelationshipHelper.allEventThemes(report);
      recs.push({
        phase: 'Long-term Relationship',
        action: `Maintain ongoing engagement through DEL events themed around ${themes.slice(0, 2).join(' and ')}`,
        reasoning: `${themes.length} event theme(s) were derived from the executive's opportunities. Ongoing event-based engagement sustains the long-term relationship.`,
        confidence: Math.min(75, RelationshipHelper.averageConfidence(report.opportunities)),
        citations: RelationshipHelper.collectFromInferences(report.opportunities),
      });
    }

    if (recs.length === 0) {
      recs.push({
        phase: 'Long-term Relationship',
        action: 'Unknown',
        reasoning: 'Insufficient evidence to generate a long-term relationship recommendation. No influence level, innovation opportunities, or event themes with sufficient confidence were found.',
        confidence: 0,
        citations: RelationshipHelper.emptyCitation(),
      });
    }

    return recs;
  }
}
