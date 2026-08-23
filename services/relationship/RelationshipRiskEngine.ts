import type { ExecutiveIntelligenceReport } from '../intelligence/IntelligenceTypes';
import type { RelationshipRisk, RelationshipRiskType, RelationshipRiskSeverity } from './RelationshipTypes';
import { RelationshipHelper } from './RelationshipHelper';

/*
 * RelationshipRiskEngine — detects risks in the relationship intelligence.
 *
 * Identifies:
 *   - Weak evidence (low fact count, single source)
 *   - Sensitive topics (high risk appetite, controversial archetype signals)
 *   - Contradictory interests (overlapping but conflicting priorities)
 *   - Low confidence recommendations (below threshold)
 *   - Bias risks (all evidence from one source type)
 *   - Evidence gaps (missing persona attributes)
 *
 * Every risk includes severity, reason, and supporting evidence.
 */

export class RelationshipRiskEngine {
  assess(report: ExecutiveIntelligenceReport): RelationshipRisk[] {
    const risks: RelationshipRisk[] = [];

    risks.push(...this.detectWeakEvidence(report));
    risks.push(...this.detectSensitiveTopics(report));
    risks.push(...this.detectContradictoryInterests(report));
    risks.push(...this.detectLowConfidenceRecommendations(report));
    risks.push(...this.detectBiasRisks(report));
    risks.push(...this.detectEvidenceGaps(report));

    return risks;
  }

  // ── Weak Evidence ─────────────────────────────────

  private detectWeakEvidence(report: ExecutiveIntelligenceReport): RelationshipRisk[] {
    const risks: RelationshipRisk[] = [];
    const factCount = RelationshipHelper.totalFacts(report);
    const sourceCount = RelationshipHelper.totalSources(report);
    const trustScore = RelationshipHelper.trustScore(report);

    if (factCount < 5) {
      const severity: RelationshipRiskSeverity = factCount < 2 ? 'high' : 'medium';
      risks.push({
        type: 'weak_evidence',
        description: `Only ${factCount} fact(s) available in the source intelligence report`,
        severity,
        reason: `The Executive Intelligence Report contains only ${factCount} fact(s). Relationship recommendations derived from fewer than 5 facts are inherently unreliable and should be treated as preliminary.`,
        supportingEvidence: `Evidence summary: ${factCount} facts, ${sourceCount} sources, trust score ${trustScore}/100.`,
        citations: RelationshipHelper.emptyCitation(),
      });
    }

    if (sourceCount <= 1) {
      risks.push({
        type: 'weak_evidence',
        description: `Only ${sourceCount} source(s) in the source intelligence report`,
        severity: sourceCount === 0 ? 'high' : 'medium',
        reason: `The Executive Intelligence Report relies on only ${sourceCount} source(s). Single-source intelligence lacks corroboration and may contain bias.`,
        supportingEvidence: `Source count: ${sourceCount}. Trust score: ${trustScore}/100.`,
        citations: RelationshipHelper.emptyCitation(),
      });
    }

    return risks;
  }

  // ── Sensitive Topics ──────────────────────────────

  private detectSensitiveTopics(report: ExecutiveIntelligenceReport): RelationshipRisk[] {
    const risks: RelationshipRisk[] = [];

    if (report.persona.riskAppetite.value === 'High' && report.persona.riskAppetite.confidence >= 60) {
      risks.push({
        type: 'sensitive_topics',
        description: 'Executive has a High risk appetite — avoid overly conservative framing',
        severity: 'low',
        reason: `The executive's risk appetite is "${report.persona.riskAppetite.value}" with ${report.persona.riskAppetite.confidence}% confidence. Conservative or risk-averse framing may alienate them.`,
        supportingEvidence: `Risk appetite inference: "${report.persona.riskAppetite.value}" (${report.persona.riskAppetite.confidence}% confidence).`,
        citations: RelationshipHelper.collectFromInferences([report.persona.riskAppetite]),
      });
    }

    const negotiationStyle = report.persona.negotiationStyle;
    if (negotiationStyle.value === 'Competitive' && negotiationStyle.confidence >= 55) {
      risks.push({
        type: 'sensitive_topics',
        description: 'Executive has a Competitive negotiation style — avoid appearing concessionary',
        severity: 'medium',
        reason: `The executive's negotiation style is "${negotiationStyle.value}" with ${negotiationStyle.confidence}% confidence. Appearing too eager or concessionary may weaken DEL's position.`,
        supportingEvidence: `Negotiation style inference: "${negotiationStyle.value}" (${negotiationStyle.confidence}% confidence).`,
        citations: RelationshipHelper.collectFromInferences([negotiationStyle]),
      });
    }

    return risks;
  }

  // ── Contradictory Interests ────────────────────────

  private detectContradictoryInterests(report: ExecutiveIntelligenceReport): RelationshipRisk[] {
    const risks: RelationshipRisk[] = [];
    const priorities = report.persona.strategicPriorities;
    const interests = report.persona.businessInterests;

    const contradictions: string[] = [];
    const contradictionPairs: { factIds: string[]; sourceIds: string[] }[] = [];

    for (const priority of priorities) {
      for (const interest of interests) {
        const overlap = RelationshipHelper.tokenOverlapCount(priority.value, interest.value);
        if (overlap > 0) {
          const priorityTokens = priority.value.toLowerCase().split(/[\s,;&/|-]+/).filter((t) => t.length > 2);
          const interestTokens = interest.value.toLowerCase().split(/[\s,;&/|-]+/).filter((t) => t.length > 2);
          const prioritySet = new Set(priorityTokens);
          const interestSet = new Set(interestTokens);
          const hasOpposite =
            (prioritySet.has('risk') && interestSet.has('safety')) ||
            (prioritySet.has('cost') && interestSet.has('growth')) ||
            (prioritySet.has('conservative') && interestSet.has('aggressive'));
          if (hasOpposite) {
            contradictions.push(`"${priority.value}" conflicts with "${interest.value}"`);
            contradictionPairs.push({ factIds: [...priority.factIds, ...interest.factIds], sourceIds: [...priority.sourceIds, ...interest.sourceIds] });
          }
        }
      }
    }

    if (contradictions.length > 0) {
      risks.push({
        type: 'contradictory_interests',
        description: `${contradictions.length} contradictory interest pair(s) detected`,
        severity: 'medium',
        reason: `Strategic priorities and business interests contain potentially contradictory signals: ${contradictions.join('; ')}. These should be reconciled before relying on alignment recommendations.`,
        supportingEvidence: `Contradictions: ${contradictions.join('; ')}.`,
        citations: RelationshipHelper.collectFromInferences(contradictionPairs),
      });
    }

    return risks;
  }

  // ── Low Confidence Recommendations ───────────────

  private detectLowConfidenceRecommendations(report: ExecutiveIntelligenceReport): RelationshipRisk[] {
    const risks: RelationshipRisk[] = [];

    const lowConfOpps = report.opportunities.filter((o) => o.confidence < 40);
    if (lowConfOpps.length > 0) {
      risks.push({
        type: 'low_confidence_recommendations',
        description: `${lowConfOpps.length} opportunity(ies) have confidence below 40%`,
        severity: 'medium',
        reason: `${lowConfOpps.length} opportunity(ies) in the source report have confidence below 40%. Engagement strategies derived from these opportunities should be treated with caution.`,
        supportingEvidence: `Low-confidence opportunities: ${lowConfOpps.map((o) => o.value).join('; ')}.`,
        citations: RelationshipHelper.collectFromInferences(lowConfOpps),
      });
    }

    const lowConfPriorities = report.persona.strategicPriorities.filter((p) => p.confidence < 40);
    if (lowConfPriorities.length > 0) {
      risks.push({
        type: 'low_confidence_recommendations',
        description: `${lowConfPriorities.length} strategic priority(ies) have confidence below 40%`,
        severity: 'low',
        reason: `${lowConfPriorities.length} strategic priority(ies) have confidence below 40%. Conversation starters and alignment analysis based on these priorities may be unreliable.`,
        supportingEvidence: `Low-confidence priorities: ${lowConfPriorities.map((p) => p.value).join('; ')}.`,
        citations: RelationshipHelper.collectFromInferences(lowConfPriorities),
      });
    }

    return risks;
  }

  // ── Bias Risks ────────────────────────────────────

  private detectBiasRisks(report: ExecutiveIntelligenceReport): RelationshipRisk[] {
    const risks: RelationshipRisk[] = [];

    const sourceTypes = new Set<string>();
    for (const source of report.citations.sources) {
      const domain = this.extractDomain(source.url);
      if (domain) sourceTypes.add(domain);
    }

    if (sourceTypes.size === 1 && report.citations.sources.length > 2) {
      risks.push({
        type: 'bias_risk',
        description: 'All evidence from a single domain in the source report',
        severity: 'low',
        reason: `All ${report.citations.sources.length} source(s) originate from a single domain. This limits perspective diversity and may introduce publication bias in the relationship intelligence.`,
        supportingEvidence: `Unique domains: ${sourceTypes.size}. Total sources: ${report.citations.sources.length}.`,
        citations: RelationshipHelper.emptyCitation(),
      });
    }

    const tier1Count = report.evidenceSummary.tier1Count;
    const totalSources = RelationshipHelper.totalSources(report);
    if (totalSources > 0 && tier1Count === 0) {
      risks.push({
        type: 'bias_risk',
        description: 'No tier-1 (high-authority) sources in the source report',
        severity: 'medium',
        reason: `The source intelligence report contains ${totalSources} source(s) but none are tier-1 (high authority). Relationship recommendations may be based on lower-quality evidence.`,
        supportingEvidence: `Tier-1 sources: ${tier1Count}. Total sources: ${totalSources}.`,
        citations: RelationshipHelper.emptyCitation(),
      });
    }

    return risks;
  }

  // ── Evidence Gaps ─────────────────────────────────

  private detectEvidenceGaps(report: ExecutiveIntelligenceReport): RelationshipRisk[] {
    const risks: RelationshipRisk[] = [];

    const unknownAttributes: string[] = [];
    const persona = report.persona;
    const checks: { name: string; value: string }[] = [
      { name: 'leadership style', value: persona.leadershipStyle.value },
      { name: 'communication style', value: persona.communicationStyle.value },
      { name: 'decision style', value: persona.decisionStyle.value },
      { name: 'risk appetite', value: persona.riskAppetite.value },
      { name: 'innovation orientation', value: persona.innovationOrientation.value },
      { name: 'technology interest', value: persona.technologyInterest.value },
      { name: 'industry focus', value: persona.industryFocus.value },
      { name: 'influence level', value: persona.influenceLevel.value },
      { name: 'networking style', value: persona.networkingStyle.value },
      { name: 'negotiation style', value: persona.negotiationStyle.value },
    ];

    for (const check of checks) {
      if (check.value === 'Unknown') {
        unknownAttributes.push(check.name);
      }
    }

    if (unknownAttributes.length > 0) {
      const severity: RelationshipRiskSeverity =
        unknownAttributes.length >= 5 ? 'high' : unknownAttributes.length >= 3 ? 'medium' : 'low';

      risks.push({
        type: 'evidence_gap',
        description: `${unknownAttributes.length} persona attribute(s) are Unknown`,
        severity,
        reason: `${unknownAttributes.length} persona attribute(s) could not be determined: ${unknownAttributes.join(', ')}. Relationship recommendations that depend on these attributes will report "Unknown" rather than inventing data.`,
        supportingEvidence: `Unknown attributes: ${unknownAttributes.join(', ')}.`,
        citations: RelationshipHelper.emptyCitation(),
      });
    }

    if (report.persona.strategicPriorities.length === 0) {
      risks.push({
        type: 'evidence_gap',
        description: 'No strategic priorities identified in the source report',
        severity: 'medium',
        reason: 'The source intelligence report contains no strategic priorities. Engagement strategies and conversation starters that rely on priorities will have limited grounding.',
        supportingEvidence: 'Strategic priorities count: 0.',
        citations: RelationshipHelper.emptyCitation(),
      });
    }

    if (report.persona.businessInterests.length === 0) {
      risks.push({
        type: 'evidence_gap',
        description: 'No business interests identified in the source report',
        severity: 'medium',
        reason: 'The source intelligence report contains no business interests. Interest alignment and conversation starters that rely on interests will have limited grounding.',
        supportingEvidence: 'Business interests count: 0.',
        citations: RelationshipHelper.emptyCitation(),
      });
    }

    return risks;
  }

  private extractDomain(url: string): string {
    try {
      return new URL(url).hostname;
    } catch {
      return '';
    }
  }
}
