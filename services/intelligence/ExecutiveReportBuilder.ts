import type { EvidenceContext } from '../research/EvidenceContextBuilder';
import type {
  ExecutiveIntelligenceReport,
  ExecutivePersona,
  ReasoningChain,
  ArchetypeClassification,
  ExecutiveOpportunity,
  ExecutiveRisk,
  PersonaConfidenceSummary,
  TimelineEntry,
} from './IntelligenceTypes';
import { FactHelper } from './FactHelper';

/*
 * ExecutiveReportBuilder — assembles the final ExecutiveIntelligenceReport.
 *
 * Consumes outputs from all MP4 engines and produces one structured object
 * containing:
 *   Executive Summary, Persona, Leadership Analysis, Decision Analysis,
 *   Communication Analysis, Strategic Priorities, Business Interests,
 *   Influence, Opportunities, Risks, Timeline, Confidence Summary,
 *   Evidence Summary, Recommendations, Citations, Explainability
 */

export class ExecutiveReportBuilder {
  build(
    context: EvidenceContext,
    persona: ExecutivePersona,
    reasoning: ReasoningChain[],
    archetype: ArchetypeClassification,
    opportunities: ExecutiveOpportunity[],
    risks: ExecutiveRisk[],
    confidence: PersonaConfidenceSummary,
    timeline: TimelineEntry[],
    pipelineDurationMs: number,
  ): ExecutiveIntelligenceReport {
    const executiveSummary = this.buildExecutiveSummary(
      context,
      persona,
      archetype,
      confidence,
      opportunities,
      risks,
    );

    const leadershipAnalysis = this.buildLeadershipAnalysis(context, persona);
    const decisionAnalysis = this.buildDecisionAnalysis(context, persona);
    const communicationAnalysis = this.buildCommunicationAnalysis(context, persona);

    const recommendations = this.buildRecommendations(
      context,
      persona,
      archetype,
      opportunities,
      risks,
      confidence,
    );

    const citations = this.buildCitations(context);
    const explainability = this.buildExplainability(
      context,
      persona,
      reasoning,
      opportunities,
      risks,
    );

    const evidenceSummary = {
      totalSources: context.metadata.totalSources,
      totalFacts: context.allFacts.length,
      verifiedFacts: context.verification.verifiedCount,
      conflictingFacts: context.verification.conflictingCount,
      trustScore: context.trustScore,
      completeness: context.completeness,
      averageAuthority: context.authority.averageAuthority,
      tier1Count: context.authority.tier1Count,
      tier2Count: context.authority.tier2Count,
      tier3Count: context.authority.tier3Count,
    };

    const allFactIds = new Set<string>();
    const allSourceIds = new Set<string>();
    for (const inf of [persona.leadershipStyle, persona.communicationStyle, persona.decisionStyle,
      persona.riskAppetite, persona.innovationOrientation, persona.technologyInterest,
      persona.industryFocus, persona.influenceLevel, persona.networkingStyle, persona.negotiationStyle]) {
      for (const fid of inf.factIds) allFactIds.add(fid);
      for (const sid of inf.sourceIds) allSourceIds.add(sid);
    }
    for (const inf of persona.strategicPriorities) {
      for (const fid of inf.factIds) allFactIds.add(fid);
      for (const sid of inf.sourceIds) allSourceIds.add(sid);
    }
    for (const inf of persona.businessInterests) {
      for (const fid of inf.factIds) allFactIds.add(fid);
      for (const sid of inf.sourceIds) allSourceIds.add(sid);
    }
    for (const opp of opportunities) {
      for (const fid of opp.factIds) allFactIds.add(fid);
      for (const sid of opp.sourceIds) allSourceIds.add(sid);
    }

    return {
      contact: {
        id: context.contact.id,
        name: context.contact.name,
        title: context.contact.title,
        company: context.contact.company,
      },
      executiveSummary,
      persona,
      reasoning,
      archetypeClassification: archetype,
      leadershipAnalysis,
      decisionAnalysis,
      communicationAnalysis,
      strategicPriorities: persona.strategicPriorities,
      businessInterests: persona.businessInterests,
      influence: persona.influenceLevel,
      opportunities,
      risks,
      timeline,
      confidenceSummary: confidence,
      evidenceSummary,
      recommendations,
      citations: {
        factIds: Array.from(allFactIds),
        sourceIds: Array.from(allSourceIds),
        sources: citations.sources,
      },
      explainability,
      metadata: {
        generatedAt: new Date().toISOString(),
        pipelineDurationMs,
        modules: [
          'ExecutivePersonaEngine',
          'PersonaReasoningEngine',
          'ExecutiveArchetypeClassifier',
          'ExecutiveOpportunityEngine',
          'ExecutiveRiskEngine',
          'PersonaConfidenceEngine',
          'ExecutiveTimelineBuilder',
          'ExecutiveReportBuilder',
        ],
        inferenceCount: this.countInferences(persona, opportunities, risks),
        reasoningCount: reasoning.length,
        riskCount: risks.length,
        opportunityCount: opportunities.length,
      },
    };
  }

  // ── Executive Summary ──────────────────────────────

  private buildExecutiveSummary(
    context: EvidenceContext,
    persona: ExecutivePersona,
    archetype: ArchetypeClassification,
    confidence: PersonaConfidenceSummary,
    opportunities: ExecutiveOpportunity[],
    risks: ExecutiveRisk[],
  ): ExecutiveIntelligenceReport['executiveSummary'] {
    const keyFindings: string[] = [];

    if (persona.leadershipStyle.value !== 'Unknown') {
      keyFindings.push(`Leadership style: ${persona.leadershipStyle.value} (${persona.leadershipStyle.confidence}% confidence)`);
    }
    if (persona.decisionStyle.value !== 'Unknown') {
      keyFindings.push(`Decision style: ${persona.decisionStyle.value} (${persona.decisionStyle.confidence}% confidence)`);
    }
    if (persona.innovationOrientation.value !== 'Unknown') {
      keyFindings.push(`Innovation orientation: ${persona.innovationOrientation.value} (${persona.innovationOrientation.confidence}% confidence)`);
    }
    if (archetype.archetype !== 'Unknown') {
      keyFindings.push(`Archetype: ${archetype.archetype} (${archetype.confidence}% confidence)`);
    }
    if (persona.influenceLevel.value !== 'Unknown') {
      keyFindings.push(`Influence level: ${persona.influenceLevel.value} (${persona.influenceLevel.confidence}% confidence)`);
    }
    keyFindings.push(`${opportunities.length} opportunity(ies) identified`);
    keyFindings.push(`${risks.length} risk(s) detected`);

    const summary = `${context.contact.name} (${context.contact.title || 'N/A'} at ${context.contact.company}) is analyzed as a ${archetype.archetype} archetype with ${confidence.overall}% overall persona confidence (${confidence.level}). The evidence base includes ${context.metadata.totalSources} sources and ${context.allFacts.length} verified facts. ${persona.strategicPriorities.length} strategic priority(ies) and ${persona.businessInterests.length} business interest(s) were identified.`;

    return {
      summary,
      keyFindings,
      overallConfidence: confidence.overall,
      archetype: archetype.archetype,
    };
  }

  // ── Leadership Analysis ────────────────────────────

  private buildLeadershipAnalysis(
    context: EvidenceContext,
    persona: ExecutivePersona,
  ): ExecutiveIntelligenceReport['leadershipAnalysis'] {
    const style = persona.leadershipStyle;
    const indicators: string[] = [];

    if (style.factIds.length > 0) {
      const facts = context.allFacts.filter((f) => style.factIds.includes(f.factId));
      for (const fact of facts.slice(0, 5)) {
        indicators.push(`${fact.predicate}: ${fact.value} (${fact.confidence}%)`);
      }
    }

    if (indicators.length === 0) {
      indicators.push('No leadership indicators found in evidence');
    }

    const summary = style.value === 'Unknown'
      ? `Leadership style could not be determined from available evidence. ${style.reasoning}`
      : `Leadership style is ${style.value} with ${style.confidence}% confidence. ${style.reasoning}`;

    return { summary, style, indicators };
  }

  // ── Decision Analysis ──────────────────────────────

  private buildDecisionAnalysis(
    context: EvidenceContext,
    persona: ExecutivePersona,
  ): ExecutiveIntelligenceReport['decisionAnalysis'] {
    const style = persona.decisionStyle;
    const indicators: string[] = [];

    if (style.factIds.length > 0) {
      const facts = context.allFacts.filter((f) => style.factIds.includes(f.factId));
      for (const fact of facts.slice(0, 5)) {
        indicators.push(`${fact.predicate}: ${fact.value} (${fact.confidence}%)`);
      }
    }

    if (indicators.length === 0) {
      indicators.push('No decision-making indicators found in evidence');
    }

    const summary = style.value === 'Unknown'
      ? `Decision style could not be determined from available evidence. ${style.reasoning}`
      : `Decision style is ${style.value} with ${style.confidence}% confidence. ${style.reasoning}`;

    return { summary, style, indicators };
  }

  // ── Communication Analysis ─────────────────────────

  private buildCommunicationAnalysis(
    context: EvidenceContext,
    persona: ExecutivePersona,
  ): ExecutiveIntelligenceReport['communicationAnalysis'] {
    const style = persona.communicationStyle;
    const indicators: string[] = [];

    if (style.factIds.length > 0) {
      const facts = context.allFacts.filter((f) => style.factIds.includes(f.factId));
      for (const fact of facts.slice(0, 5)) {
        indicators.push(`${fact.predicate}: ${fact.value} (${fact.confidence}%)`);
      }
    }

    if (indicators.length === 0) {
      indicators.push('No communication indicators found in evidence');
    }

    const summary = style.value === 'Unknown'
      ? `Communication style could not be determined from available evidence. ${style.reasoning}`
      : `Communication style is ${style.value} with ${style.confidence}% confidence. ${style.reasoning}`;

    return { summary, style, indicators };
  }

  // ── Recommendations ────────────────────────────────

  private buildRecommendations(
    context: EvidenceContext,
    persona: ExecutivePersona,
    archetype: ArchetypeClassification,
    opportunities: ExecutiveOpportunity[],
    risks: ExecutiveRisk[],
    confidence: PersonaConfidenceSummary,
  ): ExecutiveIntelligenceReport['recommendations'] {
    const recommendations: ExecutiveIntelligenceReport['recommendations'] = [];

    for (const opp of opportunities.slice(0, 5)) {
      recommendations.push({
        value: `Engage on ${opp.type.replace(/_/g, ' ')} — ${opp.value}`,
        reasoning: opp.reasoning,
        confidence: opp.confidence,
        factIds: opp.factIds,
      });
    }

    if (archetype.archetype !== 'Unknown') {
      recommendations.push({
        value: `Tailor outreach to the ${archetype.archetype} archetype`,
        reasoning: archetype.reasoning,
        confidence: archetype.confidence,
        factIds: archetype.factIds,
      });
    }

    const highRisks = risks.filter((r) => r.severity === 'high');
    if (highRisks.length > 0) {
      recommendations.push({
        value: `Address ${highRisks.length} high-severity risk(s) before relying on this intelligence`,
        reasoning: highRisks.map((r) => r.value).join('; '),
        confidence: 100,
        factIds: [],
      });
    }

    if (confidence.level === 'low') {
      recommendations.push({
        value: 'Supplement with additional research before acting',
        reasoning: `Overall confidence is ${confidence.overall}/100 (${confidence.level}). Additional evidence collection is recommended before using this intelligence for outreach decisions.`,
        confidence: 100,
        factIds: [],
      });
    }

    return recommendations;
  }

  // ── Citations ──────────────────────────────────────

  private buildCitations(
    context: EvidenceContext,
  ): ExecutiveIntelligenceReport['citations'] {
    const factIds = context.allFacts.map((f) => f.factId);
    const sourceIds = context.sources.map((s) => s.sourceId);

    const sources = context.sources.map((s) => ({
      sourceId: s.sourceId,
      sourceName: s.sourceName,
      url: s.url,
      authorityScore: s.authorityScore,
      tier: s.sourceTier,
    }));

    return { factIds, sourceIds, sources };
  }

  // ── Explainability ─────────────────────────────────

  private buildExplainability(
    context: EvidenceContext,
    persona: ExecutivePersona,
    reasoning: ReasoningChain[],
    opportunities: ExecutiveOpportunity[],
    risks: ExecutiveRisk[],
  ): ExecutiveIntelligenceReport['explainability'] {
    let totalInferences = 0;
    let groundedInferences = 0;

    const allInferences: { factIds: string[] }[] = [
      persona.leadershipStyle,
      persona.communicationStyle,
      persona.decisionStyle,
      persona.riskAppetite,
      persona.innovationOrientation,
      persona.technologyInterest,
      persona.industryFocus,
      persona.influenceLevel,
      persona.networkingStyle,
      persona.negotiationStyle,
      ...persona.strategicPriorities,
      ...persona.businessInterests,
      ...opportunities,
    ];

    for (const inf of allInferences) {
      totalInferences++;
      if (inf.factIds.length > 0) groundedInferences++;
    }

    const ungroundedInferences = totalInferences - groundedInferences;
    const groundingRate = totalInferences > 0
      ? Math.round((groundedInferences / totalInferences) * 100)
      : 0;

    const reasoningCoverage = totalInferences > 0
      ? Math.round((reasoning.length / totalInferences) * 100)
      : 0;

    const citedFactIds = new Set<string>();
    for (const inf of allInferences) {
      for (const fid of inf.factIds) citedFactIds.add(fid);
    }
    const citationCoverage = context.allFacts.length > 0
      ? Math.round((citedFactIds.size / context.allFacts.length) * 100)
      : 0;

    const explanation = `This report contains ${totalInferences} inference(s): ${groundedInferences} grounded in evidence (${groundingRate}% grounding rate), ${ungroundedInferences} ungrounded. Reasoning chains cover ${reasoningCoverage}% of inferences. ${citationCoverage}% of available facts are cited by at least one inference. ${risks.length} risk(s) were detected.`;

    return {
      totalInferences,
      groundedInferences,
      ungroundedInferences,
      groundingRate,
      reasoningCoverage,
      citationCoverage,
      explanation,
    };
  }

  // ── Helpers ────────────────────────────────────────

  private countInferences(
    persona: ExecutivePersona,
    opportunities: ExecutiveOpportunity[],
    risks: ExecutiveRisk[],
  ): number {
    return 10 + persona.strategicPriorities.length + persona.businessInterests.length + opportunities.length + risks.length;
  }
}
