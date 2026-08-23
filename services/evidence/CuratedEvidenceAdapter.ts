import type {
  EvidencePackage,
  EvidenceSource,
  SourceType,
} from '../research/EvidencePackage';
import type { Fact, FactCategory, VerificationStatus, ExtractionMethod } from '../research/Fact';
import type { RawCuratedPackage, RawCuratedSource, RawCuratedFact, ValidationResult, IdentityMatchResult } from './CuratedEvidenceTypes';
import type { Contact } from '@/lib/types';

/*
 * CuratedEvidenceAdapter — validates and normalizes raw curated evidence
 * packages into DEL EvidencePackage objects.
 *
 * No AI calls are used. All validation and normalization is deterministic
 * TypeScript.
 *
 * Responsibilities:
 *   - validate(raw): check the raw JSON structure
 *   - normalizeIdentity(raw): extract executive identity
 *   - validateIdentity(identity, contact): strict entity matching
 *   - toEvidencePackage(raw, contact): convert raw to DEL EvidencePackage
 *   - merge(live, curated): merge two EvidencePackages with dedup + provenance
 */

const VALID_SOURCE_TYPES: SourceType[] = [
  'linkedin', 'company_website', 'news_article', 'press_release',
  'blog_post', 'interview', 'conference_page', 'award_page',
  'industry_report', 'social_media', 'other',
];

const VALID_VERIFICATION_STATUSES: VerificationStatus[] = [
  'unverified', 'single_source', 'corroborated', 'verified', 'conflicting', 'rejected',
];

const VALID_EXTRACTION_METHODS: ExtractionMethod[] = ['heuristic', 'ai_assisted', 'manual', 'mock'];

function normalizeString(val: unknown): string {
  if (typeof val === 'string') return val.trim();
  return '';
}

function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[.,]/g, '').replace(/\s+/g, ' ').trim();
}

function normalizeCompany(company: string): string {
  return company
    .toLowerCase()
    .replace(/\b(inc|corp|corporation|holdings|ltd|co|llc)\b\.?/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export class CuratedEvidenceAdapter {

  /** Validate the raw JSON structure of a curated evidence package. */
  validate(raw: RawCuratedPackage): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Extract identity — support both nested and flat schemas
    const execBlock = raw.executive || {};
    const name = normalizeString(execBlock.name || raw.name);
    const company = normalizeString(execBlock.company || raw.company);
    const title = normalizeString(execBlock.title || raw.title);
    const linkedin = normalizeString(execBlock.linkedin || raw.linkedin);

    if (!name) errors.push('Executive name is required');
    if (!company) errors.push('Executive company is required');

    // Extract sources — support both top-level and nested under evidence
    const rawSources = raw.sources || raw.evidence?.sources || [];
    if (!Array.isArray(rawSources)) {
      errors.push('Sources must be an array');
    }
    const sources = Array.isArray(rawSources) ? rawSources : [];

    // Extract facts — support both top-level and nested under evidence
    const rawFacts = raw.facts || raw.evidence?.facts || [];
    if (!Array.isArray(rawFacts)) {
      errors.push('Facts must be an array');
    }
    const facts = Array.isArray(rawFacts) ? rawFacts : [];

    if (sources.length === 0) warnings.push('Package contains no sources');
    if (facts.length === 0) warnings.push('Package contains no facts');

    // Validate each source has minimum required fields
    for (let i = 0; i < sources.length; i++) {
      const s = sources[i];
      const srcId = normalizeString(s.id || s.url);
      if (!srcId) errors.push(`Source at index ${i} has no id or url`);
      if (!s.url && !s.title) warnings.push(`Source at index ${i} has no url or title`);
    }

    // Validate each fact has minimum required fields
    for (let i = 0; i < facts.length; i++) {
      const f = facts[i];
      const factId = normalizeString(f.factId || f.fact_id);
      if (!factId) errors.push(`Fact at index ${i} has no factId`);
      if (!f.subject && !f.value) errors.push(`Fact at index ${i} has no subject or value`);
      const fSourceIds = f.sourceIds || f.source_ids;
      if (!Array.isArray(fSourceIds) || fSourceIds.length === 0) {
        warnings.push(`Fact at index ${i} has no source references`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      identity: { name, company, title, linkedin: linkedin || undefined },
      sourceCount: sources.length,
      factCount: facts.length,
    };
  }

  /** Validate that the package identity matches the selected DEL contact. */
  validateIdentity(
    packageName: string,
    packageCompany: string,
    contact: Pick<Contact, 'id' | 'name' | 'company' | 'title'>,
  ): IdentityMatchResult {
    const reasons: string[] = [];
    const normPkgName = normalizeName(packageName);
    const normContactName = normalizeName(contact.name);
    const normPkgCompany = normalizeCompany(packageCompany);
    const normContactCompany = normalizeCompany(contact.company);

    // Name matching — must be a strong match
    const nameMatch = normPkgName === normContactName
      || normPkgName.includes(normContactName)
      || normContactName.includes(normPkgName);

    // For names, also check token overlap (handles middle names, suffixes)
    const pkgNameTokens = new Set(normPkgName.split(' ').filter((t) => t.length > 1));
    const contactNameTokens = new Set(normContactName.split(' ').filter((t) => t.length > 1));
    const nameTokenOverlap = [...pkgNameTokens].filter((t) => contactNameTokens.has(t)).length;
    const nameTokenMatch = nameTokenOverlap >= Math.min(pkgNameTokens.size, contactNameTokens.size) && nameTokenOverlap >= 2;

    if (!nameMatch && !nameTokenMatch) {
      reasons.push(`Name mismatch: package "${packageName}" vs contact "${contact.name}"`);
    }

    // Company matching — must be a strong match
    const companyMatch = normPkgCompany === normContactCompany
      || normPkgCompany.includes(normContactCompany)
      || normContactCompany.includes(normPkgCompany);

    if (!companyMatch) {
      reasons.push(`Company mismatch: package "${packageCompany}" vs contact "${contact.company}"`);
    }

    const matched = reasons.length === 0;
    let confidence: IdentityMatchResult['confidence'] = 'none';
    if (matched) {
      const exactName = normPkgName === normContactName;
      const exactCompany = normPkgCompany === normContactCompany;
      confidence = (exactName && exactCompany) ? 'high' : 'medium';
    }

    return {
      matched,
      confidence,
      reasons,
      contactId: contact.id,
      packageName,
      packageCompany,
      contactName: contact.name,
      contactCompany: contact.company,
    };
  }

  /** Convert a validated raw package into a DEL EvidencePackage. */
  toEvidencePackage(
    raw: RawCuratedPackage,
    contact: Pick<Contact, 'id' | 'name' | 'title' | 'company'>,
  ): EvidencePackage {
    const rawSources = raw.sources || raw.evidence?.sources || [];
    const rawFacts = raw.facts || raw.evidence?.facts || [];

    const now = new Date().toISOString();

    // Normalize sources
    const sources: EvidenceSource[] = rawSources.map((rs, i) => {
      const id = normalizeString(rs.id || `curated-src-${i}`);
      const sourceType = this.normalizeSourceType(rs.sourceType || rs.source_type);
      const tier = this.normalizeTier(rs.sourceTier || rs.source_tier);
      return {
        id,
        url: normalizeString(rs.url),
        title: normalizeString(rs.title || rs.url || `Source ${i}`),
        sourceName: normalizeString(rs.sourceName || rs.source_name || rs.url || `Curated Source ${i}`),
        sourceTier: tier,
        snippet: normalizeString(rs.snippet),
        publishedDate: rs.publishedDate || rs.published_date,
        retrievedAt: normalizeString(rs.retrievedAt || rs.retrieved_at || now),
        author: rs.author ? normalizeString(rs.author) : undefined,
        sourceType,
        category: rs.category as EvidenceSource['category'] | undefined,
      };
    });

    // Build a source ID lookup for dedup
    const sourceIdSet = new Set(sources.map((s) => s.id));

    // Normalize facts
    const facts: Fact[] = rawFacts.map((rf, i) => {
      const factId = normalizeString(rf.factId || rf.fact_id || `curated-fact-${i}`);
      const rawSourceIds = rf.sourceIds || rf.source_ids || [];
      const sourceIds = rawSourceIds.filter((sid) => sourceIdSet.has(sid));
      return {
        factId,
        category: this.normalizeFactCategory(rf.category),
        subject: normalizeString(rf.subject || contact.name),
        predicate: normalizeString(rf.predicate || 'curated_fact'),
        value: normalizeString(rf.value || ''),
        sourceIds,
        extractedFrom: rf.extractedFrom || rf.extracted_from || [],
        extractedAt: normalizeString(rf.extractedAt || rf.extracted_at || now),
        extractionMethod: this.normalizeExtractionMethod(rf.extractionMethod || rf.extraction_method),
        confidence: typeof rf.confidence === 'number' ? rf.confidence : 0,
        verificationStatus: this.normalizeVerificationStatus(rf.verificationStatus || rf.verification_status),
        metadata: (rf.metadata || {}) as Fact['metadata'],
      };
    });

    // Build a minimal but complete EvidencePackage
    return {
      contact: {
        id: contact.id,
        name: contact.name,
        title: contact.title || '',
        company: contact.company,
      },
      executiveProfile: {
        name: contact.name,
        title: contact.title || '',
        company: contact.company,
        sourceIds: sources.map((s) => s.id),
      },
      company: {
        name: contact.company,
        sourceIds: sources.map((s) => s.id),
      },
      professionalHistory: [],
      news: [],
      publications: [],
      interviews: [],
      speakingEvents: [],
      awards: [],
      searchResults: [],
      documents: [],
      verifiedFacts: [],
      sources,
      confidence: 0,
      verification: {
        status: 'pending',
        verifiedCount: 0,
        unverifiedCount: facts.length,
        contradictoryCount: 0,
      },
      missingInfo: [],
      metadata: {
        createdAt: now,
        updatedAt: now,
        agentsRun: ['CuratedEvidenceAdapter'],
        searchQueryCount: 0,
        documentCount: 0,
        cacheHit: false,
      },
      statistics: {
        totalQueriesExecuted: 0,
        totalSourcesFound: sources.length,
        totalDocumentsRead: 0,
        sourcesByTier: {
          tier1: sources.filter((s) => s.sourceTier === 1).length,
          tier2: sources.filter((s) => s.sourceTier === 2).length,
          tier3: sources.filter((s) => s.sourceTier === 3).length,
        },
        sourcesByCategory: {},
        averageSnippetLength: 0,
        duplicateSourcesRemoved: 0,
      },
      facts,
      verifiedFactsList: [],
      conflictingFacts: [],
      conflicts: [],
      trustScore: 0,
      confidenceBreakdown: new Map(),
      verificationResults: {
        status: 'pending',
        totalFacts: facts.length,
        verifiedCount: 0,
        singleSourceCount: 0,
        corroboratedCount: 0,
        conflictingCount: 0,
        rejectedCount: 0,
        unverifiedCount: facts.length,
      },
      verificationWarnings: [],
      sourceAuthoritySummary: {
        averageAuthority: 0,
        tier1Count: 0,
        tier2Count: 0,
        tier3Count: 0,
        authorityByType: {},
      },
      evidenceSummary: {
        verifiedFactCount: 0,
        assessedSourceCount: 0,
        completenessScore: 0,
        summary: `Curated evidence package with ${sources.length} sources and ${facts.length} facts.`,
      },
      missingEvidenceSummary: {
        missingCategories: [],
        insufficientCategories: [],
        totalMissing: 0,
        recommendations: [],
      },
      isVerified: false,
    };
  }

  /**
   * Merge a live EvidencePackage with a curated EvidencePackage.
   * - Deduplicates facts by normalized (subject, predicate, value) triple
   * - Combines source references for equivalent facts
   * - Preserves conflicts (never silently resolves)
   * - Adds provenance metadata (origin: curated_library)
   * - Returns the merged package (does not mutate either input)
   */
  merge(live: EvidencePackage, curated: EvidencePackage): EvidencePackage {
    const now = new Date().toISOString();

    // Merge sources — dedup by URL, prefix curated IDs to avoid collision
    const liveSources = [...live.sources];
    const liveUrlSet = new Set(liveSources.map((s) => s.url).filter(Boolean));
    const curatedSources: EvidenceSource[] = [];
    const sourceIdMap = new Map<string, string>(); // curated original id → merged id

    for (const cs of curated.sources) {
      const newId = `cur-${cs.id}`;
      sourceIdMap.set(cs.id, newId);
      if (cs.url && liveUrlSet.has(cs.url)) {
        // Source already exists in live — map to the existing one
        const existing = liveSources.find((s) => s.url === cs.url);
        if (existing) sourceIdMap.set(cs.id, existing.id);
        continue;
      }
      curatedSources.push({ ...cs, id: newId });
    }

    const mergedSources = [...liveSources, ...curatedSources];

    // Merge facts — dedup by normalized (subject, predicate, value)
    const factDedupKey = (f: Fact) =>
      `${normalizeName(f.subject)}|${f.predicate.toLowerCase().trim()}|${normalizeString(f.value)}`;

    const liveFactMap = new Map<string, Fact>();
    for (const f of live.facts) {
      liveFactMap.set(factDedupKey(f), f);
    }

    const mergedFacts: Fact[] = [...live.facts];
    let factsAdded = 0;

    for (const cf of curated.facts) {
      const key = factDedupKey(cf);
      const existing = liveFactMap.get(key);
      if (existing) {
        // Equivalent fact — combine source references
        const remappedSourceIds = cf.sourceIds
          .map((sid) => sourceIdMap.get(sid))
          .filter((sid): sid is string => sid !== undefined && !existing.sourceIds.includes(sid));
        if (remappedSourceIds.length > 0) {
          // Update the existing fact in the merged list
          const idx = mergedFacts.findIndex((f) => f.factId === existing.factId);
          if (idx >= 0) {
            mergedFacts[idx] = {
              ...mergedFacts[idx],
              sourceIds: [...mergedFacts[idx].sourceIds, ...remappedSourceIds],
              metadata: {
                ...mergedFacts[idx].metadata,
                corroboratingSourceIds: [
                  ...(mergedFacts[idx].metadata.corroboratingSourceIds || []),
                  ...remappedSourceIds,
                ],
              },
            };
          }
        }
      } else {
        // New fact from curated — remap source IDs and add
        const remappedSourceIds = cf.sourceIds
          .map((sid) => sourceIdMap.get(sid))
          .filter((sid): sid is string => sid !== undefined);
        mergedFacts.push({
          ...cf,
          factId: `cur-${cf.factId}`,
          sourceIds: remappedSourceIds,
          metadata: {
            ...cf.metadata,
            explanation: `[Curated Library] ${cf.metadata.explanation || ''}`.trim(),
          },
        });
        liveFactMap.set(key, cf);
        factsAdded++;
      }
    }

    // Merge conflicts — preserve all, remap curated fact IDs
    const mergedConflicts = [
      ...live.conflicts,
      ...curated.conflicts.map((c) => ({
        ...c,
        factId: `cur-${c.factId}`,
      })),
    ];

    // Build the merged package
    return {
      ...live,
      sources: mergedSources,
      facts: mergedFacts,
      conflicts: mergedConflicts,
      metadata: {
        ...live.metadata,
        updatedAt: now,
        agentsRun: [...live.metadata.agentsRun, 'CuratedEvidenceMerge'],
      },
      statistics: {
        ...live.statistics,
        totalSourcesFound: mergedSources.length,
        sourcesByTier: {
          tier1: mergedSources.filter((s) => s.sourceTier === 1).length,
          tier2: mergedSources.filter((s) => s.sourceTier === 2).length,
          tier3: mergedSources.filter((s) => s.sourceTier === 3).length,
        },
      },
    };
  }

  // ── Private normalization helpers ──

  private normalizeSourceType(val: unknown): SourceType {
    const s = normalizeString(val as string) as SourceType;
    return VALID_SOURCE_TYPES.includes(s) ? s : 'other';
  }

  private normalizeTier(val: unknown): 1 | 2 | 3 {
    const t = typeof val === 'number' ? val : parseInt(normalizeString(val), 10);
    if (t === 1) return 1;
    if (t === 3) return 3;
    return 2;
  }

  private normalizeVerificationStatus(val: unknown): VerificationStatus {
    const s = normalizeString(val as string) as VerificationStatus;
    return VALID_VERIFICATION_STATUSES.includes(s) ? s : 'unverified';
  }

  private normalizeExtractionMethod(val: unknown): ExtractionMethod {
    const s = normalizeString(val as string) as ExtractionMethod;
    return VALID_EXTRACTION_METHODS.includes(s) ? s : 'manual';
  }

  private normalizeFactCategory(val: unknown): FactCategory {
    const s = normalizeString(val as string) as FactCategory;
    return s || ('biography' as FactCategory);
  }
}
