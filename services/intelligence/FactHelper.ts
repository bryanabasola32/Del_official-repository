import type { EvidenceContext, ContextFact } from '../research/EvidenceContextBuilder';

/*
 * FactHelper — shared utilities for querying EvidenceContext facts.
 *
 * All MP4 engines use these helpers to find facts by category, predicate,
 * or keyword. This ensures consistent evidence lookup across all modules
 * and avoids duplicating search logic.
 */

export class FactHelper {
  /** Find facts by exact category match. */
  static byCategory(context: EvidenceContext, category: string): ContextFact[] {
    return context.allFacts.filter((f) => f.category === category);
  }

  /** Find facts where the category contains the substring. */
  static byCategoryContains(context: EvidenceContext, substring: string): ContextFact[] {
    const lower = substring.toLowerCase();
    return context.allFacts.filter((f) => f.category.toLowerCase().includes(lower));
  }

  /** Find facts where the predicate matches. */
  static byPredicate(context: EvidenceContext, predicate: string): ContextFact[] {
    const lower = predicate.toLowerCase();
    return context.allFacts.filter((f) => f.predicate.toLowerCase().includes(lower));
  }

  /** Find facts where the value contains any of the keywords. */
  static byValueKeywords(context: EvidenceContext, keywords: string[]): ContextFact[] {
    const lowerKeywords = keywords.map((k) => k.toLowerCase());
    return context.allFacts.filter((f) => {
      const valueLower = f.value.toLowerCase();
      return lowerKeywords.some((k) => valueLower.includes(k));
    });
  }

  /** Find facts where the predicate or value contains any of the keywords. */
  static byKeywords(context: EvidenceContext, keywords: string[]): ContextFact[] {
    const lowerKeywords = keywords.map((k) => k.toLowerCase());
    return context.allFacts.filter((f) => {
      const predicateLower = f.predicate.toLowerCase();
      const valueLower = f.value.toLowerCase();
      return lowerKeywords.some(
        (k) => predicateLower.includes(k) || valueLower.includes(k),
      );
    });
  }

  /** Get the average confidence of a set of facts. */
  static averageConfidence(facts: ContextFact[]): number {
    if (facts.length === 0) return 0;
    return Math.round(
      facts.reduce((sum, f) => sum + f.confidence, 0) / facts.length,
    );
  }

  /** Collect all unique source IDs from a set of facts. */
  static collectSourceIds(facts: ContextFact[]): string[] {
    const ids = new Set<string>();
    for (const f of facts) {
      for (const sid of f.sourceIds) {
        ids.add(sid);
      }
    }
    return Array.from(ids);
  }

  /** Collect all fact IDs from a set of facts. */
  static collectFactIds(facts: ContextFact[]): string[] {
    return facts.map((f) => f.factId);
  }

  /** Get verified/corroborated facts only. */
  static verifiedOnly(facts: ContextFact[]): ContextFact[] {
    return facts.filter(
      (f) =>
        f.verificationStatus === 'verified' ||
        f.verificationStatus === 'corroborated',
    );
  }

  /** Count verified/corroborated facts. */
  static verifiedCount(facts: ContextFact[]): number {
    return FactHelper.verifiedOnly(facts).length;
  }

  /** Check if a fact has conflict. */
  static hasConflicts(facts: ContextFact[]): boolean {
    return facts.some((f) => f.hasConflict);
  }

  /** Get the trust score from context, defaulting to 0. */
  static trustScore(context: EvidenceContext): number {
    return context.trustScore;
  }

  /** Build a reasoning string from a set of facts. */
  static buildReasoning(
    facts: ContextFact[],
    prefix: string,
  suffix: string = '',
  ): string {
    if (facts.length === 0) {
      return `${prefix} No direct evidence found. Inference based on limited context.${suffix}`;
    }

    const verifiedCount = FactHelper.verifiedCount(facts);
    const total = facts.length;
    const avgConf = FactHelper.averageConfidence(facts);

    const factDescriptions = facts
      .slice(0, 3)
      .map((f) => `${f.predicate}: "${f.value}" (${f.confidence}% confidence)`)
      .join('; ');

    return `${prefix} Based on ${total} fact(s) (${verifiedCount} verified, avg ${avgConf}% confidence). Key evidence: ${factDescriptions}.${suffix}`;
  }

  /** Create a minimal inference for unknown attributes. */
  static unknownInference(
    attribute: string,
    context: EvidenceContext,
  reasoning: string,
  ): {
    value: string;
    confidence: number;
    reasoning: string;
    factIds: string[];
    sourceIds: string[];
    trustScore: number;
  } {
    return {
      value: 'Unknown',
      confidence: 0,
      reasoning: reasoning || `Insufficient evidence to infer ${attribute}.`,
      factIds: [],
      sourceIds: [],
      trustScore: context.trustScore,
    };
  }
}
