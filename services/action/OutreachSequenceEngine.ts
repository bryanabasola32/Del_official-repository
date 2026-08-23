import type { ExecutiveIntelligenceReport } from '../intelligence/IntelligenceTypes';
import type { RelationshipIntelligenceReport } from '../relationship/RelationshipTypes';
import type { StrategicDecisionReport } from '../decision/DecisionTypes';
import type { OutreachSequence, OutreachStep, OutreachTrigger } from './ActionTypes';
import { ActionHelper } from './ActionHelper';

/*
 * OutreachSequenceEngine — generates a timeline of outreach steps.
 *
 * Consumes MP4, MP5, and MP6 public interfaces.
 * Produces a step-by-step outreach timeline from Day 0 through Quarterly follow-up.
 * Each step includes trigger, objective, confidence, reasoning, factIds, sourceIds.
 * Returns Unknown when insufficient evidence.
 */

export class OutreachSequenceEngine {
  generate(
    execReport: ExecutiveIntelligenceReport,
    relReport: RelationshipIntelligenceReport,
    decisionReport: StrategicDecisionReport,
  ): OutreachSequence {
    if (ActionHelper.isInsufficientEvidence(execReport, relReport, decisionReport)) {
      return this.unknownSequence();
    }

    const invite = decisionReport.inviteRecommendation.decision;
    const steps: OutreachStep[] = [];

    // Step 1: Day 0 — Invitation
    if (invite === 'Invite Immediately' || invite === 'Invite') {
      steps.push({
        trigger: 'Day 0',
        label: 'Invitation',
        objective: `Send personalized event invitation to ${execReport.contact.name} for ${decisionReport.event.name}.`,
        confidence: ActionHelper.clampConfidence(decisionReport.inviteRecommendation.confidence),
        reasoning: `Invite decision is "${invite}" with confidence ${decisionReport.inviteRecommendation.confidence}.`,
        factIds: [...decisionReport.inviteRecommendation.factIds],
        sourceIds: [...decisionReport.inviteRecommendation.sourceIds],
      });
    }

    // Step 2: Day 2 — Reminder
    if (invite === 'Invite Immediately' || invite === 'Invite' || invite === 'Invite Later') {
      steps.push({
        trigger: 'Day 2',
        label: 'Reminder',
        objective: `Send brief follow-up reminder to ${execReport.contact.name} if no response to initial invitation.`,
        confidence: ActionHelper.clampConfidence(relReport.confidenceSummary.followUpConfidence),
        reasoning: `Follow-up confidence is ${relReport.confidenceSummary.followUpConfidence}. Day 2 reminder maintains momentum without being pushy.`,
        factIds: [...relReport.followUpPlan[0]?.citations.factIds ?? []],
        sourceIds: [...relReport.followUpPlan[0]?.citations.sourceIds ?? []],
      });
    }

    // Step 3: Pre-Event — Preparation
    if (invite !== 'Do Not Invite' && invite !== 'Unknown') {
      steps.push({
        trigger: 'Pre-Event',
        label: 'Pre-Event Preparation',
        objective: `Confirm ${execReport.contact.name}'s attendance and share event agenda and preparation materials.`,
        confidence: ActionHelper.clampConfidence(
          ActionHelper.mergeConfidence([
            { confidence: relReport.confidenceSummary.overallConfidence },
            { confidence: decisionReport.confidenceSummary.overallConfidence },
          ]),
        ),
        reasoning: `Pre-event communication ensures ${execReport.contact.name} is prepared and engaged. Relationship confidence: ${relReport.confidenceSummary.overallConfidence}.`,
        factIds: ActionHelper.collectRelationshipFactIds(relReport).slice(0, 5),
        sourceIds: ActionHelper.collectRelationshipSourceIds(relReport).slice(0, 5),
      });
    }

    // Step 4: During Event — Meeting
    if (invite !== 'Do Not Invite' && invite !== 'Unknown') {
      steps.push({
        trigger: 'During Event',
        label: 'Conference Meeting',
        objective: `Meet ${execReport.contact.name} at ${decisionReport.event.name}. Follow conversation flow and execute meeting strategy.`,
        confidence: ActionHelper.clampConfidence(decisionReport.confidenceSummary.overallConfidence),
        reasoning: `Event is ${decisionReport.event.name}. Decision confidence is ${decisionReport.confidenceSummary.overallConfidence}. In-person meeting is the primary engagement opportunity.`,
        factIds: [...decisionReport.eventFit.citations.factIds],
        sourceIds: [...decisionReport.eventFit.citations.sourceIds],
      });
    }

    // Step 5: Day 1 After — Thank You
    if (invite !== 'Do Not Invite' && invite !== 'Unknown') {
      steps.push({
        trigger: 'Day 1 After',
        label: 'Thank You',
        objective: `Send thank-you note to ${execReport.contact.name} referencing specific discussion points from the event meeting.`,
        confidence: ActionHelper.clampConfidence(85),
        reasoning: `Post-event thank-you within 24 hours reinforces the interaction. ${execReport.contact.name} has ${ActionHelper.communicationStyle(execReport)} communication style.`,
        factIds: [...execReport.persona.communicationStyle.factIds],
        sourceIds: [...execReport.persona.communicationStyle.sourceIds],
      });
    }

    // Step 6: Week 1 — Follow-up
    if (invite !== 'Do Not Invite' && invite !== 'Unknown') {
      const topOpp = decisionReport.opportunityAnalysis
        .filter((o) => o.matchScore >= 50)
        .sort((a, b) => b.matchScore - a.matchScore)[0];
      steps.push({
        trigger: 'Week 1',
        label: 'Follow-up',
        objective: topOpp
          ? `Send follow-up materials related to the ${topOpp.role} opportunity discussed at the event.`
          : `Send follow-up materials and propose a next conversation with ${execReport.contact.name}.`,
        confidence: ActionHelper.clampConfidence(
          topOpp ? topOpp.confidence : relReport.confidenceSummary.followUpConfidence,
        ),
        reasoning: topOpp
          ? `Top opportunity role "${topOpp.role}" with match score ${topOpp.matchScore}. Follow-up materials should be role-specific.`
          : `Follow-up confidence is ${relReport.confidenceSummary.followUpConfidence}. General follow-up maintains relationship momentum.`,
        factIds: topOpp ? [...topOpp.factIds] : ActionHelper.collectRelationshipFactIds(relReport).slice(0, 3),
        sourceIds: topOpp ? [...topOpp.sourceIds] : ActionHelper.collectRelationshipSourceIds(relReport).slice(0, 3),
      });
    }

    // Step 7: Week 2 — Deepen Engagement
    if (invite === 'Invite Immediately' || invite === 'Invite') {
      steps.push({
        trigger: 'Week 2',
        label: 'Deepen Engagement',
        objective: `Propose a deeper engagement: schedule a strategy meeting or share a tailored executive brief with ${execReport.contact.name}.`,
        confidence: ActionHelper.clampConfidence(
          ActionHelper.executiveConfidence(execReport) * 0.5 + ActionHelper.relationshipScore(relReport) * 0.5,
        ),
        reasoning: `Executive confidence: ${ActionHelper.executiveConfidence(execReport)}. Relationship score: ${ActionHelper.relationshipScore(relReport)}. Week 2 is optimal for proposing deeper engagement.`,
        factIds: ActionHelper.collectFactIds(execReport).slice(0, 5),
        sourceIds: ActionHelper.collectSourceIds(execReport).slice(0, 5),
      });
    }

    // Step 8: Month 1 — Reconnect
    if (invite !== 'Do Not Invite' && invite !== 'Unknown') {
      steps.push({
        trigger: 'Month 1',
        label: 'Reconnect',
        objective: `Reconnect with ${execReport.contact.name} to share industry insights related to ${ActionHelper.industryFocus(execReport)} and check on progress.`,
        confidence: ActionHelper.clampConfidence(
          ActionHelper.mergeConfidence([
            { confidence: relReport.confidenceSummary.overallConfidence },
            { confidence: execReport.persona.industryFocus.confidence },
          ]),
        ),
        reasoning: `Industry focus is "${ActionHelper.industryFocus(execReport)}" (confidence ${execReport.persona.industryFocus.confidence}). Month 1 reconnect sustains relationship without being transactional.`,
        factIds: [...execReport.persona.industryFocus.factIds],
        sourceIds: [...execReport.persona.industryFocus.sourceIds],
      });
    }

    // Step 9: Quarterly — Relationship Maintenance
    if (invite !== 'Do Not Invite' && invite !== 'Unknown') {
      steps.push({
        trigger: 'Quarterly',
        label: 'Quarterly Check-in',
        objective: `Schedule quarterly check-in with ${execReport.contact.name} to maintain ${ActionHelper.relationshipStage(relReport)} relationship and explore new opportunities.`,
        confidence: ActionHelper.clampConfidence(relReport.confidenceSummary.overallConfidence),
        reasoning: `Relationship stage is "${ActionHelper.relationshipStage(relReport)}". Quarterly cadence ensures relationship progression toward Strategic stage.`,
        factIds: ActionHelper.collectRelationshipFactIds(relReport).slice(0, 3),
        sourceIds: ActionHelper.collectRelationshipSourceIds(relReport).slice(0, 3),
      });
    }

    const confidence = steps.length > 0
      ? ActionHelper.clampConfidence(ActionHelper.mergeConfidence(steps.map((s) => ({ confidence: s.confidence }))))
      : 0;
    const citations = ActionHelper.mergeCitations(steps);

    return {
      steps,
      confidence,
      reasoning: `Outreach sequence with ${steps.length} steps from ${steps[0]?.trigger ?? 'N/A'} to ${steps[steps.length - 1]?.trigger ?? 'N/A'}. Based on invite decision "${invite}" and relationship stage "${ActionHelper.relationshipStage(relReport)}".`,
      factIds: citations.factIds,
      sourceIds: citations.sourceIds,
    };
  }

  private unknownSequence(): OutreachSequence {
    return {
      steps: [],
      confidence: 0,
      reasoning: ActionHelper.insufficientReasoning(),
      factIds: [],
      sourceIds: [],
    };
  }
}
