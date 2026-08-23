import type { SearchProvider } from '../providers/searchProvider';
import type { SearchResult, SearchOptions } from '../providers/types';
import type { EvidencePackage, EvidenceSource } from './EvidencePackage';
import type { ResearchPlan, PlannedQuery } from './ResearchPlan';

/*
 * SearchAgent — executes research based on a Research Plan.
 *
 * Upgraded from the previous version to consume a ResearchPlan rather than
 * hardcoded queries. The agent:
 *   1. Reads planned queries from the ResearchPlan.
 *   2. Selects the appropriate search provider (injected, not hardcoded).
 *   3. Executes searches and collects structured results.
 *   4. Preserves URLs, titles, snippets, and timestamps.
 *   5. Appends results into the EvidencePackage.
 *
 * The SearchAgent NEVER summarizes content — it only collects raw results.
 * The ReaderAgent reads full page content. The EvidenceCollector organizes.
 */

export interface SearchAgentConfig {
  maxResultsPerQuery: number;
  /** Max queries to execute (safety limit) */
  maxQueries: number;
}

const DEFAULT_CONFIG: SearchAgentConfig = {
  maxResultsPerQuery: 3,
  maxQueries: 15,
};

export class SearchAgent {
  constructor(
    private searchProvider: SearchProvider,
    private config: SearchAgentConfig = DEFAULT_CONFIG,
  ) {}

  /**
   * Execute searches based on a Research Plan.
   * Returns an updated EvidencePackage with search results and preliminary sources.
   */
  async searchFromPlan(
    plan: ResearchPlan,
    evidence: EvidencePackage,
  ): Promise<EvidencePackage> {
    const allResults: SearchResult[] = [];
    const sources: EvidenceSource[] = [];
    let queriesExecuted = 0;
    let sourceIdx = 0;

    const queries = plan.queries.slice(0, this.config.maxQueries);

    for (const plannedQuery of queries) {
      const opts: SearchOptions = {
        maxResults: this.config.maxResultsPerQuery,
      };

      if (plannedQuery.timeRange) {
        opts.timeRange = plannedQuery.timeRange;
      }
      if (plannedQuery.siteScope) {
        opts.siteScope = plannedQuery.siteScope;
      }

      try {
        const results = await this.searchProvider.search(plannedQuery.query, opts);

        for (const result of results) {
          // Deduplicate by URL
          if (allResults.some((r) => r.url === result.url)) {
            continue;
          }

          allResults.push(result);

          sources.push({
            id: `src-${sourceIdx++}`,
            url: result.url,
            title: result.title,
            sourceName: result.sourceName,
            sourceTier: result.sourceTier,
            snippet: result.snippet,
            publishedDate: result.date,
            retrievedAt: new Date().toISOString(),
            sourceType: this.inferSourceType(result.url, result.sourceName),
            category: plannedQuery.category,
          });
        }

        queriesExecuted++;
      } catch {
        // Skip failed queries — research continues with what we have
      }
    }

    evidence.searchResults = allResults;
    evidence.sources = sources;
    evidence.metadata.searchQueryCount = queriesExecuted;
    evidence.metadata.agentsRun.push('SearchAgent');
    evidence.metadata.updatedAt = new Date().toISOString();

    // Update plan metadata
    plan.metadata.queriesExecuted = queriesExecuted;
    plan.metadata.sourcesFound = allResults.length;
    plan.status = 'searching';

    return evidence;
  }

  /**
   * Legacy search method — preserved for backward compatibility.
   * Used by the existing ResearchCoordinator when no plan is available.
   */
  async search(
    contact: { name: string; title: string; company: string },
    evidence: EvidencePackage,
  ): Promise<EvidencePackage> {
    const queries = this.buildLegacyQueries(contact);
    const allResults: SearchResult[] = [];
    const sources: EvidenceSource[] = [];
    let sourceIdx = 0;

    for (const [track, query] of queries) {
      const opts: SearchOptions = {
        maxResults: this.config.maxResultsPerQuery,
      };

      if (track === 'press') {
        opts.timeRange = 'year';
      }

      try {
        const results = await this.searchProvider.search(query, opts);
        for (const result of results) {
          if (allResults.some((r) => r.url === result.url)) continue;

          allResults.push(result);
          sources.push({
            id: `src-${sourceIdx++}`,
            url: result.url,
            title: result.title,
            sourceName: result.sourceName,
            sourceTier: result.sourceTier,
            snippet: result.snippet,
            publishedDate: result.date,
            retrievedAt: new Date().toISOString(),
            sourceType: this.inferSourceType(result.url, result.sourceName),
          });
        }
      } catch {
        // Skip failed queries
      }
    }

    evidence.searchResults = allResults;
    evidence.sources = sources;
    evidence.metadata.searchQueryCount = queries.length;
    evidence.metadata.agentsRun.push('SearchAgent');
    evidence.metadata.updatedAt = new Date().toISOString();

    return evidence;
  }

  private buildLegacyQueries(contact: {
    name: string;
    title: string;
    company: string;
  }): [string, string][] {
    return [
      ['professional', `${contact.name} ${contact.title} ${contact.company} LinkedIn profile`],
      ['press', `${contact.company} ${contact.name} press release news`],
      ['industry', `${contact.company} industry trends digital transformation Philippines`],
    ];
  }

  private inferSourceType(url: string, sourceName: string): EvidenceSource['sourceType'] {
    const lowerUrl = url.toLowerCase();
    const lowerName = sourceName.toLowerCase();

    if (lowerUrl.includes('linkedin.com')) return 'linkedin';
    if (lowerUrl.includes('news') || lowerName.includes('news')) return 'news_article';
    if (lowerName.includes('press') || lowerUrl.includes('press')) return 'press_release';
    if (lowerUrl.includes('blog') || lowerName.includes('blog')) return 'blog_post';
    if (lowerUrl.includes('interview') || lowerUrl.includes('podcast')) return 'interview';
    if (lowerUrl.includes('conference') || lowerUrl.includes('summit') || lowerUrl.includes('forum')) {
      return 'conference_page';
    }
    if (lowerUrl.includes('award') || lowerName.includes('award')) return 'award_page';
    if (lowerName.includes('report') || lowerName.includes('research')) return 'industry_report';

    // Check if it's likely the company website
    if (lowerUrl.includes('about') || lowerUrl.includes('company')) return 'company_website';

    return 'other';
  }
}
