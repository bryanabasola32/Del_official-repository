import type { EvidencePackage, EvidenceSource } from './EvidencePackage';
import type { PageContent } from '../providers/types';
import type { ResearchPlan, ResearchCategory } from './ResearchPlan';

/*
 * EvidenceCollector — gathers information from all Reader Agent outputs.
 *
 * Responsibilities:
 *   - Merge duplicate sources (same URL appearing in multiple search results)
 *   - Group related findings by category (news, interviews, awards, etc.)
 *   - Track originating URLs and timestamps
 *   - Preserve metadata and document relationships
 *   - Build the final structured EvidencePackage sections
 *
 * The collector does NOT summarize information — it only organizes and
 * structures what the Search and Reader agents have already collected.
 * Summarization belongs to the AI via the Intelligence Router.
 */

export class EvidenceCollector {
  /**
   * Collect and organize all evidence from search results and documents
   * into the structured sections of the EvidencePackage.
   */
  collect(
    evidence: EvidencePackage,
    plan: ResearchPlan,
  ): EvidencePackage {
    // Deduplicate sources by URL
    const dedupedSources = this.deduplicateSources(evidence.sources);
    const removedCount = evidence.sources.length - dedupedSources.length;

    // Group sources by category
    const sourcesByCategory = this.groupByCategory(dedupedSources);

    // Build structured sections from the collected evidence
    evidence.executiveProfile = this.buildExecutiveProfile(evidence, dedupedSources);
    evidence.company = this.buildCompanyInfo(evidence, dedupedSources);
    evidence.professionalHistory = this.buildProfessionalHistory(evidence, dedupedSources);
    evidence.news = this.buildNewsEntries(dedupedSources);
    evidence.publications = this.buildPublications(dedupedSources);
    evidence.interviews = this.buildInterviews(dedupedSources);
    evidence.speakingEvents = this.buildSpeakingEvents(dedupedSources);
    evidence.awards = this.buildAwards(dedupedSources);

    // Track missing information
    evidence.missingInfo = this.identifyMissingInfo(plan, dedupedSources);

    // Compute statistics
    evidence.statistics = this.computeStatistics(evidence, dedupedSources, removedCount);

    // Update sources with deduped version
    evidence.sources = dedupedSources;

    // Update metadata
    evidence.metadata.agentsRun.push('EvidenceCollector');
    evidence.metadata.updatedAt = new Date().toISOString();

    return evidence;
  }

  private deduplicateSources(sources: EvidenceSource[]): EvidenceSource[] {
    const seen = new Map<string, EvidenceSource>();

    for (const source of sources) {
      const normalizedUrl = this.normalizeUrl(source.url);
      if (!seen.has(normalizedUrl)) {
        seen.set(normalizedUrl, source);
      } else {
        // Merge — keep the richer source (more metadata)
        const existing = seen.get(normalizedUrl)!;
        const merged: EvidenceSource = {
          ...existing,
          snippet: source.snippet.length > existing.snippet.length ? source.snippet : existing.snippet,
          author: source.author || existing.author,
          publishedDate: source.publishedDate || existing.publishedDate,
          title: source.title || existing.title,
        };
        seen.set(normalizedUrl, merged);
      }
    }

    return Array.from(seen.values());
  }

  private normalizeUrl(url: string): string {
    try {
      const parsed = new URL(url);
      // Remove trailing slash, fragments, and common tracking params
      const clean = `${parsed.protocol}//${parsed.host}${parsed.pathname.replace(/\/$/, '')}`;
      return clean.toLowerCase();
    } catch {
      return url.toLowerCase().replace(/\/$/, '');
    }
  }

  private groupByCategory(sources: EvidenceSource[]): Map<ResearchCategory, EvidenceSource[]> {
    const grouped = new Map<ResearchCategory, EvidenceSource[]>();
    for (const source of sources) {
      if (source.category) {
        const existing = grouped.get(source.category) || [];
        existing.push(source);
        grouped.set(source.category, existing);
      }
    }
    return grouped;
  }

  private buildExecutiveProfile(
    evidence: EvidencePackage,
    sources: EvidenceSource[],
  ): EvidencePackage['executiveProfile'] {
    const profile = evidence.executiveProfile;
    const bioSources = sources.filter((s) => s.category === 'executive_biography' || s.category === 'current_role');
    return {
      ...profile,
      linkedinUrl: bioSources.find((s) => s.sourceType === 'linkedin')?.url || profile.linkedinUrl,
      sourceIds: bioSources.map((s) => s.id),
    };
  }

  private buildCompanyInfo(
    evidence: EvidencePackage,
    sources: EvidenceSource[],
  ): EvidencePackage['company'] {
    const company = evidence.company;
    const companySources = sources.filter(
      (s) => s.category === 'company_profile' || s.category === 'company_industry' || s.category === 'company_size',
    );
    const websiteSource = companySources.find((s) => s.sourceType === 'company_website');
    return {
      ...company,
      website: websiteSource?.url || company.website,
      sourceIds: companySources.map((s) => s.id),
    };
  }

  private buildProfessionalHistory(
    evidence: EvidencePackage,
    sources: EvidenceSource[],
  ): EvidencePackage['professionalHistory'] {
    const historySources = sources.filter((s) => s.category === 'professional_history');
    return historySources.map((source) => ({
      title: evidence.contact.title || '',
      company: evidence.contact.company,
      description: source.snippet,
      sourceIds: [source.id],
    }));
  }

  private buildNewsEntries(sources: EvidenceSource[]): EvidencePackage['news'] {
    return sources
      .filter((s) => s.category === 'recent_news' || s.sourceType === 'news_article' || s.sourceType === 'press_release')
      .map((source) => ({
        title: source.title,
        summary: source.snippet,
        url: source.url,
        publishedDate: source.publishedDate,
        sourceName: source.sourceName,
        sourceIds: [source.id],
      }));
  }

  private buildPublications(sources: EvidenceSource[]): EvidencePackage['publications'] {
    return sources
      .filter((s) => s.sourceType === 'blog_post')
      .map((source) => ({
        title: source.title,
        url: source.url,
        publishedDate: source.publishedDate,
        sourceIds: [source.id],
      }));
  }

  private buildInterviews(sources: EvidenceSource[]): EvidencePackage['interviews'] {
    return sources
      .filter((s) => s.category === 'public_interviews' || s.sourceType === 'interview')
      .map((source) => ({
        title: source.title,
        outlet: source.sourceName,
        url: source.url,
        publishedDate: source.publishedDate,
        sourceIds: [source.id],
      }));
  }

  private buildSpeakingEvents(sources: EvidenceSource[]): EvidencePackage['speakingEvents'] {
    return sources
      .filter((s) => s.category === 'speaking_engagements' || s.sourceType === 'conference_page')
      .map((source) => ({
        title: source.title,
        event: source.sourceName,
        url: source.url,
        date: source.publishedDate,
        sourceIds: [source.id],
      }));
  }

  private buildAwards(sources: EvidenceSource[]): EvidencePackage['awards'] {
    return sources
      .filter((s) => s.category === 'awards' || s.sourceType === 'award_page')
      .map((source) => ({
        title: source.title,
        organization: source.sourceName,
        url: source.url,
        date: source.publishedDate,
        sourceIds: [source.id],
      }));
  }

  private identifyMissingInfo(
    plan: ResearchPlan,
    sources: EvidenceSource[],
  ): EvidencePackage['missingInfo'] {
    const foundCategories = new Set(sources.map((s) => s.category).filter(Boolean) as ResearchCategory[]);
    const missing: EvidencePackage['missingInfo'] = [];

    for (const query of plan.queries) {
      if (!foundCategories.has(query.category)) {
        const existing = missing.find((m) => m.category === query.category);
        if (existing) {
          existing.queriesAttempted++;
        } else {
          missing.push({
            category: query.category,
            reason: `No sources found for ${query.category}`,
            queriesAttempted: 1,
          });
        }
      }
    }

    return missing;
  }

  private computeStatistics(
    evidence: EvidencePackage,
    sources: EvidenceSource[],
    duplicatesRemoved: number,
  ): EvidencePackage['statistics'] {
    const tier1 = sources.filter((s) => s.sourceTier === 1).length;
    const tier2 = sources.filter((s) => s.sourceTier === 2).length;
    const tier3 = sources.filter((s) => s.sourceTier === 3).length;

    const sourcesByCategory: Partial<Record<ResearchCategory, number>> = {};
    for (const source of sources) {
      if (source.category) {
        sourcesByCategory[source.category] = (sourcesByCategory[source.category] || 0) + 1;
      }
    }

    const totalSnippetLength = sources.reduce((sum, s) => sum + s.snippet.length, 0);
    const avgSnippet = sources.length > 0 ? Math.round(totalSnippetLength / sources.length) : 0;

    return {
      totalQueriesExecuted: evidence.metadata.searchQueryCount,
      totalSourcesFound: sources.length,
      totalDocumentsRead: evidence.documents.length,
      sourcesByTier: { tier1, tier2, tier3 },
      sourcesByCategory,
      averageSnippetLength: avgSnippet,
      duplicateSourcesRemoved: duplicatesRemoved,
    };
  }
}
