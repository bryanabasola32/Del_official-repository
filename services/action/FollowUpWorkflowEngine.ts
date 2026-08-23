import type { ExecutiveIntelligenceReport } from '../intelligence/IntelligenceTypes';
import type { RelationshipIntelligenceReport } from '../relationship/RelationshipTypes';
import type { StrategicDecisionReport } from '../decision/DecisionTypes';
import type { FollowUpWorkflow, FollowUpAction, FollowUpActionType, ActionPriority } from './ActionTypes';
import { ActionHelper } from './ActionHelper';

/*
 * FollowUpWorkflowEngine — generates post-event follow-up workflow.
 *
 * Consumes MP4, MP5, and MP6 public interfaces.
 * Produces follow-up actions: Documents, Introductions, Product Demos,
 * Executive Briefs, Future Meetings, Networking Opportunities.
 * Each action includes priority, timing, confidence, reasoning, factIds, sourceIds.
 * Returns Unknown when insufficient evidence.
 */

export class FollowUpWorkflowEngine {
  generate(
    execReport: ExecutiveIntelligenceReport,
    relReport: RelationshipIntelligenceReport,
    decisionReport: StrategicDecisionReport,
  ): FollowUpWorkflow {
    if (ActionHelper.isInsufficientEvidence(execReport, relReport, decisionReport)) {
      return this.unknownWorkflow();
    }

    const invite = decisionReport.inviteRecommendation.decision;
    const actions: FollowUpAction[] = [];

    // 1. Executive Brief
    if (invite !== 'Do Not Invite' && invite !== 'Unknown') {
      actions.push({
        type: 'Executive Brief',
        description: `Prepare and send a tailored executive brief to ${execReport.contact.name} covering ${ActionHelper.archetype(execReport)} archetype insights and strategic priority alignment.`,
        priority: 'high',
        timing: 'Within 48 hours of event',
        confidence: ActionHelper.clampConfidence(
          ActionHelper.executiveConfidence(execReport) * 0.6 + ActionHelper.evidenceConfidence(execReport) * 0.4,
        ),
        reasoning: `Executive confidence is ${ActionHelper.executiveConfidence(execReport)}. Archetype "${ActionHelper.archetype(execReport)}" provides basis for tailored brief.`,
        factIds: ActionHelper.collectFactIds(execReport).slice(0, 5),
        sourceIds: ActionHelper.collectSourceIds(execReport).slice(0, 5),
      });
    }

    // 2. Future Meeting
    if (invite === 'Invite Immediately' || invite === 'Invite') {
      actions.push({
        type: 'Future Meeting',
        description: `Schedule a follow-up strategy meeting with ${execReport.contact.name} to discuss ${ActionHelper.topOpportunityRoles(decisionReport).join(', ') || 'collaboration'} opportunities in depth.`,
        priority: 'high',
        timing: 'Within 1 week of event',
        confidence: ActionHelper.clampConfidence(
          relReport.relationshipProfile.readinessConfidence * 0.5 + decisionReport.confidenceSummary.overallConfidence * 0.5,
        ),
        reasoning: `Engagement readiness is "${ActionHelper.engagementReadiness(relReport)}" (confidence ${relReport.relationshipProfile.readinessConfidence}). Decision confidence is ${decisionReport.confidenceSummary.overallConfidence}.`,
        factIds: [...relReport.relationshipProfile.citations.factIds],
        sourceIds: [...relReport.relationshipProfile.citations.sourceIds],
      });
    }

    // 3. Introduction
    const networkingStyle = ActionHelper.networkingStyle(execReport);
    if (networkingStyle === 'Relationship Builder' || networkingStyle === 'Strategic Networker' || networkingStyle === 'Community Builder') {
      actions.push({
        type: 'Introduction',
        description: `Facilitate introductions between ${execReport.contact.name} and relevant contacts in our network who share interests in ${ActionHelper.businessInterestValues(execReport).slice(0, 2).join(' and ')}.`,
        priority: 'medium',
        timing: 'Within 2 weeks of event',
        confidence: ActionHelper.clampConfidence(execReport.persona.networkingStyle.confidence),
        reasoning: `Networking style is "${networkingStyle}" with confidence ${execReport.persona.networkingStyle.confidence}. Executive is receptive to network introductions.`,
        factIds: [...execReport.persona.networkingStyle.factIds],
        sourceIds: [...execReport.persona.networkingStyle.sourceIds],
      });
    }

    // 4. Product Demo
    const topRoles = ActionHelper.topOpportunityRoles(decisionReport);
    if (topRoles.includes('partner') || topRoles.includes('investor')) {
      actions.push({
        type: 'Product Demo',
        description: `Arrange a product or platform demonstration for ${execReport.contact.name}'s team, tailored to the ${topRoles.find((r) => r === 'partner' || r === 'investor')} opportunity.`,
        priority: 'medium',
        timing: 'Within 2-3 weeks of event',
        confidence: ActionHelper.clampConfidence(
          decisionReport.opportunityAnalysis.find((o) => o.role === 'partner' || o.role === 'investor')?.confidence ?? 0,
        ),
        reasoning: `Opportunity match for ${topRoles.find((r) => r === 'partner' || r === 'investor')} role. Demo concretizes the partnership/investment value proposition.`,
        factIds: decisionReport.opportunityAnalysis.find((o) => o.role === 'partner' || o.role === 'investor')?.factIds ?? [],
        sourceIds: decisionReport.opportunityAnalysis.find((o) => o.role === 'partner' || o.role === 'investor')?.sourceIds ?? [],
      });
    }

    // 5. Document
    const priorities = execReport.persona.strategicPriorities.filter((p) => p.confidence >= 40);
    if (priorities.length > 0) {
      actions.push({
        type: 'Document',
        description: `Send ${execReport.contact.name} a curated document pack on ${priorities[0].value} with relevant case studies and industry reports.`,
        priority: 'medium',
        timing: 'Within 1 week of event',
        confidence: ActionHelper.clampConfidence(priorities[0].confidence),
        reasoning: `Top strategic priority is "${priorities[0].value}" with confidence ${priorities[0].confidence}. Document pack demonstrates value and expertise.`,
        factIds: [...priorities[0].factIds],
        sourceIds: [...priorities[0].sourceIds],
      });
    }

    // 6. Networking Opportunity
    if (relReport.relationshipProfile.networkingPotential === 'High' || relReport.relationshipProfile.networkingPotential === 'Moderate') {
      actions.push({
        type: 'Networking Opportunity',
        description: `Invite ${execReport.contact.name} to an upcoming industry roundtable or executive dinner relevant to ${ActionHelper.industryFocus(execReport)}.`,
        priority: 'low',
        timing: 'Within 1 month of event',
        confidence: ActionHelper.clampConfidence(relReport.relationshipProfile.networkingConfidence),
        reasoning: `Networking potential is "${relReport.relationshipProfile.networkingPotential}" with confidence ${relReport.relationshipProfile.networkingConfidence}. Industry roundtable extends engagement beyond the initial event.`,
        factIds: [...relReport.relationshipProfile.citations.factIds],
        sourceIds: [...relReport.relationshipProfile.citations.sourceIds],
      });
    }

    const confidence = actions.length > 0
      ? ActionHelper.clampConfidence(ActionHelper.mergeConfidence(actions.map((a) => ({ confidence: a.confidence }))))
      : 0;
    const citations = ActionHelper.mergeCitations(actions);

    return {
      actions,
      confidence,
      reasoning: `Follow-up workflow with ${actions.length} actions covering ${actions.map((a) => a.type).join(', ')}. Based on invite decision "${invite}" and networking style "${networkingStyle}".`,
      factIds: citations.factIds,
      sourceIds: citations.sourceIds,
    };
  }

  private unknownWorkflow(): FollowUpWorkflow {
    return {
      actions: [],
      confidence: 0,
      reasoning: ActionHelper.insufficientReasoning(),
      factIds: [],
      sourceIds: [],
    };
  }
}
