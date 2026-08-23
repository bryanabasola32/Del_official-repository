import type { EvidencePackage } from '../research/EvidencePackage';
import type { FallbackDecision, FallbackPolicyConfig } from './CuratedEvidenceTypes';
import { DEFAULT_FALLBACK_POLICY_CONFIG } from './CuratedEvidenceTypes';

/*
 * CuratedEvidenceFallbackPolicy — evaluates whether live evidence is
 * sufficient or if Plan B enrichment should be used.
 *
 * Uses existing TrustEngine outputs (trustScore, evidenceSummary.completenessScore,
 * verificationResults.verifiedCount). Does NOT create a competing trust algorithm.
 *
 * Returns a FallbackDecision with shouldEnrich + reasons.
 */

export class CuratedEvidenceFallbackPolicy {
  private config: FallbackPolicyConfig;

  constructor(config?: Partial<FallbackPolicyConfig>) {
    this.config = { ...DEFAULT_FALLBACK_POLICY_CONFIG, ...config };
  }

  /** Evaluate whether the live evidence package needs Plan B enrichment. */
  evaluate(evidence: EvidencePackage): FallbackDecision {
    const reasons: string[] = [];

    const trustScore = evidence.trustScore ?? 0;
    const completeness = evidence.evidenceSummary?.completenessScore ?? 0;
    const verifiedFacts = evidence.verificationResults?.verifiedCount ?? 0;

    if (!this.config.enabled) {
      return {
        shouldEnrich: false,
        reasons: ['Plan B is disabled'],
        liveTrustScore: trustScore,
        liveCompleteness: completeness,
        liveVerifiedFacts: verifiedFacts,
        thresholds: {
          minimumTrustScore: this.config.minimumTrustScore,
          minimumCompleteness: this.config.minimumCompleteness,
          minimumVerifiedFacts: this.config.minimumVerifiedFacts,
        },
      };
    }

    if (trustScore < this.config.minimumTrustScore) {
      reasons.push(`Trust score ${trustScore} below threshold ${this.config.minimumTrustScore}`);
    }
    if (completeness < this.config.minimumCompleteness) {
      reasons.push(`Evidence completeness ${completeness}% below threshold ${this.config.minimumCompleteness}%`);
    }
    if (verifiedFacts < this.config.minimumVerifiedFacts) {
      reasons.push(`Verified facts ${verifiedFacts} below threshold ${this.config.minimumVerifiedFacts}`);
    }

    return {
      shouldEnrich: reasons.length > 0,
      reasons,
      liveTrustScore: trustScore,
      liveCompleteness: completeness,
      liveVerifiedFacts: verifiedFacts,
      thresholds: {
        minimumTrustScore: this.config.minimumTrustScore,
        minimumCompleteness: this.config.minimumCompleteness,
        minimumVerifiedFacts: this.config.minimumVerifiedFacts,
      },
    };
  }

  /** Explain the decision in human-readable form. */
  explainDecision(decision: FallbackDecision): string {
    if (decision.shouldEnrich) {
      return `Plan B enrichment needed: ${decision.reasons.join('; ')}`;
    }
    return 'Live evidence is sufficient — Plan B not needed.';
  }

  /** Get the current config (for UI / diagnostics). */
  getConfig(): FallbackPolicyConfig {
    return { ...this.config };
  }

  /** Update config at runtime. */
  updateConfig(config: Partial<FallbackPolicyConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

// ── Singleton ────────────────────────────────────────

let _policy: CuratedEvidenceFallbackPolicy | null = null;

export function getFallbackPolicy(): CuratedEvidenceFallbackPolicy {
  if (!_policy) {
    _policy = new CuratedEvidenceFallbackPolicy();
  }
  return _policy;
}
