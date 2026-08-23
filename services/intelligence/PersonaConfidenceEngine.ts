import type { EvidenceContext } from '../research/EvidenceContextBuilder';
import type { PersonaConfidenceSummary } from './IntelligenceTypes';
import type { ExecutivePersona } from './IntelligenceTypes';
import { FactHelper } from './FactHelper';

/*
 * PersonaConfidenceEngine — computes confidence for every inferred characteristic.
 *
 * Confidence is computed from:
 *   - Evidence confidence (average fact confidence)
 *   - Verification confidence (ratio of verified/corroborated facts)
 *   - Source diversity (unique source count)
 *   - Trust score (from the Trust Engine)
 *   - Evidence completeness (from the EvidenceContext)
 *
 * The engine produces per-attribute confidence scores and an overall
 * persona confidence summary with a full breakdown.
 */

const HIGH_THRESHOLD = 75;
const MEDIUM_THRESHOLD = 50;

export class PersonaConfidenceEngine {
  compute(
    context: EvidenceContext,
    persona: ExecutivePersona,
  ): PersonaConfidenceSummary {
    const evidenceConfidence = this.computeEvidenceConfidence(context);
    const verificationConfidence = this.computeVerificationConfidence(context);
    const sourceDiversity = this.computeSourceDiversity(context);
    const trustScore = context.trustScore;
    const evidenceCompleteness = context.completeness;

    const overall = Math.round(
      evidenceConfidence * 0.25 +
      verificationConfidence * 0.25 +
      sourceDiversity * 0.15 +
      trustScore * 0.20 +
      evidenceCompleteness * 0.15,
    );

    const leadershipStyle = persona.leadershipStyle.confidence;
    const decisionStyle = persona.decisionStyle.confidence;
    const innovation = persona.innovationOrientation.confidence;
    const communication = persona.communicationStyle.confidence;
    const strategicVision = this.averageInferenceConfidence(persona.strategicPriorities);
    const networking = persona.networkingStyle.confidence;

    const level: 'high' | 'medium' | 'low' =
      overall >= HIGH_THRESHOLD ? 'high' :
      overall >= MEDIUM_THRESHOLD ? 'medium' : 'low';

    const reasoning = this.buildReasoning(
      overall,
      level,
      evidenceConfidence,
      verificationConfidence,
      sourceDiversity,
      trustScore,
      evidenceCompleteness,
    );

    return {
      leadershipStyle,
      decisionStyle,
      innovation,
      communication,
      strategicVision,
      networking,
      overall,
      breakdown: {
        evidenceConfidence,
        verificationConfidence,
        sourceDiversity,
        trustScore,
        evidenceCompleteness,
      },
      level,
      reasoning,
    };
  }

  // ── Computation helpers ───────────────────────────

  private computeEvidenceConfidence(context: EvidenceContext): number {
    if (context.allFacts.length === 0) return 0;
    return Math.round(
      context.allFacts.reduce((sum, f) => sum + f.confidence, 0) /
        context.allFacts.length,
    );
  }

  private computeVerificationConfidence(context: EvidenceContext): number {
    const total = context.verification.totalFacts;
    if (total === 0) return 0;
    const verified = context.verification.verifiedCount;
    return Math.round((verified / total) * 100);
  }

  private computeSourceDiversity(context: EvidenceContext): number {
    const uniqueSourceIds = new Set<string>();
    for (const fact of context.allFacts) {
      for (const sid of fact.sourceIds) {
        uniqueSourceIds.add(sid);
      }
    }
    return Math.min(100, uniqueSourceIds.size * 20);
  }

  private averageInferenceConfidence(
    inferences: { confidence: number }[],
  ): number {
    if (inferences.length === 0) return 0;
    return Math.round(
      inferences.reduce((sum, inf) => sum + inf.confidence, 0) /
        inferences.length,
    );
  }

  private buildReasoning(
    overall: number,
    level: string,
    evidenceConfidence: number,
    verificationConfidence: number,
    sourceDiversity: number,
    trustScore: number,
    evidenceCompleteness: number,
  ): string {
    const parts: string[] = [];

    parts.push(`Overall persona confidence: ${overall}/100 (${level}).`);

    parts.push(
      `Computed from: evidence confidence ${evidenceConfidence}/100 (weight 25%), verification confidence ${verificationConfidence}/100 (weight 25%), source diversity ${sourceDiversity}/100 (weight 15%), trust score ${trustScore}/100 (weight 20%), evidence completeness ${evidenceCompleteness}/100 (weight 15%).`,
    );

    if (level === 'low') {
      parts.push('Confidence is low — persona inferences should be treated as preliminary and supplemented with additional research.');
    } else if (level === 'medium') {
      parts.push('Confidence is moderate — persona inferences are reasonably grounded but may benefit from additional evidence.');
    } else {
      parts.push('Confidence is high — persona inferences are well-grounded in verified evidence.');
    }

    return parts.join(' ');
  }
}
