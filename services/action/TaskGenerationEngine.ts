import type { ExecutiveIntelligenceReport } from '../intelligence/IntelligenceTypes';
import type { RelationshipIntelligenceReport } from '../relationship/RelationshipTypes';
import type { StrategicDecisionReport } from '../decision/DecisionTypes';
import type { TaskList, GeneratedTask } from './ActionTypes';
import { ActionHelper } from './ActionHelper';

/*
 * TaskGenerationEngine — generates executable tasks from the action plan.
 *
 * Consumes MP4, MP5, and MP6 public interfaces.
 * Produces tasks with title, description, owner, priority, deadline, dependencies, status.
 * No fake owners — "Unknown" if unavailable.
 * Returns Unknown when insufficient evidence.
 */

export class TaskGenerationEngine {
  generate(
    execReport: ExecutiveIntelligenceReport,
    relReport: RelationshipIntelligenceReport,
    decisionReport: StrategicDecisionReport,
  ): TaskList {
    if (ActionHelper.isInsufficientEvidence(execReport, relReport, decisionReport)) {
      return this.unknownTaskList();
    }

    const invite = decisionReport.inviteRecommendation.decision;
    const tasks: GeneratedTask[] = [];

    // Task 1: Send invitation
    if (invite === 'Invite Immediately' || invite === 'Invite') {
      tasks.push({
        title: `Send event invitation to ${execReport.contact.name}`,
        description: `Send personalized invitation to ${execReport.contact.title} at ${execReport.contact.company} for ${decisionReport.event.name}. Use ${ActionHelper.communicationStyle(execReport)} tone.`,
        owner: 'Account Manager',
        priority: invite === 'Invite Immediately' ? 'critical' : 'high',
        deadline: '2 days',
        dependencies: [],
        status: 'not_started',
        confidence: ActionHelper.clampConfidence(decisionReport.inviteRecommendation.confidence),
        reasoning: `Invite decision is "${invite}" with confidence ${decisionReport.inviteRecommendation.confidence}.`,
        factIds: [...decisionReport.inviteRecommendation.factIds],
        sourceIds: [...decisionReport.inviteRecommendation.sourceIds],
      });
    }

    // Task 2: Prepare executive brief
    if (invite !== 'Do Not Invite' && invite !== 'Unknown') {
      tasks.push({
        title: `Prepare executive brief on ${execReport.contact.name}`,
        description: `Create 1-page brief covering archetype (${ActionHelper.archetype(execReport)}), top strategic priorities, and recommended conversation topics.`,
        owner: 'Intelligence Analyst',
        priority: 'high',
        deadline: '3 days',
        dependencies: [],
        status: 'not_started',
        confidence: ActionHelper.clampConfidence(ActionHelper.executiveConfidence(execReport)),
        reasoning: `Executive confidence is ${ActionHelper.executiveConfidence(execReport)}. Archetype "${ActionHelper.archetype(execReport)}" is classified with confidence ${execReport.archetypeClassification.confidence}.`,
        factIds: [...execReport.archetypeClassification.factIds],
        sourceIds: [...execReport.archetypeClassification.sourceIds],
      });
    }

    // Task 3: Confirm logistics
    if (invite !== 'Do Not Invite' && invite !== 'Unknown') {
      tasks.push({
        title: `Confirm event logistics for ${execReport.contact.name}`,
        description: `Verify registration, seating arrangements, and any VIP requirements for ${execReport.contact.name} at ${decisionReport.event.name}.`,
        owner: 'Event Coordinator',
        priority: 'high',
        deadline: '5 days',
        dependencies: [],
        status: 'not_started',
        confidence: 80,
        reasoning: `Event logistics must be confirmed. Executive is ${ActionHelper.influenceLevel(execReport)}.`,
        factIds: [...execReport.persona.influenceLevel.factIds],
        sourceIds: [...execReport.persona.influenceLevel.sourceIds],
      });
    }

    // Task 4: Prepare role-specific materials
    const topRoles = ActionHelper.topOpportunityRoles(decisionReport);
    if (topRoles.length > 0) {
      tasks.push({
        title: `Prepare ${topRoles.join(', ')} materials`,
        description: `Create tailored materials for ${execReport.contact.name} based on matched opportunity roles: ${topRoles.join(', ')}. Include case studies and relevant success stories.`,
        owner: 'Content Team',
        priority: 'medium',
        deadline: '5 days',
        dependencies: ['Prepare executive brief'],
        status: 'not_started',
        confidence: ActionHelper.clampConfidence(
          decisionReport.opportunityAnalysis
            .filter((o) => o.matchScore >= 50)
            .reduce((s, o) => s + o.confidence, 0) / Math.max(topRoles.length, 1),
        ),
        reasoning: `${topRoles.length} opportunity role(s) matched with scores ≥50.`,
        factIds: decisionReport.opportunityAnalysis.filter((o) => o.matchScore >= 50).flatMap((o) => o.factIds),
        sourceIds: decisionReport.opportunityAnalysis.filter((o) => o.matchScore >= 50).flatMap((o) => o.sourceIds),
      });
    }

    // Task 5: Schedule pre-event call
    if (relReport.relationshipProfile.engagementReadiness === 'Ready' || relReport.relationshipProfile.engagementReadiness === 'Highly Ready') {
      tasks.push({
        title: `Schedule pre-event call with ${execReport.contact.name}`,
        description: `Arrange a 30-minute introductory call to discuss event themes and areas of mutual interest.`,
        owner: 'Account Manager',
        priority: 'medium',
        deadline: '7 days',
        dependencies: ['Send event invitation'],
        status: 'not_started',
        confidence: ActionHelper.clampConfidence(relReport.relationshipProfile.readinessConfidence),
        reasoning: `Engagement readiness is "${ActionHelper.engagementReadiness(relReport)}" with confidence ${relReport.relationshipProfile.readinessConfidence}.`,
        factIds: [...relReport.relationshipProfile.citations.factIds],
        sourceIds: [...relReport.relationshipProfile.citations.sourceIds],
      });
    }

    // Task 6: Align internal team
    if (invite === 'Invite Immediately' || invite === 'Invite') {
      tasks.push({
        title: `Align internal team on ${execReport.contact.name} engagement`,
        description: `Brief team on relationship stage (${ActionHelper.relationshipStage(relReport)}), engagement strategy, and assigned roles for outreach and event coordination.`,
        owner: 'Account Manager',
        priority: 'medium',
        deadline: '3 days',
        dependencies: ['Prepare executive brief'],
        status: 'not_started',
        confidence: ActionHelper.clampConfidence(relReport.confidenceSummary.overallConfidence),
        reasoning: `Relationship stage is "${ActionHelper.relationshipStage(relReport)}". Team alignment ensures consistent engagement.`,
        factIds: ActionHelper.collectRelationshipFactIds(relReport).slice(0, 3),
        sourceIds: ActionHelper.collectRelationshipSourceIds(relReport).slice(0, 3),
      });
    }

    // Task 7: Post-event follow-up
    if (invite !== 'Do Not Invite' && invite !== 'Unknown') {
      tasks.push({
        title: `Send post-event thank-you to ${execReport.contact.name}`,
        description: `Send personalized thank-you note within 24 hours of event, referencing specific discussion points.`,
        owner: 'Account Manager',
        priority: 'high',
        deadline: '1 day after event',
        dependencies: [],
        status: 'not_started',
        confidence: 85,
        reasoning: `Post-event thank-you within 24 hours reinforces interaction. Communication style is "${ActionHelper.communicationStyle(execReport)}".`,
        factIds: [...execReport.persona.communicationStyle.factIds],
        sourceIds: [...execReport.persona.communicationStyle.sourceIds],
      });
    }

    // Task 8: Post-event strategy meeting
    if (invite === 'Invite Immediately' || invite === 'Invite') {
      tasks.push({
        title: `Schedule post-event strategy meeting with ${execReport.contact.name}`,
        description: `Arrange follow-up meeting to discuss ${ActionHelper.strategicPriorityValues(execReport).slice(0, 2).join(' and ')} and explore collaboration opportunities.`,
        owner: 'Account Manager',
        priority: 'high',
        deadline: '1 week after event',
        dependencies: ['Send post-event thank-you'],
        status: 'not_started',
        confidence: ActionHelper.clampConfidence(
          ActionHelper.executiveConfidence(execReport) * 0.5 + ActionHelper.relationshipScore(relReport) * 0.5,
        ),
        reasoning: `Executive has ${execReport.persona.strategicPriorities.length} strategic priorities. Relationship score is ${ActionHelper.relationshipScore(relReport)}.`,
        factIds: execReport.persona.strategicPriorities.slice(0, 2).flatMap((p) => p.factIds),
        sourceIds: execReport.persona.strategicPriorities.slice(0, 2).flatMap((p) => p.sourceIds),
      });
    }

    const confidence = tasks.length > 0
      ? ActionHelper.clampConfidence(ActionHelper.mergeConfidence(tasks.map((t) => ({ confidence: t.confidence }))))
      : 0;
    const citations = ActionHelper.mergeCitations(tasks);

    return {
      tasks,
      confidence,
      reasoning: `Generated ${tasks.length} executable tasks from action plan. Based on invite decision "${invite}" and priority tier "${ActionHelper.priorityTier(decisionReport)}".`,
      factIds: citations.factIds,
      sourceIds: citations.sourceIds,
    };
  }

  private unknownTaskList(): TaskList {
    return {
      tasks: [],
      confidence: 0,
      reasoning: ActionHelper.insufficientReasoning(),
      factIds: [],
      sourceIds: [],
    };
  }
}
