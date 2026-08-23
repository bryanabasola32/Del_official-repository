import type { EvidenceContext, ContextFact } from '../research/EvidenceContextBuilder';
import type { ExecutiveRisk, RiskType, RiskSeverity } from './IntelligenceTypes';
import { FactHelper } from './FactHelper';

/*
 * ExecutiveRiskEngine — detects risks in the evidence and inferences.
 *
 * Never invents certainty. Identifies:
 *   - Missing evidence (categories with no facts)
 *   - Weak evidence (single-source, low-confidence facts)
 *   - Contradictions (conflicting facts)
 *   - Low confidence (inferences below threshold)
 *   - Unknown attributes (persona attributes with no supporting evidence)
 *   - Bias risks (all evidence from one source type)
 *   - Inference risks (inferences based on very few facts)
 */

export class ExecutiveRiskEngine {
  assess(context: EvidenceContext): ExecutiveRisk[] {
    const risks: ExecutiveRisk[] = [];

    risks.push(...this.detectMissingEvidence(context));
    risks.push(...this.detectWeakEvidence(context));
    risks.push(...this.detectContradictions(context));
    risks.push(...this.detectLowConfidence(context));
    risks.push(...this.detectBiasRisks(context));
    risks.push(...this.detectInferenceRisks(context));

    return risks;
  }

  // ── Missing Evidence ─────────────────────────────

  private detectMissingEvidence(context: EvidenceContext): ExecutiveRisk[] {
    const risks: ExecutiveRisk[] = [];

    for (const missing of context.missingInfo) {
      risks.push({
        type: 'missing_evidence' as RiskType,
        value: `Missing evidence for category: ${missing.category}`,
        severity: 'medium' as RiskSeverity,
        reasoning: `Category "${missing.category}" has no evidence after ${missing.queriesAttempted} query attempt(s). Reason: ${missing.reason}. Conclusions about this area should be treated as "Insufficient Data."`,
        confidence: 100,
        factIds: [],
        sourceIds: [],
        trustScore: context.trustScore,
      });
    }

    if (context.allFacts.length === 0) {
      risks.push({
        type: 'missing_evidence',
        value: 'No verified facts available in the EvidenceContext',
        severity: 'high',
        reasoning: 'The EvidenceContext contains zero facts. All persona inferences are ungrounded. The entire intelligence report should be treated as "Insufficient Data."',
        confidence: 100,
        factIds: [],
        sourceIds: [],
        trustScore: context.trustScore,
      });
    }

    return risks;
  }

  // ── Weak Evidence ────────────────────────────────

  private detectWeakEvidence(context: EvidenceContext): ExecutiveRisk[] {
    const risks: ExecutiveRisk[] = [];

    const singleSourceFacts = context.allFacts.filter(
      (f) => f.verificationStatus === 'single_source',
    );

    if (singleSourceFacts.length > 0) {
      const severity: RiskSeverity =
        singleSourceFacts.length > 5 ? 'high' :
        singleSourceFacts.length > 2 ? 'medium' : 'low';

      risks.push({
        type: 'weak_evidence',
        value: `${singleSourceFacts.length} fact(s) rely on a single source`,
        severity,
        reasoning: `${singleSourceFacts.length} fact(s) have only a single supporting source. These facts lack corroboration and may be less reliable. Key fact IDs: ${singleSourceFacts.slice(0, 5).map((f) => f.factId).join(', ')}.`,
        confidence: 90,
        factIds: singleSourceFacts.slice(0, 10).map((f) => f.factId),
        sourceIds: [],
        trustScore: context.trustScore,
      });
    }

    const lowConfidenceFacts = context.allFacts.filter(
      (f) => f.confidence < 40 && f.verificationStatus !== 'rejected',
    );

    if (lowConfidenceFacts.length > 0) {
      risks.push({
        type: 'weak_evidence',
        value: `${lowConfidenceFacts.length} fact(s) have confidence below 40%`,
        severity: 'medium',
        reasoning: `${lowConfidenceFacts.length} fact(s) have confidence scores below 40%. These facts should be treated with caution. Key fact IDs: ${lowConfidenceFacts.slice(0, 5).map((f) => f.factId).join(', ')}.`,
        confidence: 85,
        factIds: lowConfidenceFacts.slice(0, 10).map((f) => f.factId),
        sourceIds: [],
        trustScore: context.trustScore,
      });
    }

    return risks;
  }

  // ── Contradictions ───────────────────────────────

  private detectContradictions(context: EvidenceContext): ExecutiveRisk[] {
    const risks: ExecutiveRisk[] = [];

    for (const conflict of context.conflicts) {
      const severity: RiskSeverity = conflict.severity === 'major' ? 'high' : 'medium';

      const conflictingValues = conflict.conflictingValues
        .map((cv) => `"${cv.value}" (from: ${cv.sourceNames.join(', ')})`)
        .join(' vs. ');

      risks.push({
        type: 'contradiction',
        value: `Contradiction detected: ${conflict.subject} — ${conflict.predicate}`,
        severity,
        reasoning: `Evidence conflict (${conflict.severity}) for ${conflict.subject} regarding ${conflict.predicate}. Conflicting values: ${conflictingValues}. Both values are preserved — no side was arbitrarily chosen.`,
        confidence: 100,
        factIds: [],
        sourceIds: [],
        trustScore: context.trustScore,
      });
    }

    return risks;
  }

  // ── Low Confidence ────────────────────────────────

  private detectLowConfidence(context: EvidenceContext): ExecutiveRisk[] {
    const risks: ExecutiveRisk[] = [];

    if (context.trustScore < 40) {
      risks.push({
        type: 'low_confidence',
        value: `Overall trust score is low (${context.trustScore}/100)`,
        severity: 'high',
        reasoning: `The EvidenceContext trust score is ${context.trustScore}/100, below the 40% threshold. All inferences derived from this evidence should be treated with significant caution.`,
        confidence: 100,
        factIds: [],
        sourceIds: [],
        trustScore: context.trustScore,
      });
    }

    if (context.completeness < 40) {
      risks.push({
        type: 'low_confidence',
        value: `Evidence completeness is low (${context.completeness}%)`,
        severity: 'medium',
        reasoning: `Evidence completeness is ${context.completeness}%, below the 40% threshold. Significant information gaps exist. Many persona attributes may be "Unknown."`,
        confidence: 95,
        factIds: [],
        sourceIds: [],
        trustScore: context.trustScore,
      });
    }

    return risks;
  }

  // ── Bias Risks ───────────────────────────────────

  private detectBiasRisks(context: EvidenceContext): ExecutiveRisk[] {
    const risks: ExecutiveRisk[] = [];

    const sourceTypes = new Set<string>();
    for (const source of context.sources) {
      sourceTypes.add(source.sourceType);
    }

    if (sourceTypes.size === 1 && context.sources.length > 0) {
      const onlyType = Array.from(sourceTypes)[0];
      risks.push({
        type: 'bias_risk',
        value: `All evidence from a single source type: ${onlyType}`,
        severity: 'medium',
        reasoning: `All ${context.sources.length} source(s) are of type "${onlyType}". This introduces potential source bias. Corroboration from diverse source types would increase reliability.`,
        confidence: 90,
        factIds: [],
        sourceIds: context.sources.map((s) => s.sourceId),
        trustScore: context.trustScore,
      });
    }

    const domains = new Set<string>();
    for (const source of context.sources) {
      try {
        const url = new URL(source.url);
        domains.add(url.hostname);
      } catch {
        // ignore invalid URLs
      }
    }

    if (domains.size === 1 && context.sources.length > 2) {
      risks.push({
        type: 'bias_risk',
        value: 'All evidence from a single domain',
        severity: 'low',
        reasoning: `All ${context.sources.length} sources originate from a single domain. This limits perspective diversity and may introduce publication bias.`,
        confidence: 80,
        factIds: [],
        sourceIds: [],
        trustScore: context.trustScore,
      });
    }

    return risks;
  }

  // ── Inference Risks ───────────────────────────────

  private detectInferenceRisks(context: EvidenceContext): ExecutiveRisk[] {
    const risks: ExecutiveRisk[] = [];

    const totalFacts = context.allFacts.length;
    const verifiedCount = context.verification.verifiedCount;

    if (totalFacts > 0 && verifiedCount / totalFacts < 0.3) {
      risks.push({
        type: 'inference_risk',
        value: `Low verification rate: ${verifiedCount}/${totalFacts} facts verified`,
        severity: 'high',
        reasoning: `Only ${((verifiedCount / totalFacts) * 100).toFixed(0)}% of facts are verified. Inferences based on unverified facts carry higher hallucination risk.`,
        confidence: 95,
        factIds: [],
        sourceIds: [],
        trustScore: context.trustScore,
      });
    }

    if (totalFacts > 0 && totalFacts < 5) {
      risks.push({
        type: 'inference_risk',
        value: `Very few facts available (${totalFacts})`,
        severity: 'medium',
        reasoning: `Only ${totalFacts} fact(s) are available. Persona inferences based on fewer than 5 facts are inherently unreliable and should be treated as preliminary.`,
        confidence: 85,
        factIds: [],
        sourceIds: [],
        trustScore: context.trustScore,
      });
    }

    return risks;
  }
}
