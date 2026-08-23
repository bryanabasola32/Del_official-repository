import type { EvidenceContext, ContextFact, ContextSourceRef } from './EvidenceContextBuilder';
import type { ConfidenceAssessment } from './ConfidencePropagator';

/*
 * CitationMapper — maps generated AI statements to verified evidence.
 *
 * Every generated statement references:
 *   - Supporting Fact IDs
 *   - Supporting Source IDs
 *   - Trust Scores
 *   - Confidence
 *
 * The mapper maintains mappings between generated conclusions and verified
 * evidence. This output is consumed by the ExplainabilityLayer and is
 * reusable by future UI components for displaying evidence traceability.
 */

export interface CitationEntry {
  /** Unique ID for this citation entry */
  citationId: string;
  /** The generated statement or conclusion */
  statement: string;
  /** The category/section this statement belongs to (e.g. "pain_point", "initiative") */
  category: string;
  /** Fact IDs that support this statement */
  supportingFactIds: string[];
  /** Source IDs that support this statement */
  supportingSourceIds: string[];
  /** Source names for display */
  supportingSourceNames: string[];
  /** Trust score from the evidence context */
  trustScore: number;
  /** Confidence score for this specific statement */
  confidence: number;
  /** Whether any supporting facts have conflicts */
  hasConflicts: boolean;
  /** Verification status summary */
  verificationSummary: string;
}

export interface CitationMap {
  /** Contact this citation map is about */
  contact: { id: string; name: string; title: string; company: string };
  /** All citation entries */
  citations: CitationEntry[];
  /** Overall confidence assessment */
  overallConfidence: ConfidenceAssessment;
  /** All fact IDs referenced across all citations */
  allReferencedFactIds: string[];
  /** All source IDs referenced across all citations */
  allReferencedSourceIds: string[];
  /** Facts that were NOT cited by any statement */
  uncitedFactIds: string[];
  /** Metadata */
  metadata: {
    totalCitations: number;
    totalFactsReferenced: number;
    totalSourcesReferenced: number;
    totalUncitedFacts: number;
    generatedAt: string;
  };
}

export interface CitationInput {
  /** The generated statement */
  statement: string;
  /** Category of the statement */
  category: string;
  /** Fact IDs that support this statement (from the evidence context) */
  factIds: string[];
}

export class CitationMapper {
  private counter = 0;

  /**
   * Build a citation map from generated statements and their supporting fact IDs.
   *
   * @param context The EvidenceContext that the statements were generated from
   * @param confidence The overall confidence assessment
   * @param inputs The generated statements with their supporting fact IDs
   */
  map(
    context: EvidenceContext,
    confidence: ConfidenceAssessment,
    inputs: CitationInput[],
  ): CitationMap {
    const citations: CitationEntry[] = [];
    const allReferencedFactIds = new Set<string>();
    const allReferencedSourceIds = new Set<string>();

    for (const input of inputs) {
      const entry = this.buildCitationEntry(context, confidence, input);
      citations.push(entry);

      for (const fid of entry.supportingFactIds) {
        allReferencedFactIds.add(fid);
      }
      for (const sid of entry.supportingSourceIds) {
        allReferencedSourceIds.add(sid);
      }
    }

    // Find facts that were not cited by any statement
    const allFactIds = new Set(context.allFacts.map((f) => f.factId));
    const uncitedFactIds = Array.from(allFactIds).filter(
      (id) => !allReferencedFactIds.has(id),
    );

    return {
      contact: {
        id: context.contact.id,
        name: context.contact.name,
        title: context.contact.title,
        company: context.contact.company,
      },
      citations,
      overallConfidence: confidence,
      allReferencedFactIds: Array.from(allReferencedFactIds),
      allReferencedSourceIds: Array.from(allReferencedSourceIds),
      uncitedFactIds,
      metadata: {
        totalCitations: citations.length,
        totalFactsReferenced: allReferencedFactIds.size,
        totalSourcesReferenced: allReferencedSourceIds.size,
        totalUncitedFacts: uncitedFactIds.length,
        generatedAt: new Date().toISOString(),
      },
    };
  }

  /**
   * Build a citation map from an entire evidence context.
   * Each fact group becomes a citation entry.
   * Used when the AI output covers all evidence (no specific claim-to-fact mapping).
   */
  mapFromContext(
    context: EvidenceContext,
    confidence: ConfidenceAssessment,
  ): CitationMap {
    const inputs: CitationInput[] = context.factGroups.map((group) => ({
      statement: `${group.category}: ${group.facts.map((f) => f.value).join('; ')}`,
      category: group.category,
      factIds: group.facts.map((f) => f.factId),
    }));

    return this.map(context, confidence, inputs);
  }

  private buildCitationEntry(
    context: EvidenceContext,
    confidence: ConfidenceAssessment,
    input: CitationInput,
  ): CitationEntry {
    const facts = context.allFacts.filter((f) => input.factIds.includes(f.factId));
    const sourceIds = new Set<string>();
    const sourceNames = new Set<string>();

    for (const fact of facts) {
      for (const sourceId of fact.sourceIds) {
        sourceIds.add(sourceId);
      }
      for (const sourceName of fact.sourceNames) {
        sourceNames.add(sourceName);
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
      (hasConflicts ? ' — conflicts detected' : '');

    this.counter += 1;

    return {
      citationId: `cit_${this.counter}`,
      statement: input.statement,
      category: input.category,
      supportingFactIds: input.factIds,
      supportingSourceIds: Array.from(sourceIds),
      supportingSourceNames: Array.from(sourceNames),
      trustScore: context.trustScore,
      confidence: avgConfidence,
      hasConflicts,
      verificationSummary,
    };
  }

  /**
   * Convert a CitationMap to a format that the ExplainabilityLayer can consume.
   */
  toExplainabilityClaims(citationMap: CitationMap): { claim: string; factIds: string[] }[] {
    return citationMap.citations.map((c) => ({
      claim: c.statement,
      factIds: c.supportingFactIds,
    }));
  }
}
