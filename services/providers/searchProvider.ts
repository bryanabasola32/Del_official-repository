import type { SearchResult, SearchOptions } from './types';
import { getResearchProviderConfig } from '../models/ResearchProviderConfig';
import { getResearchHealthManager } from '../router/ResearchHealthManager';

/*
 * SearchProvider — abstracts web search queries.
 *
 * Implementations:
 *   - MockSearchProvider      (returns deterministic placeholder results)
 *   - TavilySearchProvider    (production: Tavily Search API via edge function)
 *   - ExaSearchProvider       (future)
 *   - SerperSearchProvider    (future)
 *
 * The orchestrator uses this for the Researcher agent's search tracks.
 */

export interface SearchProvider {
  readonly name: string;
  readonly isMock: boolean;

  search(query: string, opts?: SearchOptions): Promise<SearchResult[]>;
  isConfigured(): boolean;
}

// ── Mock Implementation ──────────────────────────

export class MockSearchProvider implements SearchProvider {
  readonly name = 'mock-search';
  readonly isMock = true;

  isConfigured(): boolean {
    return true;
  }

  async search(query: string, opts?: SearchOptions): Promise<SearchResult[]> {
    const max = opts?.maxResults ?? 5;
    const results: SearchResult[] = [];

    for (let i = 0; i < Math.min(max, 3); i++) {
      results.push({
        title: `Search result ${i + 1} for "${query}"`,
        url: `https://example.com/search/${encodeURIComponent(query)}/${i}`,
        snippet: `Mock search snippet for query "${query}". This would contain a relevant excerpt from the page content.`,
        sourceName: opts?.siteScope?.[0] || 'Mock Search Source',
        sourceTier: 2,
        date: new Date(Date.now() - i * 86400000).toISOString(),
      });
    }

    return results;
  }
}

// ── Factory ──────────────────────────────────────

export function createSearchProvider(): SearchProvider {
  const config = getResearchProviderConfig('tavily');
  const healthManager = getResearchHealthManager();

  if (config?.enabled) {
    healthManager.registerProvider('tavily', 'ACTIVE');
    // Lazy import to avoid circular dependency at module load time
    const { TavilySearchProvider } = require('./tavily/TavilySearchProvider');
    return new TavilySearchProvider();
  }

  return new MockSearchProvider();
}
