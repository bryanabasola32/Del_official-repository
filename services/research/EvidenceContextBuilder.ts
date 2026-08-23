import type { EvidencePackage, EvidenceSource, ConflictRecord } from './EvidencePackage';
import type { Fact, FactCategory, VerificationStatus } from './Fact';
import type { ResearchCategory } from './ResearchPlan';

/*
 * EvidenceContextBuilder — converts the Verified Evidence Package into
 * structured AI context.
 *
 * This is the ONLY object that should be passed to AI prompt generation.
 * No AI model should ever receive raw findings, search results, or webpages
 * directly — only this structured EvidenceContext.
 *
 * The builder:
 *   - Organizes verified facts by category
 *   - Includes confidence values and trust scores
 *   - Includes supporting evidence (source references)
 *   - Includes conflicting evidence (with all conflicting values)
 *   - Includes missing information
 *   - Preserves explainability metadata
 */

export interface ContextFactGroup {
  category: FactCategory;
  facts: ContextFact[];
}

export interface ContextFact {
  factId: string;
  category: FactCategory;
  subject: string;
  predicate: string;
  value: string;
  confidence: number;
  verificationStatus: VerificationStatus;
  sourceIds: string[];
  sourceNames: string[];
  hasConflict: boolean;
  conflictingValues?: string[];
  explanation: string;
  isFresh: boolean;
  averageAuthority: number;
}

export interface ContextSourceRef {
  sourceId: string;
  url: string;
  title: string;
  sourceName: string;
  sourceTier: 1 | 2 | 3;
  authorityScore: number;
  sourceType: string;
  publishedDate?: string;
  snippet: string;
}

export interface ContextConflict {
  subject: string;
  predicate: string;
  conflictingValues: { value: string; sourceNames: string[] }[];
  severity: 'minor' | 'major';
}

export interface ContextMissingInfo {
  category: ResearchCategory;
  reason: string;
  queriesAttempted: number;
}

export interface EvidenceContext {
  contact: { id: string; name: string; title: string; company: string };
  factGroups: ContextFactGroup[];
  allFacts: ContextFact[];
  sources: ContextSourceRef[];
  conflicts: ContextConflict[];
  missingInfo: ContextMissingInfo[];
  trustScore: number;
  verification: {
    status: string;
    totalFacts: number;
    verifiedCount: number;
    conflictingCount: number;
    unverifiedCount: number;
  };
  authority: {
    averageAuthority: number;
    tier1Count: number;
    tier2Count: number;
    tier3Count: number;
  };
  completeness: number;
  evidenceSummary: string;
  researchRecommendations: string[];
  metadata: {
    totalSources: number;
    totalDocuments: number;
    totalQueriesExecuted: number;
    planId?: string;
    agentsRun: string[];
    createdAt: string;
  };
}

export class EvidenceContextBuilder {
  build(evidence: EvidencePackage): EvidenceContext {
    const sourcesById = this.indexSourcesById(evidence.sources);
    const allFacts = this.convertFacts(evidence.facts, sourcesById);
    const factGroups = this.groupFactsByCategory(allFacts);
    const conflicts = this.convertConflicts(evidence.conflicts, sourcesById);
    const sourceRefs = this.convertSources(evidence.sources);
    const missingInfo = this.convertMissingInfo(evidence.missingInfo);

    return {
      contact: {
        id: evidence.contact.id,
        name: evidence.contact.name,
        title: evidence.contact.title || '',
        company: evidence.contact.company,
      },
      factGroups,
      allFacts,
      sources: sourceRefs,
      conflicts,
      missingInfo,
      trustScore: evidence.trustScore,
      verification: {
        status: evidence.verificationResults.status,
        totalFacts: evidence.verificationResults.totalFacts,
        verifiedCount: evidence.verificationResults.verifiedCount,
        conflictingCount: evidence.verificationResults.conflictingCount,
        unverifiedCount: evidence.verificationResults.unverifiedCount,
      },
      authority: {
        averageAuthority: evidence.sourceAuthoritySummary.averageAuthority,
        tier1Count: evidence.sourceAuthoritySummary.tier1Count,
        tier2Count: evidence.sourceAuthoritySummary.tier2Count,
        tier3Count: evidence.sourceAuthoritySummary.tier3Count,
      },
      completeness: evidence.evidenceSummary.completenessScore,
      evidenceSummary: evidence.evidenceSummary.summary,
      researchRecommendations: evidence.missingEvidenceSummary.recommendations,
      metadata: {
        totalSources: evidence.sources.length,
        totalDocuments: evidence.documents.length,
        totalQueriesExecuted: evidence.metadata.searchQueryCount,
        planId: evidence.metadata.planId,
        agentsRun: evidence.metadata.agentsRun,
        createdAt: evidence.metadata.createdAt,
      },
    };
  }

  private indexSourcesById(sources: EvidenceSource[]): Map<string, EvidenceSource> {
    const map = new Map<string, EvidenceSource>();
    for (const source of sources) {
      map.set(source.id, source);
    }
    return map;
  }

  private convertFacts(facts: Fact[], sourcesById: Map<string, EvidenceSource>): ContextFact[] {
    return facts.map((fact) => {
      const supportingSources = fact.sourceIds
        .map((id) => sourcesById.get(id))
        .filter((s): s is EvidenceSource => s !== undefined);

      const sourceNames = supportingSources.map((s) => s.sourceName);
      const authorityScores = fact.metadata.sourceAuthorityScores ?? [];
      const averageAuthority = authorityScores.length > 0
        ? Math.round(authorityScores.reduce((sum, s) => sum + s, 0) / authorityScores.length)
        : 0;

      let conflictingValues: string[] | undefined;
      if (fact.verificationStatus === 'conflicting') {
        conflictingValues = ['Conflicting values detected — see conflicts section'];
      }

      return {
        factId: fact.factId,
        category: fact.category,
        subject: fact.subject,
        predicate: fact.predicate,
        value: fact.value,
        confidence: fact.confidence,
        verificationStatus: fact.verificationStatus,
        sourceIds: fact.sourceIds,
        sourceNames,
        hasConflict: fact.verificationStatus === 'conflicting',
        conflictingValues,
        explanation: fact.metadata.explanation || `Fact with ${fact.verificationStatus} status, confidence ${fact.confidence}%`,
        isFresh: fact.metadata.isFresh ?? false,
        averageAuthority,
      };
    });
  }

  private groupFactsByCategory(facts: ContextFact[]): ContextFactGroup[] {
    const groups = new Map<FactCategory, ContextFact[]>();
    for (const fact of facts) {
      const existing = groups.get(fact.category) || [];
      existing.push(fact);
      groups.set(fact.category, existing);
    }
    return Array.from(groups.entries()).map(([category, facts]) => ({ category, facts }));
  }

  private convertConflicts(
    conflicts: ConflictRecord[],
    sourcesById: Map<string, EvidenceSource>,
  ): ContextConflict[] {
    return conflicts.map((conflict) => ({
      subject: conflict.subject,
      predicate: conflict.predicate,
      conflictingValues: conflict.conflictingValues.map((cv) => ({
        value: cv.value,
        sourceNames: cv.sourceIds
          .map((id) => sourcesById.get(id)?.sourceName)
          .filter((n): n is string => n !== undefined),
      })),
      severity: conflict.severity,
    }));
  }

  private convertSources(sources: EvidenceSource[]): ContextSourceRef[] {
    return sources.map((source) => ({
      sourceId: source.id,
      url: source.url,
      title: source.title,
      sourceName: source.sourceName,
      sourceTier: source.sourceTier,
      authorityScore: source.authorityScore ?? 0,
      sourceType: source.sourceType,
      publishedDate: source.publishedDate,
      snippet: source.snippet,
    }));
  }

  private convertMissingInfo(
    missingInfo: EvidencePackage['missingInfo'],
  ): ContextMissingInfo[] {
    return missingInfo.map((entry) => ({
      category: entry.category,
      reason: entry.reason,
      queriesAttempted: entry.queriesAttempted,
    }));
  }
}
