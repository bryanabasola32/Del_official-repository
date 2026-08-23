import type { ExecutiveIntelligenceReport } from '../intelligence/IntelligenceTypes';
import type { RelationshipIntelligenceReport } from '../relationship/RelationshipTypes';
import type { StrategicDecisionReport } from '../decision/DecisionTypes';
import type { MeetingStrategy, MeetingType, MeetingAttendee, MeetingAgendaItem } from './ActionTypes';
import { ActionHelper } from './ActionHelper';

/*
 * MeetingStrategyEngine — designs meeting strategy for executive engagement.
 *
 * Consumes MP4, MP5, and MP6 public interfaces.
 * Produces meeting objective, type, duration, attendees, agenda, outcome, and checklist.
 * Every recommendation includes confidence, reasoning, factIds, sourceIds.
 * Returns Unknown when insufficient evidence.
 */

export class MeetingStrategyEngine {
  generate(
    execReport: ExecutiveIntelligenceReport,
    relReport: RelationshipIntelligenceReport,
    decisionReport: StrategicDecisionReport,
  ): MeetingStrategy {
    if (ActionHelper.isInsufficientEvidence(execReport, relReport, decisionReport)) {
      return this.unknownStrategy();
    }

    const invite = decisionReport.inviteRecommendation.decision;
    const meetingType = this.determineMeetingType(relReport, decisionReport);
    const duration = this.determineDuration(meetingType, execReport, relReport);
    const attendees = this.determineAttendees(execReport, relReport, decisionReport);
    const agenda = this.buildAgenda(execReport, relReport, decisionReport);
    const objective = this.buildObjective(execReport, relReport, decisionReport);
    const desiredOutcome = this.buildDesiredOutcome(execReport, relReport, decisionReport);
    const checklist = this.buildChecklist(execReport, relReport, decisionReport);

    const allItems: { confidence: number; factIds: string[]; sourceIds: string[] }[] = [
      ...agenda,
      { confidence: 0, factIds: [], sourceIds: [] },
    ];
    const confidence = ActionHelper.clampConfidence(
      ActionHelper.mergeConfidence([
        { confidence: ActionHelper.executiveConfidence(execReport) },
        { confidence: ActionHelper.relationshipConfidence(relReport) },
        { confidence: decisionReport.confidenceSummary.overallConfidence },
        ...allItems.map((a) => ({ confidence: a.confidence })),
      ]),
    );

    const citations = ActionHelper.mergeCitations([
      ...agenda,
      { factIds: ActionHelper.collectFactIds(execReport), sourceIds: ActionHelper.collectSourceIds(execReport) },
      { factIds: ActionHelper.collectRelationshipFactIds(relReport), sourceIds: ActionHelper.collectRelationshipSourceIds(relReport) },
    ]);

    return {
      objective,
      meetingType,
      duration,
      recommendedAttendees: attendees,
      agenda,
      desiredOutcome,
      preparationChecklist: checklist,
      confidence,
      reasoning: `Meeting strategy based on invite decision "${invite}", relationship stage "${ActionHelper.relationshipStage(relReport)}", and executive archetype "${ActionHelper.archetype(execReport)}". Meeting type: ${meetingType}, duration: ${duration} minutes.`,
      factIds: citations.factIds,
      sourceIds: citations.sourceIds,
    };
  }

  private determineMeetingType(
    relReport: RelationshipIntelligenceReport,
    decisionReport: StrategicDecisionReport,
  ): MeetingType {
    const stage = relReport.relationshipProfile.stage;
    const topRoles = ActionHelper.topOpportunityRoles(decisionReport);

    if (stage === 'Unknown' || stage === 'First Contact') return 'Introductory Call';
    if (stage === 'Initial Connection') return 'Conference Networking';
    if (topRoles.includes('partner')) return 'Partnership Exploration';
    if (topRoles.includes('investor')) return 'Strategy Discussion';
    if (stage === 'Developing') return 'Executive Briefing';
    if (stage === 'Established' || stage === 'Strategic') return 'Follow-up Meeting';
    if (topRoles.includes('speaker') || topRoles.includes('panelist')) return 'Conference Networking';

    return 'Executive Briefing';
  }

  private determineDuration(
    meetingType: MeetingType,
    execReport: ExecutiveIntelligenceReport,
    _relReport: RelationshipIntelligenceReport,
  ): number {
    switch (meetingType) {
      case 'Introductory Call':
        return 30;
      case 'Conference Networking':
        return 15;
      case 'Executive Briefing':
        return ActionHelper.influenceLevel(execReport) === 'Industry Leader' ? 45 : 30;
      case 'Strategy Discussion':
        return 60;
      case 'Partnership Exploration':
        return 60;
      case 'Follow-up Meeting':
        return 45;
      default:
        return 30;
    }
  }

  private determineAttendees(
    execReport: ExecutiveIntelligenceReport,
    relReport: RelationshipIntelligenceReport,
    decisionReport: StrategicDecisionReport,
  ): MeetingAttendee[] {
    const attendees: MeetingAttendee[] = [
      {
        role: 'Account Manager',
        rationale: 'Primary relationship owner responsible for executive engagement.',
        required: true,
      },
    ];

    const topRoles = ActionHelper.topOpportunityRoles(decisionReport);
    if (topRoles.includes('partner') || topRoles.includes('investor')) {
      attendees.push({
        role: 'Partnership Lead',
        rationale: `Opportunity match for ${topRoles.filter((r) => r === 'partner' || r === 'investor').join('/')} role requires partnership expertise.`,
        required: true,
      });
    }

    if (topRoles.includes('speaker') || topRoles.includes('panelist')) {
      attendees.push({
        role: 'Event Content Lead',
        rationale: 'Content lead needed to discuss speaking or panelist arrangements.',
        required: false,
      });
    }

    const influence = ActionHelper.influenceLevel(execReport);
    if (influence === 'Industry Leader' || influence === 'Sector Influencer') {
      attendees.push({
        role: 'Executive Sponsor',
        rationale: `Executive is ${influence}. Senior representation ensures appropriate peer-level engagement.`,
        required: true,
      });
    }

    if (relReport.relationshipProfile.stage === 'Strategic' || relReport.relationshipProfile.stage === 'Established') {
      attendees.push({
        role: 'Technical SME',
        rationale: 'Established relationship allows deeper technical discussion.',
        required: false,
      });
    }

    return attendees;
  }

  private buildAgenda(
    execReport: ExecutiveIntelligenceReport,
    relReport: RelationshipIntelligenceReport,
    decisionReport: StrategicDecisionReport,
  ): MeetingAgendaItem[] {
    const items: MeetingAgendaItem[] = [];
    const duration = this.determineDuration(
      this.determineMeetingType(relReport, decisionReport),
      execReport,
      relReport,
    );

    // Item 1: Introductions
    items.push({
      topic: 'Introductions and rapport building',
      duration: 5,
      objective: `Establish personal connection with ${execReport.contact.name} based on ${ActionHelper.networkingStyle(execReport)} networking style.`,
      confidence: ActionHelper.clampConfidence(relReport.confidenceSummary.overallConfidence),
      reasoning: `Relationship stage is "${ActionHelper.relationshipStage(relReport)}". Initial rapport sets tone.`,
      factIds: ActionHelper.collectRelationshipFactIds(relReport).slice(0, 3),
      sourceIds: ActionHelper.collectRelationshipSourceIds(relReport).slice(0, 3),
    });

    // Item 2: Industry discussion
    const industry = ActionHelper.industryFocus(execReport);
    if (!ActionHelper.isUnknown(industry)) {
      items.push({
        topic: `Industry discussion: ${industry}`,
        duration: 10,
        objective: `Discuss trends and developments in ${industry} relevant to ${execReport.contact.name}'s strategic priorities.`,
        confidence: ActionHelper.clampConfidence(execReport.persona.industryFocus.confidence),
        reasoning: `Executive's industry focus is "${industry}" with confidence ${execReport.persona.industryFocus.confidence}.`,
        factIds: [...execReport.persona.industryFocus.factIds],
        sourceIds: [...execReport.persona.industryFocus.sourceIds],
      });
    }

    // Item 3: Strategic priorities
    const priorities = execReport.persona.strategicPriorities.filter((p) => p.confidence >= 40);
    if (priorities.length > 0) {
      items.push({
        topic: `Strategic priorities alignment`,
        duration: Math.min(15, duration - 10),
        objective: `Explore alignment between ${priorities[0].value} and our organization's goals.`,
        confidence: ActionHelper.clampConfidence(priorities[0].confidence),
        reasoning: `Top strategic priority is "${priorities[0].value}" with confidence ${priorities[0].confidence}.`,
        factIds: [...priorities[0].factIds],
        sourceIds: [...priorities[0].sourceIds],
      });
    }

    // Item 4: Opportunity discussion
    const topOpp = decisionReport.opportunityAnalysis
      .filter((o) => o.matchScore >= 50)
      .sort((a, b) => b.matchScore - a.matchScore)[0];
    if (topOpp) {
      items.push({
        topic: `${topOpp.role} opportunity discussion`,
        duration: 10,
        objective: `Discuss potential ${topOpp.role} collaboration with match score ${topOpp.matchScore}.`,
        confidence: ActionHelper.clampConfidence(topOpp.confidence),
        reasoning: `Top opportunity role is "${topOpp.role}" with match score ${topOpp.matchScore} and confidence ${topOpp.confidence}.`,
        factIds: [...topOpp.factIds],
        sourceIds: [...topOpp.sourceIds],
      });
    }

    // Item 5: Next steps
    items.push({
      topic: 'Next steps and action items',
      duration: 5,
      objective: 'Agree on follow-up actions, timelines, and responsibilities.',
      confidence: 80,
      reasoning: 'Structured closing ensures accountability and momentum.',
      factIds: [],
      sourceIds: [],
    });

    return items;
  }

  private buildObjective(
    execReport: ExecutiveIntelligenceReport,
    relReport: RelationshipIntelligenceReport,
    decisionReport: StrategicDecisionReport,
  ): string {
    const stage = ActionHelper.relationshipStage(relReport);
    const topRoles = ActionHelper.topOpportunityRoles(decisionReport);

    if (stage === 'First Contact' || stage === 'Unknown') {
      return `Establish initial connection with ${execReport.contact.name} and explore areas of mutual interest around ${decisionReport.event.name}.`;
    }
    if (topRoles.length > 0) {
      return `Advance relationship with ${execReport.contact.name} from "${stage}" stage by discussing ${topRoles.join(' and ')} opportunities aligned with ${ActionHelper.archetype(execReport)} archetype.`;
    }
    return `Deepen relationship with ${execReport.contact.name} by discussing strategic priorities and identifying collaboration opportunities around ${decisionReport.event.name}.`;
  }

  private buildDesiredOutcome(
    execReport: ExecutiveIntelligenceReport,
    relReport: RelationshipIntelligenceReport,
    decisionReport: StrategicDecisionReport,
  ): string {
    const topRoles = ActionHelper.topOpportunityRoles(decisionReport);
    const stage = ActionHelper.relationshipStage(relReport);

    if (topRoles.includes('partner')) {
      return `Agreement to explore strategic partnership with ${execReport.contact.company}, with a follow-up meeting scheduled within 2 weeks.`;
    }
    if (topRoles.includes('investor')) {
      return `Interest from ${execReport.contact.name} in discussing investment opportunities, with a follow-up pitch meeting scheduled.`;
    }
    if (stage === 'First Contact' || stage === 'Unknown') {
      return `${execReport.contact.name} agrees to a follow-up conversation and shares contact information for ongoing dialogue.`;
    }
    return `Commitment from ${execReport.contact.name} to attend ${decisionReport.event.name} and engage in post-event follow-up discussion.`;
  }

  private buildChecklist(
    execReport: ExecutiveIntelligenceReport,
    relReport: RelationshipIntelligenceReport,
    decisionReport: StrategicDecisionReport,
  ): string[] {
    const checklist: string[] = [
      `Review ${execReport.contact.name}'s executive intelligence report`,
      `Prepare brief on ${ActionHelper.archetype(execReport)} archetype characteristics`,
    ];

    const priorities = ActionHelper.strategicPriorityValues(execReport).slice(0, 3);
    if (priorities.length > 0) {
      checklist.push(`Research talking points on: ${priorities.join(', ')}`);
    }

    const interests = ActionHelper.businessInterestValues(execReport).slice(0, 2);
    if (interests.length > 0) {
      checklist.push(`Prepare discussion material on: ${interests.join(', ')}`);
    }

    if (ActionHelper.influenceLevel(execReport) === 'Industry Leader') {
      checklist.push('Brief executive sponsor on industry leader engagement protocol');
    }

    const topRoles = ActionHelper.topOpportunityRoles(decisionReport);
    if (topRoles.length > 0) {
      checklist.push(`Prepare ${topRoles.join('/')} role-specific materials and case studies`);
    }

    checklist.push(`Review conversation starters from relationship intelligence report`);
    checklist.push(`Confirm meeting logistics (platform, time, calendar invites)`);

    return checklist;
  }

  private unknownStrategy(): MeetingStrategy {
    return {
      objective: 'Unknown',
      meetingType: 'Unknown',
      duration: 0,
      recommendedAttendees: [],
      agenda: [],
      desiredOutcome: 'Unknown',
      preparationChecklist: [],
      confidence: 0,
      reasoning: ActionHelper.insufficientReasoning(),
      factIds: [],
      sourceIds: [],
    };
  }
}
