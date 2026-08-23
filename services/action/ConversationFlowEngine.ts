import type { ExecutiveIntelligenceReport } from '../intelligence/IntelligenceTypes';
import type { RelationshipIntelligenceReport } from '../relationship/RelationshipTypes';
import type { StrategicDecisionReport } from '../decision/DecisionTypes';
import type { ConversationFlow, ConversationSection, ConversationSectionType } from './ActionTypes';
import { ActionHelper } from './ActionHelper';

/*
 * ConversationFlowEngine — constructs a guided conversation flow.
 *
 * Consumes MP4, MP5, and MP6 public interfaces.
 * Constructs 8 sections: Opening, Rapport, Industry Discussion, Technology Discussion,
 * Business Discussion, Strategic Opportunity, Call to Action, Closing.
 *
 * Never invents talking points — only derives from MP4 and MP5 data.
 * Every section includes confidence, reasoning, factIds, sourceIds.
 * Returns Unknown when insufficient evidence.
 */

export class ConversationFlowEngine {
  generate(
    execReport: ExecutiveIntelligenceReport,
    relReport: RelationshipIntelligenceReport,
    decisionReport: StrategicDecisionReport,
  ): ConversationFlow {
    if (ActionHelper.isInsufficientEvidence(execReport, relReport, decisionReport)) {
      return this.unknownFlow();
    }

    const sections: ConversationSection[] = [
      this.buildOpening(execReport, relReport),
      this.buildRapport(execReport, relReport),
      this.buildIndustryDiscussion(execReport),
      this.buildTechnologyDiscussion(execReport),
      this.buildBusinessDiscussion(execReport, relReport),
      this.buildStrategicOpportunity(execReport, relReport, decisionReport),
      this.buildCallToAction(execReport, relReport, decisionReport),
      this.buildClosing(execReport, relReport),
    ];

    const confidence = ActionHelper.clampConfidence(
      ActionHelper.mergeConfidence(sections.map((s) => ({ confidence: s.confidence }))),
    );

    const citations = ActionHelper.mergeCitations(sections);

    return {
      sections,
      confidence,
      reasoning: `Conversation flow derived from executive archetype "${ActionHelper.archetype(execReport)}", communication style "${ActionHelper.communicationStyle(execReport)}", and relationship stage "${ActionHelper.relationshipStage(relReport)}". 8 sections covering opening through closing.`,
      factIds: citations.factIds,
      sourceIds: citations.sourceIds,
    };
  }

  private buildOpening(
    execReport: ExecutiveIntelligenceReport,
    relReport: RelationshipIntelligenceReport,
  ): ConversationSection {
    const stage = ActionHelper.relationshipStage(relReport);
    const commStyle = ActionHelper.communicationStyle(execReport);
    const name = execReport.contact.name;

    const talkingPoints: string[] = [];
    const factIds: string[] = [];
    const sourceIds: string[] = [];

    if (stage === 'First Contact' || stage === 'Unknown') {
      talkingPoints.push(`Introduce yourself and your organization's mission`);
      talkingPoints.push(`Reference ${name}'s role as ${execReport.contact.title} at ${execReport.contact.company}`);
    } else {
      talkingPoints.push(`Acknowledge existing connection from ${stage} stage`);
      talkingPoints.push(`Reference shared context from previous interactions`);
    }

    if (commStyle === 'Direct') {
      talkingPoints.push(`Be concise and get to the point quickly — ${name} prefers direct communication`);
    } else if (commStyle === 'Analytical' || commStyle === 'Data-driven') {
      talkingPoints.push(`Reference specific data points or industry metrics in opening`);
    } else if (commStyle === 'Visionary') {
      talkingPoints.push(`Open with a forward-looking industry perspective`);
    } else if (commStyle === 'Collaborative') {
      talkingPoints.push(`Frame conversation as a collaborative exploration`);
    }

    factIds.push(...relReport.relationshipProfile.citations.factIds);
    sourceIds.push(...relReport.relationshipProfile.citations.sourceIds);
    factIds.push(...execReport.persona.communicationStyle.factIds);
    sourceIds.push(...execReport.persona.communicationStyle.sourceIds);

    return {
      section: 'Opening',
      purpose: `Establish a positive first impression and set the tone for a ${commStyle} conversation with ${name}.`,
      talkingPoints,
      avoidTopics: ['Personal questions before rapport is established', 'Sales pitches', 'Controversial industry opinions'],
      confidence: ActionHelper.clampConfidence(
        (relReport.relationshipProfile.stageConfidence + execReport.persona.communicationStyle.confidence) / 2,
      ),
      reasoning: `Relationship stage is "${stage}" (confidence ${relReport.relationshipProfile.stageConfidence}). Communication style is "${commStyle}" (confidence ${execReport.persona.communicationStyle.confidence}).`,
      factIds,
      sourceIds,
    };
  }

  private buildRapport(
    execReport: ExecutiveIntelligenceReport,
    relReport: RelationshipIntelligenceReport,
  ): ConversationSection {
    const talkingPoints: string[] = [];
    const factIds: string[] = [];
    const sourceIds: string[] = [];

    // Derive from conversation starters in MP5
    const starters = relReport.conversationStarters.slice(0, 3);
    for (const starter of starters) {
      talkingPoints.push(`${starter.topic}: "${starter.suggestedQuestion}"`);
      factIds.push(...starter.citations.factIds);
      sourceIds.push(...starter.citations.sourceIds);
    }

    // Add rapport-based talking points
    const rapport = relReport.rapport;
    if (rapport.communicationCompatibility === 'High' || rapport.communicationCompatibility === 'Moderate') {
      talkingPoints.push(`Leverage ${rapport.communicationCompatibility} communication compatibility for natural rapport`);
    }

    // Networking style influences rapport approach
    const networkingStyle = ActionHelper.networkingStyle(execReport);
    if (networkingStyle === 'Relationship Builder') {
      talkingPoints.push(`Focus on personal connection — ${execReport.contact.name} values relationship-first approach`);
    } else if (networkingStyle === 'Strategic Networker') {
      talkingPoints.push(`Connect through shared strategic interests and industry context`);
    } else if (networkingStyle === 'Community Builder') {
      talkingPoints.push(`Reference community or industry ecosystem involvement`);
    }

    factIds.push(...execReport.persona.networkingStyle.factIds);
    sourceIds.push(...execReport.persona.networkingStyle.sourceIds);

    return {
      section: 'Rapport',
      purpose: `Build genuine rapport with ${execReport.contact.name} using conversation starters derived from relationship intelligence.`,
      talkingPoints,
      avoidTopics: ['Overly personal topics', 'Sensitive company matters', 'Gossip about competitors'],
      confidence: ActionHelper.clampConfidence(
        ActionHelper.mergeConfidence([
          { confidence: relReport.rapport.communicationScore },
          { confidence: relReport.confidenceSummary.rapportConfidence },
          { confidence: execReport.persona.networkingStyle.confidence },
        ]),
      ),
      reasoning: `${starters.length} conversation starters from relationship intelligence. Communication compatibility is "${rapport.communicationCompatibility}". Networking style is "${networkingStyle}".`,
      factIds,
      sourceIds,
    };
  }

  private buildIndustryDiscussion(execReport: ExecutiveIntelligenceReport): ConversationSection {
    const industry = ActionHelper.industryFocus(execReport);
    const talkingPoints: string[] = [];
    const factIds: string[] = [];
    const sourceIds: string[] = [];

    if (!ActionHelper.isUnknown(industry)) {
      talkingPoints.push(`Discuss current trends in ${industry}`);
      factIds.push(...execReport.persona.industryFocus.factIds);
      sourceIds.push(...execReport.persona.industryFocus.sourceIds);
    }

    // Add opportunity-related industry themes
    const themes = ActionHelper.opportunityThemes(execReport);
    for (const theme of themes.slice(0, 2)) {
      talkingPoints.push(`Explore ${theme} as an emerging industry theme`);
    }
    factIds.push(...execReport.opportunities.flatMap((o) => o.factIds).slice(0, 5));
    sourceIds.push(...execReport.opportunities.flatMap((o) => o.sourceIds).slice(0, 5));

    // Add timeline-relevant industry events
    const recentTimeline = execReport.timeline
      .filter((t) => t.type === 'news' || t.type === 'company_event' || t.type === 'speaking')
      .slice(0, 2);
    for (const entry of recentTimeline) {
      talkingPoints.push(`Reference recent development: ${entry.title}`);
      factIds.push(...entry.factIds);
      sourceIds.push(...entry.sourceIds);
    }

    return {
      section: 'Industry Discussion',
      purpose: `Engage ${execReport.contact.name} in a substantive discussion about ${industry === 'Unknown' ? 'their industry' : industry} trends and developments.`,
      talkingPoints: talkingPoints.length > 0 ? talkingPoints : ['Discuss general industry trends and developments'],
      avoidTopics: ['Speculation about competitors\' strategies', 'Unverified industry rumors', 'Negative commentary about specific companies'],
      confidence: ActionHelper.clampConfidence(
        ActionHelper.mergeConfidence([
          { confidence: execReport.persona.industryFocus.confidence },
          { confidence: ActionHelper.maxConfidence(execReport.opportunities.map((o) => ({ confidence: o.confidence }))) },
        ]),
      ),
      reasoning: `Industry focus is "${industry}" with confidence ${execReport.persona.industryFocus.confidence}. ${themes.length} opportunity themes and ${recentTimeline.length} recent timeline entries available.`,
      factIds,
      sourceIds,
    };
  }

  private buildTechnologyDiscussion(execReport: ExecutiveIntelligenceReport): ConversationSection {
    const tech = ActionHelper.technologyInterest(execReport);
    const innovation = execReport.persona.innovationOrientation.value;
    const talkingPoints: string[] = [];
    const factIds: string[] = [];
    const sourceIds: string[] = [];

    if (!ActionHelper.isUnknown(tech)) {
      talkingPoints.push(`Discuss ${execReport.contact.name}'s interest in ${tech}`);
      factIds.push(...execReport.persona.technologyInterest.factIds);
      sourceIds.push(...execReport.persona.technologyInterest.sourceIds);
    }

    if (!ActionHelper.isUnknown(innovation)) {
      talkingPoints.push(`Explore ${innovation} approach to technology adoption`);
      factIds.push(...execReport.persona.innovationOrientation.factIds);
      sourceIds.push(...execReport.persona.innovationOrientation.sourceIds);
    }

    // Technology-related opportunities
    const techOpps = execReport.opportunities.filter(
      (o) => o.type === 'technology_adoption' || o.type === 'ai_adoption' || o.type === 'cloud' || o.type === 'cybersecurity',
    );
    for (const opp of techOpps.slice(0, 2)) {
      talkingPoints.push(`Discuss ${opp.value}`);
      factIds.push(...opp.factIds);
      sourceIds.push(...opp.sourceIds);
    }

    return {
      section: 'Technology Discussion',
      purpose: `Explore ${execReport.contact.name}'s technology interests and innovation orientation.`,
      talkingPoints: talkingPoints.length > 0
        ? talkingPoints
        : ['Ask about technology initiatives and digital transformation priorities'],
      avoidTopics: ['Technical jargon without business context', 'Vendor-specific product pitches', 'Criticism of current technology stack'],
      confidence: ActionHelper.clampConfidence(
        ActionHelper.mergeConfidence([
          { confidence: execReport.persona.technologyInterest.confidence },
          { confidence: execReport.persona.innovationOrientation.confidence },
        ]),
      ),
      reasoning: `Technology interest is "${tech}" (confidence ${execReport.persona.technologyInterest.confidence}). Innovation orientation is "${innovation}" (confidence ${execReport.persona.innovationOrientation.confidence}). ${techOpps.length} technology opportunities identified.`,
      factIds,
      sourceIds,
    };
  }

  private buildBusinessDiscussion(
    execReport: ExecutiveIntelligenceReport,
    relReport: RelationshipIntelligenceReport,
  ): ConversationSection {
    const talkingPoints: string[] = [];
    const factIds: string[] = [];
    const sourceIds: string[] = [];

    // Strategic priorities
    const priorities = execReport.persona.strategicPriorities.filter((p) => p.confidence >= 30);
    for (const priority of priorities.slice(0, 3)) {
      talkingPoints.push(`Discuss strategic priority: ${priority.value}`);
      factIds.push(...priority.factIds);
      sourceIds.push(...priority.sourceIds);
    }

    // Business interests
    const interests = execReport.persona.businessInterests.filter((b) => b.confidence >= 30);
    for (const interest of interests.slice(0, 2)) {
      talkingPoints.push(`Explore business interest: ${interest.value}`);
      factIds.push(...interest.factIds);
      sourceIds.push(...interest.sourceIds);
    }

    // Alignment dimensions from MP5
    const alignments = relReport.alignmentAnalysis.filter((a) => a.alignmentScore >= 50);
    for (const align of alignments.slice(0, 2)) {
      talkingPoints.push(`Reference alignment on: ${align.matchedItems.join(', ')}`);
      factIds.push(...align.citations.factIds);
      sourceIds.push(...align.citations.sourceIds);
    }

    return {
      section: 'Business Discussion',
      purpose: `Discuss ${execReport.contact.name}'s strategic priorities and business interests to identify collaboration areas.`,
      talkingPoints: talkingPoints.length > 0
        ? talkingPoints
        : ['Ask about current business priorities and challenges'],
      avoidTopics: ['Confidential competitive intelligence', 'Revenue or financial details', 'Criticism of their strategy'],
      confidence: ActionHelper.clampConfidence(
        ActionHelper.mergeConfidence([
          ...priorities.map((p) => ({ confidence: p.confidence })),
          ...interests.map((i) => ({ confidence: i.confidence })),
          ...alignments.map((a) => ({ confidence: a.alignmentScore })),
        ]),
      ),
      reasoning: `${priorities.length} strategic priorities and ${interests.length} business interests identified. ${alignments.length} alignment dimensions with score ≥50.`,
      factIds,
      sourceIds,
    };
  }

  private buildStrategicOpportunity(
    execReport: ExecutiveIntelligenceReport,
    relReport: RelationshipIntelligenceReport,
    decisionReport: StrategicDecisionReport,
  ): ConversationSection {
    const talkingPoints: string[] = [];
    const factIds: string[] = [];
    const sourceIds: string[] = [];

    // Top opportunity from MP6
    const topOpp = decisionReport.opportunityAnalysis
      .filter((o) => o.matchScore >= 50)
      .sort((a, b) => b.matchScore - a.matchScore)[0];

    if (topOpp) {
      talkingPoints.push(`Propose ${topOpp.role} collaboration with match score ${topOpp.matchScore}`);
      factIds.push(...topOpp.factIds);
      sourceIds.push(...topOpp.sourceIds);
    }

    // Strategic benefits from MP6
    const benefits = decisionReport.strategicBenefits.slice(0, 2);
    for (const benefit of benefits) {
      talkingPoints.push(`Highlight benefit: ${benefit.benefit}`);
      factIds.push(...benefit.factIds);
      sourceIds.push(...benefit.sourceIds);
    }

    // Event fit
    if (decisionReport.eventFit.overallFitScore >= 50) {
      talkingPoints.push(`Reference event fit score ${decisionReport.eventFit.overallFitScore} for ${decisionReport.event.name}`);
      factIds.push(...decisionReport.eventFit.citations.factIds);
      sourceIds.push(...decisionReport.eventFit.citations.sourceIds);
    }

    return {
      section: 'Strategic Opportunity',
      purpose: `Present strategic collaboration opportunities aligned with ${execReport.contact.name}'s profile and event context.`,
      talkingPoints: talkingPoints.length > 0
        ? talkingPoints
        : ['Explore general collaboration opportunities'],
      avoidTopics: ['Hard sales tactics', 'Unrealistic commitments', 'Pressure for immediate decisions'],
      confidence: ActionHelper.clampConfidence(
        ActionHelper.mergeConfidence([
          { confidence: topOpp?.confidence ?? 0 },
          ...benefits.map((b) => ({ confidence: b.confidence })),
          { confidence: decisionReport.eventFit.confidence },
        ]),
      ),
      reasoning: `Top opportunity role is "${topOpp?.role ?? 'None'}" with match score ${topOpp?.matchScore ?? 0}. ${benefits.length} strategic benefits. Event fit score is ${decisionReport.eventFit.overallFitScore}.`,
      factIds,
      sourceIds,
    };
  }

  private buildCallToAction(
    execReport: ExecutiveIntelligenceReport,
    relReport: RelationshipIntelligenceReport,
    decisionReport: StrategicDecisionReport,
  ): ConversationSection {
    const talkingPoints: string[] = [];
    const factIds: string[] = [];
    const sourceIds: string[] = [];

    const invite = decisionReport.inviteRecommendation.decision;
    const readiness = ActionHelper.engagementReadiness(relReport);

    if (invite === 'Invite Immediately' || invite === 'Invite') {
      talkingPoints.push(`Extend formal invitation to ${decisionReport.event.name}`);
      factIds.push(...decisionReport.inviteRecommendation.factIds);
      sourceIds.push(...decisionReport.inviteRecommendation.sourceIds);
    }

    if (readiness === 'Ready' || readiness === 'Highly Ready') {
      talkingPoints.push(`Propose a follow-up meeting within 2 weeks`);
      factIds.push(...relReport.relationshipProfile.citations.factIds);
      sourceIds.push(...relReport.relationshipProfile.citations.sourceIds);
    }

    const topRoles = ActionHelper.topOpportunityRoles(decisionReport);
    if (topRoles.includes('partner')) {
      talkingPoints.push(`Suggest exploring a strategic partnership discussion`);
    }
    if (topRoles.includes('speaker') || topRoles.includes('panelist')) {
      talkingPoints.push(`Invite to speak or participate as panelist at ${decisionReport.event.name}`);
    }

    if (talkingPoints.length === 0) {
      talkingPoints.push(`Invite to stay in touch and explore future collaboration`);
    }

    return {
      section: 'Call to Action',
      purpose: `Convert conversation into a concrete next step with ${execReport.contact.name}.`,
      talkingPoints,
      avoidTopics: ['Vague commitments without timelines', 'Multiple asks in one conversation', 'Pressure tactics'],
      confidence: ActionHelper.clampConfidence(
        ActionHelper.mergeConfidence([
          { confidence: decisionReport.inviteRecommendation.confidence },
          { confidence: relReport.relationshipProfile.readinessConfidence },
        ]),
      ),
      reasoning: `Invite decision is "${invite}". Engagement readiness is "${readiness}". Top roles: ${topRoles.join(', ') || 'None'}.`,
      factIds,
      sourceIds,
    };
  }

  private buildClosing(
    execReport: ExecutiveIntelligenceReport,
    relReport: RelationshipIntelligenceReport,
  ): ConversationSection {
    const talkingPoints: string[] = [];
    const factIds: string[] = [];
    const sourceIds: string[] = [];

    const networkingStyle = ActionHelper.networkingStyle(execReport);
    talkingPoints.push(`Thank ${execReport.contact.name} for their time and insights`);
    talkingPoints.push(`Summarize key takeaways and agreed next steps`);

    if (networkingStyle === 'Relationship Builder' || networkingStyle === 'Community Builder') {
      talkingPoints.push(`Express interest in staying connected and supporting their initiatives`);
    }

    talkingPoints.push(`Send a follow-up email within 24 hours with referenced materials`);

    // Follow-up plan from MP5
    const followUps = relReport.followUpPlan.filter((f) => f.phase === 'Immediately After').slice(0, 1);
    for (const fu of followUps) {
      talkingPoints.push(`Follow-up action: ${fu.action}`);
      factIds.push(...fu.citations.factIds);
      sourceIds.push(...fu.citations.sourceIds);
    }

    return {
      section: 'Closing',
      purpose: `End conversation positively with clear next steps and a warm professional closing.`,
      talkingPoints,
      avoidTopics: ['Ending abruptly', 'Leaving next steps ambiguous', 'Over-promising on deliverables'],
      confidence: ActionHelper.clampConfidence(
        ActionHelper.mergeConfidence([
          { confidence: relReport.confidenceSummary.followUpConfidence },
          { confidence: execReport.persona.networkingStyle.confidence },
        ]),
      ),
      reasoning: `Networking style is "${networkingStyle}". ${followUps.length} immediate follow-up actions from relationship intelligence.`,
      factIds,
      sourceIds,
    };
  }

  private unknownFlow(): ConversationFlow {
    return {
      sections: [],
      confidence: 0,
      reasoning: ActionHelper.insufficientReasoning(),
      factIds: [],
      sourceIds: [],
    };
  }
}
