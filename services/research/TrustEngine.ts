import type { Fact, VerificationStatus } from './Fact';
import type {
  EvidencePackage,
  EvidenceSource,
  ConfidenceBreakdown,
  VerificationResult,
  VerificationWarning,
  SourceAuthoritySummary,
  EvidenceSummary,
  MissingEvidenceSummary,
  ConflictRecord,
} from './EvidencePackage';
import type { ResearchCategory } from './ResearchPlan';
import type { AuthorityAssessment } from './SourceAuthorityEngine';
import { SourceAuthorityEngine } from './SourceAuthorityEngine';

/*
 * Trust Engine — DEL's evidence scoring system.
 *
 * Computes a Trust Score using configurable factors:
 *   - Number of supporting sources
 *   - Source authority
 *   - Source diversity (different domains)
 *   - Publication freshness
 *   - Cross-source agreement
 *   - Conflict penalties
 *   - Missing evidence penalties
 *
 * The scoring algorithm is configurable via TrustEngineConfig — not hardcoded.
 * Each factor has a weight, and the final score is a weighted combination.
 *
 * Outputs:
 *   - Overall Trust Score (0-100)
 *   - Per-fact Confidence Breakdown
 *   - Verification Summary
 *   - Verification Warnings
 *   - Missing Evidence Summary
 *
 * Every verified fact is explainable — the engine records WHY each fact
 * received its score, which sources support it, which disagree, and how
 * recent and authoritative those sources are.
 */

export interface TrustEngineConfig {
  /** Weights for each scoring factor (must sum to 1.0) */
  weights: {
    sourceCount: number;
    sourceAuthority: number;
    sourceDiversity: number;
    freshness: number;
    agreement: number;
  };
  /** Penalties (subtracted from final score, 0-100 scale) */
  penalties: {
    conflict: number;
    missingEvidence: number;
  };
  /** Freshness window in days — sources older than this are considered stale */
  freshnessWindowDays: number;
  /** Minimum sources for full corroboration score */
  minSourcesForCorroboration: number;
  /** Minimum authority score for high-trust sources */
  highTrustAuthorityThreshold: number;
}

const DEFAULT_CONFIG: TrustEngineConfig = {
  weights: {
    sourceCount: 0.25,
    sourceAuthority: 0.25,
    sourceDiversity: 0.15,
    freshness: 0.15,
    agreement: 0.20,
  },
  penalties: {
    conflict: 20,
    missingEvidence: 10,
  },
  freshnessWindowDays: 365,
  minSourcesForCorroboration: 2,
  highTrustAuthorityThreshold: 75,
};

export class TrustEngine {
  private config: TrustEngineConfig;
  private authorityEngine: SourceAuthorityEngine;

  constructor(
    authorityEngine?: SourceAuthorityEngine,
    config?: Partial<TrustEngineConfig>,
  ) {
    this.authorityEngine = authorityEngine ?? new SourceAuthorityEngine();
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
      weights: { ...DEFAULT_CONFIG.weights, ...config?.weights },
      penalties: { ...DEFAULT_CONFIG.penalties, ...config?.penalties },
    };
  }

  /**
   * Run the full trust evaluation on an EvidencePackage.
   * Updates the package with trust scores, confidence breakdowns,
   * verification results, warnings, and summaries.
   */
  evaluate(evidence: EvidencePackage): EvidencePackage {
    const facts = evidence.facts;
    const sources = evidence.sources;

    // Step 1: Assess source authority
    const authorityAssessments = this.authorityEngine.assessAll(sources);
    const updatedSources = sources.map((source) => {
      const assessment = authorityAssessments.get(source.id);
      return {
        ...source,
        authorityScore: assessment?.score,
        authorityReason: assessment?.reason,
      };
    });
    evidence.sources = updatedSources;

    // Step 2: Evaluate each fact
    const confidenceBreakdowns = new Map<string, ConfidenceBreakdown>();
    const warnings: VerificationWarning[] = [];
    const verifiedFactsList: Fact[] = [];
    const conflictingFacts: Fact[] = [];

    for (const fact of facts) {
      const breakdown = this.scoreFact(fact, updatedSources, authorityAssessments, evidence.conflicts);
      confidenceBreakdowns.set(fact.factId, breakdown);

      const updatedFact: Fact = {
        ...fact,
        confidence: breakdown.finalScore,
        metadata: {
          ...fact.metadata,
          explanation: this.generateExplanation(fact, breakdown, updatedSources, authorityAssessments),
          sourceAuthorityScores: fact.sourceIds
            .map((id) => authorityAssessments.get(id)?.score)
            .filter((s): s is number => s !== undefined),
          sourceDates: fact.sourceIds
            .map((id) => updatedSources.find((s) => s.id === id)?.publishedDate)
            .filter((d): d is string => d !== undefined) as string[],
          isFresh: this.isFresh(fact, updatedSources),
        },
      };

      // Generate warnings for low-confidence or problematic facts
      if (updatedFact.verificationStatus === 'conflicting') {
        conflictingFacts.push(updatedFact);
        warnings.push({
          factId: updatedFact.factId,
          warning: `Fact "${updatedFact.predicate}" for ${updatedFact.subject} has conflicting values from multiple sources`,
          severity: 'error',
        });
      } else if (breakdown.finalScore < 30) {
        warnings.push({
          factId: updatedFact.factId,
          warning: `Low confidence (${breakdown.finalScore}%) for "${updatedFact.predicate}" — insufficient evidence`,
          severity: 'warning',
        });
      } else if (updatedFact.verificationStatus === 'single_source') {
        warnings.push({
          factId: updatedFact.factId,
          warning: `Fact "${updatedFact.predicate}" for ${updatedFact.subject} has only one supporting source`,
          severity: 'info',
        });
      } else {
        verifiedFactsList.push(updatedFact);
      }
    }

    // Step 3: Compute verification results
    const verificationResults = this.computeVerificationResults(facts);

    // Step 4: Compute source authority summary
    const sourceAuthoritySummary = this.computeSourceAuthoritySummary(updatedSources, authorityAssessments);

    // Step 5: Compute evidence summary
    const evidenceSummary = this.computeEvidenceSummary(evidence, facts, updatedSources);

    // Step 6: Compute missing evidence summary
    const missingEvidenceSummary = this.computeMissingEvidenceSummary(evidence);

    // Step 7: Compute overall trust score
    const trustScore = this.computeOverallTrustScore(confidenceBreakdowns, facts);

    // Step 8: Update the EvidencePackage
    evidence.facts = facts.map((f) => {
      const breakdown = confidenceBreakdowns.get(f.factId);
      const updated = { ...f, confidence: breakdown?.finalScore ?? 0 };
      if (updated.verificationStatus === 'conflicting') {
        return updated;
      }
      return updated;
    });
    evidence.verifiedFactsList = verifiedFactsList;
    evidence.conflictingFacts = conflictingFacts;
    evidence.confidenceBreakdown = confidenceBreakdowns;
    evidence.verificationResults = verificationResults;
    evidence.verificationWarnings = warnings;
    evidence.sourceAuthoritySummary = sourceAuthoritySummary;
    evidence.evidenceSummary = evidenceSummary;
    evidence.missingEvidenceSummary = missingEvidenceSummary;
    evidence.trustScore = trustScore;
    evidence.confidence = trustScore; // Keep legacy confidence field in sync
    evidence.verification = {
      status: verificationResults.status,
      verifiedCount: verificationResults.verifiedCount,
      unverifiedCount: verificationResults.unverifiedCount,
      contradictoryCount: verificationResults.conflictingCount,
    };
    evidence.isVerified = true;
    evidence.metadata.agentsRun.push('TrustEngine');
    evidence.metadata.updatedAt = new Date().toISOString();

    return evidence;
  }

  /**
   * Score a single fact based on supporting sources.
   */
  private scoreFact(
    fact: Fact,
    sources: EvidenceSource[],
    authorityAssessments: Map<string, AuthorityAssessment>,
    conflicts: ConflictRecord[],
  ): ConfidenceBreakdown {
    const supportingSources = fact.sourceIds
      .map((id) => sources.find((s) => s.id === id))
      .filter((s): s is EvidenceSource => s !== undefined);

    // Source count score: 1 source = 30, 2 = 60, 3+ = 100
    const sourceCountScore = Math.min(100, supportingSources.length * 30);

    // Source authority score: average authority of supporting sources
    const authorityScores = fact.sourceIds
      .map((id) => authorityAssessments.get(id)?.score)
      .filter((s): s is number => s !== undefined);
    const sourceAuthorityScore = authorityScores.length > 0
      ? Math.round(authorityScores.reduce((sum, s) => sum + s, 0) / authorityScores.length)
      : 0;

    // Source diversity: different domains
    const sourceDiversityScore = this.authorityEngine.getSourceDiversity(fact.sourceIds, sources);

    // Freshness: how recent are the supporting sources
    const freshnessScore = this.computeFreshnessScore(fact, supportingSources);

    // Agreement: corroboration vs conflict
    const hasConflict = conflicts.some((c) => c.factId === fact.factId);
    const corroboratingCount = fact.metadata.corroboratingSourceIds?.length ?? 0;
    const agreementScore = hasConflict
      ? 0
      : Math.min(100, (corroboratingCount + 1) * 50);

    // Penalties
    const conflictPenalty = hasConflict ? this.config.penalties.conflict : 0;
    const missingEvidencePenalty = supportingSources.length === 0 ? this.config.penalties.missingEvidence : 0;

    // Weighted final score
    const w = this.config.weights;
    const rawScore =
      sourceCountScore * w.sourceCount +
      sourceAuthorityScore * w.sourceAuthority +
      sourceDiversityScore * w.sourceDiversity +
      freshnessScore * w.freshness +
      agreementScore * w.agreement;

    const finalScore = Math.max(0, Math.min(100, Math.round(rawScore - conflictPenalty - missingEvidencePenalty)));

    return {
      sourceCountScore,
      sourceAuthorityScore,
      sourceDiversityScore,
      freshnessScore,
      agreementScore,
      conflictPenalty,
      missingEvidencePenalty,
      finalScore,
    };
  }

  private computeFreshnessScore(fact: Fact, sources: EvidenceSource[]): number {
    const dates = sources
      .map((s) => s.publishedDate)
      .filter((d): d is string => d !== undefined);

    if (dates.length === 0) return 50; // Unknown freshness — neutral

    const now = Date.now();
    const windowMs = this.config.freshnessWindowDays * 24 * 60 * 60 * 1000;

    // Use the most recent date
    const mostRecent = Math.max(...dates.map((d) => new Date(d).getTime()));
    const ageMs = now - mostRecent;

    if (ageMs <= windowMs) {
      // Within freshness window — score based on how recent
      const recencyRatio = 1 - ageMs / windowMs;
      return Math.round(50 + recencyRatio * 50); // 50-100
    }

    // Stale source
    const stalenessRatio = Math.min(1, (ageMs - windowMs) / windowMs);
    return Math.round(50 - stalenessRatio * 50); // 0-50
  }

  private isFresh(fact: Fact, sources: EvidenceSource[]): boolean {
    const factSources = fact.sourceIds
      .map((id) => sources.find((s) => s.id === id))
      .filter((s): s is EvidenceSource => s !== undefined);
    const score = this.computeFreshnessScore(fact, factSources);
    return score >= 50;
  }

  private computeVerificationResults(facts: Fact[]): VerificationResult {
    const verified = facts.filter((f) => f.verificationStatus === 'verified').length;
    const corroborated = facts.filter((f) => f.verificationStatus === 'corroborated').length;
    const singleSource = facts.filter((f) => f.verificationStatus === 'single_source').length;
    const conflicting = facts.filter((f) => f.verificationStatus === 'conflicting').length;
    const rejected = facts.filter((f) => f.verificationStatus === 'rejected').length;
    const unverified = facts.filter((f) => f.verificationStatus === 'unverified').length;

    const verifiedTotal = verified + corroborated;
    const status: VerificationResult['status'] =
      conflicting > 0 && verifiedTotal === 0 ? 'failed' :
      verifiedTotal >= facts.length * 0.5 ? 'verified' :
      verifiedTotal > 0 ? 'partial' : 'pending';

    return {
      status,
      totalFacts: facts.length,
      verifiedCount: verifiedTotal,
      singleSourceCount: singleSource,
      corroboratedCount: corroborated,
      conflictingCount: conflicting,
      rejectedCount: rejected,
      unverifiedCount: unverified,
    };
  }

  private computeSourceAuthoritySummary(
    sources: EvidenceSource[],
    assessments: Map<string, AuthorityAssessment>,
  ): SourceAuthoritySummary {
    const scores = Array.from(assessments.values()).map((a) => a.score);
    const avg = scores.length > 0 ? Math.round(scores.reduce((s, a) => s + a, 0) / scores.length) : 0;

    const tier1 = sources.filter((s) => s.sourceTier === 1).length;
    const tier2 = sources.filter((s) => s.sourceTier === 2).length;
    const tier3 = sources.filter((s) => s.sourceTier === 3).length;

    let highest: { sourceId: string; score: number; name: string } | undefined;
    for (const [id, assessment] of Array.from(assessments.entries())) {
      const source = sources.find((s) => s.id === id);
      if (!highest || assessment.score > highest.score) {
        highest = { sourceId: id, score: assessment.score, name: source?.sourceName || '' };
      }
    }

    const authorityByType: Partial<Record<string, number>> = {};
    for (const source of sources) {
      const assessment = assessments.get(source.id);
      if (assessment) {
        authorityByType[source.sourceType] = assessment.score;
      }
    }

    return {
      averageAuthority: avg,
      tier1Count: tier1,
      tier2Count: tier2,
      tier3Count: tier3,
      highestAuthoritySource: highest,
      authorityByType,
    };
  }

  private computeEvidenceSummary(
    evidence: EvidencePackage,
    facts: Fact[],
    sources: EvidenceSource[],
  ): EvidenceSummary {
    const verifiedCount = facts.filter(
      (f) => f.verificationStatus === 'verified' || f.verificationStatus === 'corroborated',
    ).length;
    const assessedCount = sources.filter((s) => s.authorityScore !== undefined).length;

    // Completeness: what fraction of planned categories have evidence?
    const foundCategories = new Set(
      sources.map((s) => s.category).filter(Boolean),
    );
    const totalCategories = evidence.statistics.sourcesByCategory
      ? Object.keys(evidence.statistics.sourcesByCategory).length
      : 0;
    const completeness = totalCategories > 0
      ? Math.round((foundCategories.size / totalCategories) * 100)
      : 0;

    const summary = `Evidence package contains ${facts.length} extracted facts from ${sources.length} sources. ` +
      `${verifiedCount} facts verified or corroborated. ` +
      `Average source authority: ${evidence.sourceAuthoritySummary?.averageAuthority ?? 0}/100. ` +
      `${evidence.conflicts?.length ?? 0} conflicts detected. ` +
      `Overall trust score: ${evidence.trustScore ?? 0}/100.`;

    return {
      verifiedFactCount: verifiedCount,
      assessedSourceCount: assessedCount,
      completenessScore: completeness,
      summary,
    };
  }

  private computeMissingEvidenceSummary(evidence: EvidencePackage): MissingEvidenceSummary {
    const missingCategories: ResearchCategory[] = [];
    const insufficientCategories: ResearchCategory[] = [];

    for (const entry of evidence.missingInfo) {
      missingCategories.push(entry.category);
    }

    // Find categories with only 1 source (insufficient)
    const sourcesByCategory = evidence.statistics.sourcesByCategory;
    for (const [category, count] of Object.entries(sourcesByCategory)) {
      if (count === 1) {
        insufficientCategories.push(category as ResearchCategory);
      }
    }

    const recommendations: string[] = [];
    if (missingCategories.length > 0) {
      recommendations.push(`Search for additional sources in: ${missingCategories.join(', ')}`);
    }
    if (insufficientCategories.length > 0) {
      recommendations.push(`Find corroborating sources for: ${insufficientCategories.join(', ')}`);
    }
    if (evidence.conflicts.length > 0) {
      recommendations.push(`Resolve ${evidence.conflicts.length} conflicting facts before relying on them`);
    }

    return {
      missingCategories,
      insufficientCategories,
      totalMissing: missingCategories.length + insufficientCategories.length,
      recommendations,
    };
  }

  private computeOverallTrustScore(
    breakdowns: Map<string, ConfidenceBreakdown>,
    facts: Fact[],
  ): number {
    if (facts.length === 0) return 0;

    const scores = Array.from(breakdowns.values()).map((b) => b.finalScore);
    // Weighted average — verified facts count more
    const verifiedScores = facts
      .filter((f) => f.verificationStatus !== 'conflicting' && f.verificationStatus !== 'rejected')
      .map((f) => breakdowns.get(f.factId)?.finalScore ?? 0);

    const relevantScores = verifiedScores.length > 0 ? verifiedScores : scores;
    if (relevantScores.length === 0) return 0;

    return Math.round(relevantScores.reduce((sum, s) => sum + s, 0) / relevantScores.length);
  }

  /**
   * Generate a human-readable explanation for why a fact received its score.
   * This provides full explainability — the AI never needs to infer explanations.
   */
  private generateExplanation(
    fact: Fact,
    breakdown: ConfidenceBreakdown,
    sources: EvidenceSource[],
    assessments: Map<string, AuthorityAssessment>,
  ): string {
    const supportingSources = fact.sourceIds
      .map((id) => sources.find((s) => s.id === id))
      .filter((s): s is EvidenceSource => s !== undefined);

    const parts: string[] = [];

    parts.push(`Fact "${fact.predicate}: ${fact.value}" for ${fact.subject} has a confidence score of ${breakdown.finalScore}/100.`);

    parts.push(`Supported by ${supportingSources.length} source(s):`);
    for (const source of supportingSources) {
      const authority = assessments.get(source.id);
      parts.push(`  - ${source.sourceName} (tier ${source.sourceTier}, authority ${authority?.score ?? 'N/A'}): ${source.url}`);
    }

    if (fact.metadata.corroboratingSourceIds && fact.metadata.corroboratingSourceIds.length > 0) {
      parts.push(`Corroborated by ${fact.metadata.corroboratingSourceIds.length} additional source(s).`);
    }

    if (fact.metadata.conflictingSourceIds && fact.metadata.conflictingSourceIds.length > 0) {
      parts.push(`Conflicts with ${fact.metadata.conflictingSourceIds.length} source(s) — confidence penalized by ${breakdown.conflictPenalty} points.`);
    }

    parts.push(`Score breakdown: source count ${breakdown.sourceCountScore}, authority ${breakdown.sourceAuthorityScore}, diversity ${breakdown.sourceDiversityScore}, freshness ${breakdown.freshnessScore}, agreement ${breakdown.agreementScore}.`);

    if (breakdown.conflictPenalty > 0) {
      parts.push(`Conflict penalty: -${breakdown.conflictPenalty}`);
    }
    if (breakdown.missingEvidencePenalty > 0) {
      parts.push(`Missing evidence penalty: -${breakdown.missingEvidencePenalty}`);
    }

    return parts.join(' ');
  }

  /** Get the current configuration (for diagnostics / UI). */
  getConfig(): TrustEngineConfig {
    return this.config;
  }

  /** Get the Source Authority Engine instance. */
  getAuthorityEngine(): SourceAuthorityEngine {
    return this.authorityEngine;
  }
}
