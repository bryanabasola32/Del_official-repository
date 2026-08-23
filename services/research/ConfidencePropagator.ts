import type { EvidenceContext, ContextFact } from './EvidenceContextBuilder';
import type { Fact } from './Fact';

/*
 * ConfidencePropagator — propagates evidence confidence to AI-generated artifacts.
 *
 * Every AI-generated artifact (persona, recommendation, invitation, summary)
 * inherits confidence from its supporting evidence.
 *
 * Confidence is calculated from:
 *   - Fact confidence (average of supporting facts)
 *   - Trust score (from the Trust Engine)
 *   - Source diversity (unique domains)
 *   - Verification quality (ratio of verified/corroborated facts)
 *
 * The propagator also tracks which fact IDs and source IDs support each
 * generated artifact, enabling full traceability.
 */

export interface ConfidenceAssessment {
  /** Computed confidence score (0-100) */
  confidence: number;
  /** Confidence level bucket */
  level: 'high' | 'medium' | 'low';
  /** Whether confidence was capped due to insufficient evidence */
  capped: boolean;
  /** Fact IDs that contributed to this confidence */
  supportingFactIds: string[];
  /** Source IDs that contributed to this confidence */
  supportingSourceIds: string[];
  /** Trust score at time of assessment */
  trustScore: number;
  /** Verification quality ratio (0-1) */
  verificationQuality: number;
  /** Source diversity score (0-100) */
  sourceDiversity: number;
  /** Explanation of the confidence calculation */
  explanation: string;
}

export interface ConfidencePropagatorConfig {
  /** Weight for fact confidence (0-1) */
  factConfidenceWeight: number;
  /** Weight for trust score (0-1) */
  trustScoreWeight: number;
  /** Weight for verification quality (0-1) */
  verificationQualityWeight: number;
  /** Weight for source diversity (0-1) */
  sourceDiversityWeight: number;
  /** Minimum confidence to be considered "high" */
  highConfidenceThreshold: number;
  /** Minimum confidence to be considered "medium" */
  mediumConfidenceThreshold: number;
  /** Cap confidence when verification quality is below this ratio */
  lowVerificationCap: number;
  /** Threshold below which verification quality triggers capping */
  lowVerificationThreshold: number;
}

const DEFAULT_CONFIG: ConfidencePropagatorConfig = {
  factConfidenceWeight: 0.35,
  trustScoreWeight: 0.25,
  verificationQualityWeight: 0.25,
  sourceDiversityWeight: 0.15,
  highConfidenceThreshold: 75,
  mediumConfidenceThreshold: 50,
  lowVerificationCap: 60,
  lowVerificationThreshold: 0.4,
};

export class ConfidencePropagator {
  private config: ConfidencePropagatorConfig;

  constructor(config?: Partial<ConfidencePropagatorConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Assess confidence for a set of supporting facts within an evidence context.
   * Used after AI generation to attach confidence to the generated artifact.
   */
  assess(
    context: EvidenceContext,
    supportingFactIds: string[],
  ): ConfidenceAssessment {
    const supportingFacts = context.allFacts.filter((f) =>
      supportingFactIds.includes(f.factId),
    );

    // Factor 1: Average fact confidence
    const factConfidence = supportingFacts.length > 0
      ? Math.round(supportingFacts.reduce((sum, f) => sum + f.confidence, 0) / supportingFacts.length)
      : 0;

    // Factor 2: Trust score (from context)
    const trustScore = context.trustScore;

    // Factor 3: Verification quality (ratio of verified/corroborated to total)
    const verifiedCount = supportingFacts.filter(
      (f) => f.verificationStatus === 'verified' || f.verificationStatus === 'corroborated',
    ).length;
    const verificationQuality = supportingFacts.length > 0
      ? verifiedCount / supportingFacts.length
      : 0;

    // Factor 4: Source diversity (unique source IDs)
    const allSourceIds = new Set<string>();
    for (const fact of supportingFacts) {
      for (const sourceId of fact.sourceIds) {
        allSourceIds.add(sourceId);
      }
    }
    const sourceDiversity = Math.min(100, allSourceIds.size * 25);

    // Weighted score
    const w = this.config;
    let confidence = Math.round(
      factConfidence * w.factConfidenceWeight +
      trustScore * w.trustScoreWeight +
      (verificationQuality * 100) * w.verificationQualityWeight +
      sourceDiversity * w.sourceDiversityWeight,
    );

    // Cap if verification quality is low
    let capped = false;
    if (verificationQuality < w.lowVerificationThreshold && confidence > w.lowVerificationCap) {
      confidence = w.lowVerificationCap;
      capped = true;
    }

    // Determine level
    const level: ConfidenceAssessment['level'] =
      confidence >= w.highConfidenceThreshold ? 'high' :
      confidence >= w.mediumConfidenceThreshold ? 'medium' : 'low';

    const explanation = this.buildExplanation(
      confidence,
      level,
      capped,
      factConfidence,
      trustScore,
      verificationQuality,
      sourceDiversity,
      supportingFacts.length,
    );

    return {
      confidence,
      level,
      capped,
      supportingFactIds,
      supportingSourceIds: Array.from(allSourceIds),
      trustScore,
      verificationQuality,
      sourceDiversity,
      explanation,
    };
  }

  /**
   * Assess confidence for an entire evidence context (not specific facts).
   * Used when the artifact is based on all available evidence.
   */
  assessContext(context: EvidenceContext): ConfidenceAssessment {
    const allFactIds = context.allFacts.map((f) => f.factId);
    return this.assess(context, allFactIds);
  }

  private buildExplanation(
    confidence: number,
    level: string,
    capped: boolean,
    factConfidence: number,
    trustScore: number,
    verificationQuality: number,
    sourceDiversity: number,
    factCount: number,
  ): string {
    const parts: string[] = [];
    parts.push(`Confidence: ${confidence}/100 (${level}).`);
    parts.push(`Based on ${factCount} supporting fact(s).`);
    parts.push(`Fact confidence avg: ${factConfidence}, Trust score: ${trustScore}, Verification quality: ${(verificationQuality * 100).toFixed(0)}%, Source diversity: ${sourceDiversity}.`);
    if (capped) {
      parts.push(`Confidence was capped due to low verification quality (${(verificationQuality * 100).toFixed(0)}% of facts verified).`);
    }
    return parts.join(' ');
  }

  getConfig(): ConfidencePropagatorConfig {
    return this.config;
  }
}
