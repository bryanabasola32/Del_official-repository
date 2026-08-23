import type { EvidenceContext, ContextFact } from './EvidenceContextBuilder';
import type { ConfidenceAssessment } from './ConfidencePropagator';
import type { CitationMap, CitationEntry } from './CitationMapper';

/*
 * ExplainabilityLayer — auto-generates explanations for AI-generated outputs.
 *
 * Every generated persona, recommendation, or invitation should answer:
 *   - Which verified facts were used?
 *   - Which sources supported those facts?
 *   - What confidence was assigned?
 *   - Were any conflicts detected?
 *   - What evidence was missing?
 *
 * The AI should never need to infer these explanations.
 * DEL provides them directly via this layer.
 *
 * The ExplainabilityLayer consumes CitationMapper output when available,
 * providing richer traceability with per-statement source references.
 */

export interface FactTraceability {
  /** The claim or statement being traced */
  claim: string;
  /** Fact IDs that support this claim */
  supportingFactIds: string[];
  /** Source IDs that support this claim */
  supportingSourceIds: string[];
  /** Confidence score for this claim */
  confidence: number;
  /** Trust score from the evidence */
  trustScore: number;
  /** Whether conflicts were detected for this claim's facts */
  hasConflicts: boolean;
  /** Verification summary for this claim */
  verificationSummary: string;
}

export interface ExplainabilityReport {
  /** Contact this report is about */
  contact: { name: string; title: string; company: string };
  /** Overall confidence assessment */
  overallConfidence: ConfidenceAssessment;
  /** Per-claim traceability */
  claimTraceability: FactTraceability[];
  /** All verified facts used */
  factsUsed: ContextFact[];
  /** All sources referenced */
  sourcesUsed: { sourceId: string; sourceName: string; url: string; authorityScore: number; tier: number }[];
  /** Conflicts detected */
  conflicts: { subject: string; predicate: string; severity: string }[];
  /** Missing evidence */
  missingEvidence: { category: string; reason: string }[];
  /** Auto-generated explanation text */
  explanation: string;
  /** Metadata */
  metadata: {
    generatedAt: string;
    trustScore: number;
    totalFactsUsed: number;
    totalSourcesUsed: number;
    conflictCount: number;
    missingCategoryCount: number;
  };
}

export class ExplainabilityLayer {
  /**
   * Generate an explainability report for a set of AI-generated claims.
   * Each claim is traced back to its supporting facts and sources.
   */
  explain(
    context: EvidenceContext,
    confidence: ConfidenceAssessment,
    claims: { claim: string; factIds: string[] }[],
  ): ExplainabilityReport {
    const claimTraceability = claims.map((c) =>
      this.traceClaim(context, c.claim, c.factIds),
    );

    const factsUsed = context.allFacts.filter((f) =>
      confidence.supportingFactIds.includes(f.factId),
    );

    const sourcesUsed = context.sources
      .filter((s) => confidence.supportingSourceIds.includes(s.sourceId))
      .map((s) => ({
        sourceId: s.sourceId,
        sourceName: s.sourceName,
        url: s.url,
        authorityScore: s.authorityScore,
        tier: s.sourceTier,
      }));

    const conflicts = context.conflicts.map((c) => ({
      subject: c.subject,
      predicate: c.predicate,
      severity: c.severity,
    }));

    const missingEvidence = context.missingInfo.map((m) => ({
      category: m.category,
      reason: m.reason,
    }));

    const explanation = this.generateExplanationText(
      context,
      confidence,
      claims.length,
      conflicts.length,
      missingEvidence.length,
    );

    return {
      contact: {
        name: context.contact.name,
        title: context.contact.title,
        company: context.contact.company,
      },
      overallConfidence: confidence,
      claimTraceability,
      factsUsed,
      sourcesUsed,
      conflicts,
      missingEvidence,
      explanation,
      metadata: {
        generatedAt: new Date().toISOString(),
        trustScore: context.trustScore,
        totalFactsUsed: factsUsed.length,
        totalSourcesUsed: sourcesUsed.length,
        conflictCount: conflicts.length,
        missingCategoryCount: missingEvidence.length,
      },
    };
  }

  /**
   * Generate an explainability report for the entire evidence context
   * (not specific claims — used when the AI output covers all evidence).
   */
  explainContext(
    context: EvidenceContext,
    confidence: ConfidenceAssessment,
  ): ExplainabilityReport {
    const allClaims = context.factGroups.map((group) => ({
      claim: `${group.category}: ${group.facts.map((f) => f.value).join('; ')}`,
      factIds: group.facts.map((f) => f.factId),
    }));

    return this.explain(context, confidence, allClaims);
  }

  /**
   * Generate an explainability report from a CitationMap (MP3 Part 6).
   *
   * This consumes the CitationMapper's output directly, providing richer
   * traceability with per-statement source references, uncited fact tracking,
   * and citation-specific confidence scores.
   */
  explainFromCitations(
    context: EvidenceContext,
    confidence: ConfidenceAssessment,
    citationMap: CitationMap,
  ): ExplainabilityReport {
    const claimTraceability = citationMap.citations.map((c) =>
      this.traceCitation(c),
    );

    const factsUsed = context.allFacts.filter((f) =>
      citationMap.allReferencedFactIds.includes(f.factId),
    );

    const sourcesUsed = context.sources
      .filter((s) => citationMap.allReferencedSourceIds.includes(s.sourceId))
      .map((s) => ({
        sourceId: s.sourceId,
        sourceName: s.sourceName,
        url: s.url,
        authorityScore: s.authorityScore,
        tier: s.sourceTier,
      }));

    const conflicts = context.conflicts.map((c) => ({
      subject: c.subject,
      predicate: c.predicate,
      severity: c.severity,
    }));

    const missingEvidence = context.missingInfo.map((m) => ({
      category: m.category,
      reason: m.reason,
    }));

    const explanation = this.generateExplanationText(
      context,
      confidence,
      citationMap.citations.length,
      conflicts.length,
      missingEvidence.length,
    );

    return {
      contact: {
        name: context.contact.name,
        title: context.contact.title,
        company: context.contact.company,
      },
      overallConfidence: confidence,
      claimTraceability,
      factsUsed,
      sourcesUsed,
      conflicts,
      missingEvidence,
      explanation,
      metadata: {
        generatedAt: new Date().toISOString(),
        trustScore: context.trustScore,
        totalFactsUsed: factsUsed.length,
        totalSourcesUsed: sourcesUsed.length,
        conflictCount: conflicts.length,
        missingCategoryCount: missingEvidence.length,
      },
    };
  }

  private traceCitation(citation: CitationEntry): FactTraceability {
    return {
      claim: citation.statement,
      supportingFactIds: citation.supportingFactIds,
      supportingSourceIds: citation.supportingSourceIds,
      confidence: citation.confidence,
      trustScore: citation.trustScore,
      hasConflicts: citation.hasConflicts,
      verificationSummary: citation.verificationSummary,
    };
  }

  private traceClaim(
    context: EvidenceContext,
    claim: string,
    factIds: string[],
  ): FactTraceability {
    const facts = context.allFacts.filter((f) => factIds.includes(f.factId));
    const sourceIds = new Set<string>();
    for (const fact of facts) {
      for (const id of fact.sourceIds) {
        sourceIds.add(id);
      }
    }

    const avgConfidence = facts.length > 0
      ? Math.round(facts.reduce((sum, f) => sum + f.confidence, 0) / facts.length)
      : 0;

    const hasConflicts = facts.some((f) => f.hasConflict);
    const verifiedCount = facts.filter(
      (f) => f.verificationStatus === 'verified' || f.verificationStatus === 'corroborated',
    ).length;

    const verificationSummary = `${verifiedCount}/${facts.length} facts verified or corroborated` +
      (hasConflicts ? ` — ⚠️ conflicts detected` : '');

    return {
      claim,
      supportingFactIds: factIds,
      supportingSourceIds: Array.from(sourceIds),
      confidence: avgConfidence,
      trustScore: context.trustScore,
      hasConflicts,
      verificationSummary,
    };
  }

  private generateExplanationText(
    context: EvidenceContext,
    confidence: ConfidenceAssessment,
    claimCount: number,
    conflictCount: number,
    missingCount: number,
  ): string {
    const parts: string[] = [];

    parts.push(`This intelligence report for ${context.contact.name} (${context.contact.title || 'N/A'} at ${context.contact.company}) is based on ${context.metadata.totalSources} sources and ${context.allFacts.length} verified facts.`);

    parts.push(`Overall confidence: ${confidence.confidence}/100 (${confidence.level}).${confidence.capped ? ' Confidence was capped due to low verification quality.' : ''}`);

    parts.push(`Trust score: ${context.trustScore}/100. Verification status: ${context.verification.status}.`);

    parts.push(`Evidence covers ${context.allFacts.length} facts across ${context.factGroups.length} categories. ${context.verification.verifiedCount} facts are verified, ${context.verification.conflictingCount} have conflicts, ${context.verification.unverifiedCount} are unverified.`);

    if (conflictCount > 0) {
      parts.push(`⚠️ ${conflictCount} conflict(s) were detected in the evidence. These are acknowledged but not resolved — both values are preserved.`);
    }

    if (missingCount > 0) {
      parts.push(`Missing evidence: ${missingCount} category/categories could not be sufficiently researched. Conclusions about these areas should be treated with caution.`);
    }

    if (context.researchRecommendations.length > 0) {
      parts.push(`Recommendations for additional research: ${context.researchRecommendations.join('; ')}`);
    }

    parts.push(`Source authority: average ${context.authority.averageAuthority}/100. ${context.authority.tier1Count} Tier-1 sources, ${context.authority.tier2Count} Tier-2 sources, ${context.authority.tier3Count} Tier-3 sources.`);

    return parts.join(' ');
  }
}
