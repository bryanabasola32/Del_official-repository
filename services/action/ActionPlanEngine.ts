import type { ExecutiveIntelligenceReport } from '../intelligence/IntelligenceTypes';
import type { RelationshipIntelligenceReport } from '../relationship/RelationshipTypes';
import type { StrategicDecisionReport } from '../decision/DecisionTypes';
import type { ActionPlan, PlannedAction, ActionTimeframe, ActionPriority } from './ActionTypes';
import { ActionHelper } from './ActionHelper';

/*
 * ActionPlanEngine — generates time-phased action plan.
 *
 * Consumes MP4 (ExecutiveIntelligenceReport), MP5 (RelationshipIntelligenceReport),
 * and MP6 (StrategicDecisionReport).
 *
 * Produces actions across 4 timeframes:
 *   immediate, short-term, medium-term, long-term
 *
 * Each action is evidence-grounded with confidence, reasoning, factIds, sourceIds.
 * Returns Unknown when insufficient evidence.
 */

export class ActionPlanEngine {
  generate(
    execReport: ExecutiveIntelligenceReport,
    relReport: RelationshipIntelligenceReport,
    decisionReport: StrategicDecisionReport,
  ): ActionPlan {
    if (ActionHelper.isInsufficientEvidence(execReport, relReport, decisionReport)) {
      return this.unknownPlan();
    }

    const immediate = this.generateImmediate(execReport, relReport, decisionReport);
    const shortTerm = this.generateShortTerm(execReport, relReport, decisionReport);
    const mediumTerm = this.generateMediumTerm(execReport, relReport, decisionReport);
    const longTerm = this.generateLongTerm(execReport, relReport, decisionReport);

    const allActions = [...immediate, ...shortTerm, ...mediumTerm, ...longTerm];
    const confidence = ActionHelper.clampConfidence(
      allActions.length > 0
        ? ActionHelper.mergeConfidence(allActions.map((a) => ({ confidence: a.confidence })))
        : 0,
    );

    const citations = ActionHelper.mergeCitations(allActions);

    return {
      immediate,
      shortTerm,
      mediumTerm,
      longTerm,
      confidence,
      reasoning: `Action plan generated from invite decision "${decisionReport.inviteRecommendation.decision}" and priority tier "${decisionReport.priorityRanking.tier}". ${allActions.length} actions across 4 timeframes.`,
      factIds: citations.factIds,
      sourceIds: citations.sourceIds,
    };
  }

  // ── Immediate actions (0–2 days) ───────────────

  private generateImmediate(
    execReport: ExecutiveIntelligenceReport,
    relReport: RelationshipIntelligenceReport,
    decisionReport: StrategicDecisionReport,
  ): PlannedAction[] {
    const actions: PlannedAction[] = [];
    const invite = decisionReport.inviteRecommendation.decision;
    const execConf = ActionHelper.executiveConfidence(execReport);
    const relScore = ActionHelper.relationshipScore(relReport);

    // Action 1: Send invitation if invite decision is positive
    if (invite === 'Invite Immediately' || invite === 'Invite') {
      actions.push({
        id: ActionHelper.actionId('immediate', 0),
        title: `Send event invitation to ${execReport.contact.name}`,
        description: `Send personalized invitation to ${execReport.contact.name} (${execReport.contact.title}, ${execReport.contact.company}) for ${decisionReport.event.name}. Use ${ActionHelper.communicationStyle(execReport)} communication approach.`,
        timeframe: 'immediate',
        priority: invite === 'Invite Immediately' ? 'critical' : 'high',
        confidence: ActionHelper.clampConfidence(decisionReport.inviteRecommendation.confidence * 0.9 + execConf * 0.1),
        reasoning: `Invite decision is "${invite}" with confidence ${decisionReport.inviteRecommendation.confidence}. Executive confidence is ${execConf}. Immediate outreach is warranted.`,
        factIds: [...decisionReport.inviteRecommendation.factIds],
        sourceIds: [...decisionReport.inviteRecommendation.sourceIds],
        estimatedImpact: 85,
        estimatedEffort: 20,
        dependencies: [],
      });
    }

    // Action 2: Prepare executive brief
    if (invite !== 'Do Not Invite' && invite !== 'Unknown') {
      actions.push({
        id: ActionHelper.actionId('immediate', 1),
        title: `Prepare executive brief on ${execReport.contact.name}`,
        description: `Create a 1-page brief covering ${execReport.contact.name}'s archetype (${ActionHelper.archetype(execReport)}), strategic priorities, and conversation hooks based on business interests.`,
        timeframe: 'immediate',
        priority: 'high',
        confidence: ActionHelper.clampConfidence(execConf * 0.6 + relReport.confidenceSummary.overallConfidence * 0.4),
        reasoning: `Executive intelligence confidence is ${execConf}. Brief should cover archetype "${ActionHelper.archetype(execReport)}" and top strategic priorities.`,
        factIds: ActionHelper.collectFactIds(execReport).slice(0, 10),
        sourceIds: ActionHelper.collectSourceIds(execReport).slice(0, 10),
        estimatedImpact: 60,
        estimatedEffort: 40,
        dependencies: [],
      });
    }

    // Action 3: Internal alignment meeting
    if (invite === 'Invite Immediately' || invite === 'Invite') {
      actions.push({
        id: ActionHelper.actionId('immediate', 2),
        title: 'Align internal team on engagement strategy',
        description: `Brief team on ${execReport.contact.name}'s relationship stage (${ActionHelper.relationshipStage(relReport)}) and engagement readiness (${ActionHelper.engagementReadiness(relReport)}). Assign roles for outreach, follow-up, and event coordination.`,
        timeframe: 'immediate',
        priority: 'medium',
        confidence: ActionHelper.clampConfidence(relReport.confidenceSummary.overallConfidence),
        reasoning: `Relationship stage is "${ActionHelper.relationshipStage(relReport)}" with readiness "${ActionHelper.engagementReadiness(relReport)}". Team alignment ensures consistent engagement.`,
        factIds: ActionHelper.collectRelationshipFactIds(relReport).slice(0, 5),
        sourceIds: ActionHelper.collectRelationshipSourceIds(relReport).slice(0, 5),
        estimatedImpact: 50,
        estimatedEffort: 30,
        dependencies: [ActionHelper.actionId('immediate', 1)],
      });
    }

    // Action 4: Identify networking opportunities
    if (relReport.relationshipProfile.networkingPotential === 'High' || relReport.relationshipProfile.networkingPotential === 'Moderate') {
      actions.push({
        id: ActionHelper.actionId('immediate', 3),
        title: `Map networking opportunities for ${execReport.contact.name}`,
        description: `Identify mutual connections and shared industry networks. Executive has ${ActionHelper.networkingStyle(execReport)} networking style with ${relReport.relationshipProfile.networkingPotential} networking potential.`,
        timeframe: 'immediate',
        priority: 'medium',
        confidence: ActionHelper.clampConfidence(relReport.relationshipProfile.networkingConfidence),
        reasoning: `Networking style is "${ActionHelper.networkingStyle(execReport)}" with ${relReport.relationshipProfile.networkingPotential} potential. Mapping opportunities maximizes event value.`,
        factIds: [...relReport.relationshipProfile.citations.factIds],
        sourceIds: [...relReport.relationshipProfile.citations.sourceIds],
        estimatedImpact: 45,
        estimatedEffort: 25,
        dependencies: [],
      });
    }

    return actions;
  }

  // ── Short-term actions (3–14 days) ─────────────

  private generateShortTerm(
    execReport: ExecutiveIntelligenceReport,
    relReport: RelationshipIntelligenceReport,
    decisionReport: StrategicDecisionReport,
  ): PlannedAction[] {
    const actions: PlannedAction[] = [];
    const invite = decisionReport.inviteRecommendation.decision;
    const topRoles = ActionHelper.topOpportunityRoles(decisionReport);

    // Action 1: Confirm event logistics
    if (invite === 'Invite Immediately' || invite === 'Invite' || invite === 'Invite Later') {
      actions.push({
        id: ActionHelper.actionId('short-term', 0),
        title: `Confirm event logistics for ${execReport.contact.name}`,
        description: `Verify ${execReport.contact.name}'s registration, seating, and any special requirements for ${decisionReport.event.name}. Coordinate VIP arrangements if applicable.`,
        timeframe: 'short-term',
        priority: 'high',
        confidence: ActionHelper.clampConfidence(80),
        reasoning: `Event is ${decisionReport.event.name}. Executive is ${ActionHelper.influenceLevel(execReport)}. Logistics must be confirmed before event date.`,
        factIds: [...decisionReport.inviteRecommendation.factIds],
        sourceIds: [...decisionReport.inviteRecommendation.sourceIds],
        estimatedImpact: 55,
        estimatedEffort: 20,
        dependencies: [ActionHelper.actionId('immediate', 0)],
      });
    }

    // Action 2: Prepare role-specific materials
    if (topRoles.length > 0) {
      actions.push({
        id: ActionHelper.actionId('short-term', 1),
        title: `Prepare materials for ${topRoles.join(', ')} role(s)`,
        description: `Create tailored materials for ${execReport.contact.name} based on matched opportunity roles: ${topRoles.join(', ')}. Include relevant case studies and talking points.`,
        timeframe: 'short-term',
        priority: 'high',
        confidence: ActionHelper.clampConfidence(
          decisionReport.opportunityAnalysis
            .filter((o) => o.matchScore >= 50)
            .reduce((s, o) => s + o.confidence, 0) / Math.max(topRoles.length, 1),
        ),
        reasoning: `${topRoles.length} opportunity role(s) matched with match scores ≥50. Materials should be tailored to these roles.`,
        factIds: decisionReport.opportunityAnalysis.flatMap((o) => o.factIds),
        sourceIds: decisionReport.opportunityAnalysis.flatMap((o) => o.sourceIds),
        estimatedImpact: 65,
        estimatedEffort: 50,
        dependencies: [ActionHelper.actionId('immediate', 1)],
      });
    }

    // Action 3: Schedule pre-event outreach call
    if (relReport.relationshipProfile.engagementReadiness === 'Ready' || relReport.relationshipProfile.engagementReadiness === 'Highly Ready') {
      actions.push({
        id: ActionHelper.actionId('short-term', 2),
        title: `Schedule pre-event call with ${execReport.contact.name}`,
        description: `Arrange a brief introductory call to discuss event themes and areas of mutual interest. Executive shows ${ActionHelper.engagementReadiness(relReport)} engagement readiness.`,
        timeframe: 'short-term',
        priority: 'medium',
        confidence: ActionHelper.clampConfidence(relReport.relationshipProfile.readinessConfidence),
        reasoning: `Engagement readiness is "${ActionHelper.engagementReadiness(relReport)}" with confidence ${relReport.relationshipProfile.readinessConfidence}. Pre-event call builds rapport.`,
        factIds: [...relReport.relationshipProfile.citations.factIds],
        sourceIds: [...relReport.relationshipProfile.citations.sourceIds],
        estimatedImpact: 50,
        estimatedEffort: 30,
        dependencies: [ActionHelper.actionId('immediate', 0)],
      });
    }

    return actions;
  }

  // ── Medium-term actions (2–4 weeks) ─────────────

  private generateMediumTerm(
    execReport: ExecutiveIntelligenceReport,
    relReport: RelationshipIntelligenceReport,
    decisionReport: StrategicDecisionReport,
  ): PlannedAction[] {
    const actions: PlannedAction[] = [];
    const invite = decisionReport.inviteRecommendation.decision;

    // Action 1: Conduct post-event follow-up meeting
    if (invite === 'Invite Immediately' || invite === 'Invite' || invite === 'Invite Later') {
      actions.push({
        id: ActionHelper.actionId('medium-term', 0),
        title: `Schedule post-event strategy meeting with ${execReport.contact.name}`,
        description: `Arrange a follow-up meeting to discuss shared strategic priorities: ${ActionHelper.strategicPriorityValues(execReport).slice(0, 3).join(', ')}. Focus on actionable collaboration areas.`,
        timeframe: 'medium-term',
        priority: 'high',
        confidence: ActionHelper.clampConfidence(
          ActionHelper.executiveConfidence(execReport) * 0.5 + ActionHelper.relationshipScore(relReport) * 0.5,
        ),
        reasoning: `Executive has ${execReport.persona.strategicPriorities.length} strategic priorities. Post-event meeting converts event interaction into ongoing relationship.`,
        factIds: execReport.persona.strategicPriorities.slice(0, 3).flatMap((p) => p.factIds),
        sourceIds: execReport.persona.strategicPriorities.slice(0, 3).flatMap((p) => p.sourceIds),
        estimatedImpact: 70,
        estimatedEffort: 40,
        dependencies: [ActionHelper.actionId('short-term', 0)],
      });
    }

    // Action 2: Propose partnership opportunity
    if (decisionReport.opportunityAnalysis.some((o) => o.role === 'partner' && o.matchScore >= 50)) {
      actions.push({
        id: ActionHelper.actionId('medium-term', 1),
        title: `Propose strategic partnership to ${execReport.contact.company}`,
        description: `Present partnership proposal aligned with ${execReport.contact.name}'s archetype (${ActionHelper.archetype(execReport)}) and strategic priorities. Highlight mutual benefits from decision analysis.`,
        timeframe: 'medium-term',
        priority: 'high',
        confidence: ActionHelper.clampConfidence(
          decisionReport.opportunityAnalysis.find((o) => o.role === 'partner')?.confidence ?? 0,
        ),
        reasoning: `Partner role matched with score ${decisionReport.opportunityAnalysis.find((o) => o.role === 'partner')?.matchScore ?? 0}. Executive archetype "${ActionHelper.archetype(execReport)}" supports partnership.`,
        factIds: decisionReport.opportunityAnalysis.find((o) => o.role === 'partner')?.factIds ?? [],
        sourceIds: decisionReport.opportunityAnalysis.find((o) => o.role === 'partner')?.sourceIds ?? [],
        estimatedImpact: 80,
        estimatedEffort: 60,
        dependencies: [ActionHelper.actionId('medium-term', 0)],
      });
    }

    // Action 3: Share relevant industry insights
    const industryFocus = ActionHelper.industryFocus(execReport);
    if (!ActionHelper.isUnknown(industryFocus)) {
      actions.push({
        id: ActionHelper.actionId('medium-term', 2),
        title: `Share industry insights on ${industryFocus}`,
        description: `Send curated industry reports and insights related to ${industryFocus} to ${execReport.contact.name}. Position as a value-add resource, not a sales pitch.`,
        timeframe: 'medium-term',
        priority: 'medium',
        confidence: ActionHelper.clampConfidence(execReport.persona.industryFocus.confidence),
        reasoning: `Executive's industry focus is "${industryFocus}" with confidence ${execReport.persona.industryFocus.confidence}. Sharing insights demonstrates value.`,
        factIds: [...execReport.persona.industryFocus.factIds],
        sourceIds: [...execReport.persona.industryFocus.sourceIds],
        estimatedImpact: 40,
        estimatedEffort: 25,
        dependencies: [],
      });
    }

    return actions;
  }

  // ── Long-term actions (1–6 months) ──────────────

  private generateLongTerm(
    execReport: ExecutiveIntelligenceReport,
    relReport: RelationshipIntelligenceReport,
    decisionReport: StrategicDecisionReport,
  ): PlannedAction[] {
    const actions: PlannedAction[] = [];
    const invite = decisionReport.inviteRecommendation.decision;

    // Action 1: Establish ongoing relationship cadence
    if (invite !== 'Do Not Invite' && invite !== 'Unknown') {
      actions.push({
        id: ActionHelper.actionId('long-term', 0),
        title: `Establish quarterly relationship cadence with ${execReport.contact.name}`,
        description: `Set up quarterly check-ins focused on ${ActionHelper.strategicPriorityValues(execReport).slice(0, 2).join(' and ')}. Goal: move relationship from "${ActionHelper.relationshipStage(relReport)}" to "Strategic".`,
        timeframe: 'long-term',
        priority: 'medium',
        confidence: ActionHelper.clampConfidence(
          ActionHelper.relationshipConfidence(relReport) * 0.6 + ActionHelper.executiveConfidence(execReport) * 0.4,
        ),
        reasoning: `Current relationship stage is "${ActionHelper.relationshipStage(relReport)}". Quarterly cadence drives progression toward Strategic stage.`,
        factIds: ActionHelper.collectRelationshipFactIds(relReport).slice(0, 5),
        sourceIds: ActionHelper.collectRelationshipSourceIds(relReport).slice(0, 5),
        estimatedImpact: 60,
        estimatedEffort: 30,
        dependencies: [ActionHelper.actionId('medium-term', 0)],
      });
    }

    // Action 2: Pursue strategic partnership or investment
    if (decisionReport.opportunityAnalysis.some((o) => (o.role === 'partner' || o.role === 'investor') && o.matchScore >= 60)) {
      const opp = decisionReport.opportunityAnalysis.find((o) => (o.role === 'partner' || o.role === 'investor') && o.matchScore >= 60);
      actions.push({
        id: ActionHelper.actionId('long-term', 1),
        title: `Formalize ${opp?.role} relationship with ${execReport.contact.company}`,
        description: `Work toward formal ${opp?.role} agreement with ${execReport.contact.name}'s organization. Leverage alignment with strategic priorities and event themes.`,
        timeframe: 'long-term',
        priority: 'high',
        confidence: ActionHelper.clampConfidence(opp?.confidence ?? 0),
        reasoning: `${opp?.role} role matched with score ${opp?.matchScore}. Long-term formalization maximizes strategic value.`,
        factIds: opp?.factIds ?? [],
        sourceIds: opp?.sourceIds ?? [],
        estimatedImpact: 90,
        estimatedEffort: 80,
        dependencies: [ActionHelper.actionId('medium-term', 1)],
      });
    }

    // Action 3: Build thought leadership collaboration
    if (ActionHelper.influenceLevel(execReport) === 'Industry Leader' || ActionHelper.influenceLevel(execReport) === 'Sector Influencer') {
      actions.push({
        id: ActionHelper.actionId('long-term', 2),
        title: `Explore thought leadership collaboration with ${execReport.contact.name}`,
        description: `Propose co-authored content, joint speaking opportunities, or industry panel participation. Executive is ${ActionHelper.influenceLevel(execReport)} with ${ActionHelper.networkingStyle(execReport)} networking style.`,
        timeframe: 'long-term',
        priority: 'low',
        confidence: ActionHelper.clampConfidence(execReport.persona.influenceLevel.confidence),
        reasoning: `Influence level is "${ActionHelper.influenceLevel(execReport)}" with confidence ${execReport.persona.influenceLevel.confidence}. Thought leadership collaboration amplifies reach.`,
        factIds: [...execReport.persona.influenceLevel.factIds],
        sourceIds: [...execReport.persona.influenceLevel.sourceIds],
        estimatedImpact: 55,
        estimatedEffort: 50,
        dependencies: [ActionHelper.actionId('long-term', 0)],
      });
    }

    return actions;
  }

  // ── Unknown plan ────────────────────────────────

  private unknownPlan(): ActionPlan {
    return {
      immediate: [],
      shortTerm: [],
      mediumTerm: [],
      longTerm: [],
      confidence: 0,
      reasoning: ActionHelper.insufficientReasoning(),
      factIds: [],
      sourceIds: [],
    };
  }
}
