import type { RawFinding, VerifiedFinding } from '../providers/types';
import type { Fact, VerificationStatus } from '../research/Fact';
import type { EvidenceSource } from '../research/EvidencePackage';

/*
 * Verifier Agent — verifies extracted facts.
 *
 * Upgraded from MP2 (which only reviewed AI outputs) to now verify
 * facts extracted by the Fact Extractor.
 *
 * Responsibilities:
 *   - Cross-check identical facts across multiple sources
 *   - Detect agreement (corroboration)
 *   - Detect missing corroboration (single-source facts)
 *   - Compare publication dates
 *   - Compare document freshness
 *   - Compare source authority
 *   - Preserve supporting evidence
 *
 * The Verifier Agent NEVER generates new facts.
 * It only validates existing ones extracted by the Fact Extractor.
 *
 * Backward compatibility: the legacy `verify(findings: RawFinding[])` method
 * is preserved for the existing orchestrator pipeline.
 */

export interface VerificationContext {
  sources: EvidenceSource[];
  /** Authority scores by sourceId (from SourceAuthorityEngine) */
  authorityScores?: Map<string, number>;
}

export class VerifierAgent {
  /**
   * Verify extracted facts against multiple sources.
   * Updates each fact's verificationStatus based on corroboration.
   */
  verifyFacts(facts: Fact[], context: VerificationContext): Fact[] {
    const sources = context.sources;

    // Group facts by subject + predicate to check for corroboration
    const groups = new Map<string, Fact[]>();
    for (const fact of facts) {
      const key = `${fact.subject}::${fact.predicate}`;
      const existing = groups.get(key) || [];
      existing.push(fact);
      groups.set(key, existing);
    }

    const verifiedFacts: Fact[] = [];

    for (const [, groupFacts] of Array.from(groups.entries())) {
      // Collect all unique source IDs supporting this subject+predicate
      const allSourceIds = new Set<string>();
      for (const fact of groupFacts) {
        for (const sourceId of fact.sourceIds) {
          allSourceIds.add(sourceId);
        }
      }

      // Check corroboration across different sources
      const uniqueSources = Array.from(allSourceIds);

      for (const fact of groupFacts) {
        const supportingSources = fact.sourceIds
          .map((id) => sources.find((s) => s.id === id))
          .filter((s): s is EvidenceSource => s !== undefined);

        // Count corroborating sources (different sources supporting the same fact)
        const corroboratingSourceIds = uniqueSources.filter(
          (id) => !fact.sourceIds.includes(id),
        );

        // Determine verification status
        let verificationStatus: VerificationStatus;
        const sourceCount = fact.sourceIds.length;
        const corroboratingCount = corroboratingSourceIds.length;

        if (fact.verificationStatus === 'conflicting') {
          // Keep conflict status — set by ConflictDetector
          verificationStatus = 'conflicting';
        } else if (sourceCount >= 2 && corroboratingCount >= 1) {
          verificationStatus = 'verified';
        } else if (sourceCount >= 1 && corroboratingCount >= 1) {
          verificationStatus = 'corroborated';
        } else if (sourceCount >= 1) {
          verificationStatus = 'single_source';
        } else {
          verificationStatus = 'unverified';
        }

        // Compare freshness
        const dates = supportingSources
          .map((s) => s.publishedDate)
          .filter((d): d is string => d !== undefined);
        const isFresh = dates.length > 0
          ? this.isFreshFact(dates)
          : false;

        // Compare authority
        const authorityScores = fact.sourceIds
          .map((id) => context.authorityScores?.get(id))
          .filter((s): s is number => s !== undefined);
        const avgAuthority = authorityScores.length > 0
          ? Math.round(authorityScores.reduce((sum, s) => sum + s, 0) / authorityScores.length)
          : 0;

        verifiedFacts.push({
          ...fact,
          verificationStatus,
          metadata: {
            ...fact.metadata,
            corroboratingSourceIds,
            sourceDates: dates,
            sourceAuthorityScores: authorityScores,
            isFresh,
          },
        });
      }
    }

    return verifiedFacts;
  }

  /**
   * Legacy verification method — preserved for backward compatibility.
   * Used by the existing orchestrator pipeline (Researcher → Verifier → Synthesizer).
   */
  async verify(findings: RawFinding[]): Promise<VerifiedFinding[]> {
    return findings.map((f) => {
      const sameTrack = findings.filter((g) => g.track === f.track && g !== f);
      const corroboratedBy = sameTrack.map((g) => g.sourceName);

      let confidenceLevel: VerifiedFinding['confidenceLevel'] = 'unverified';
      if (f.sourceTier === 1 && corroboratedBy.length >= 1) confidenceLevel = 'verified';
      else if (f.sourceTier === 1 && corroboratedBy.length === 0) confidenceLevel = 'probable';
      else if (f.sourceTier === 2 && corroboratedBy.length >= 1) confidenceLevel = 'verified';
      else if (f.sourceTier === 2) confidenceLevel = 'probable';
      else if (corroboratedBy.length >= 2) confidenceLevel = 'probable';

      return { ...f, confidenceLevel, corroboratedBy };
    });
  }

  private isFreshFact(dates: string[]): boolean {
    const now = Date.now();
    const oneYearMs = 365 * 24 * 60 * 60 * 1000;
    const mostRecent = Math.max(...dates.map((d) => new Date(d).getTime()));
    return now - mostRecent <= oneYearMs;
  }
}
