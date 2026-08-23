import type { SearchProvider } from '../searchProvider';
import type { SearchResult, SearchOptions } from '../types';
import { MockSearchProvider } from '../searchProvider';
import { getResearchProviderConfig } from '../../models/ResearchProviderConfig';
import { getResearchHealthManager } from '../../router/ResearchHealthManager';
import { getResearchQuotaManager } from '../../router/ResearchQuotaManager';
import { callResearchEdgeFunction } from '../researchEdgeCall';
import { getExecutionLogger } from '../../logging';

/*
 * TavilySearchProvider — production search via the Tavily Search API.
 *
 * Production mode: calls the `tavily-search` edge function which proxies
 * the Tavily Search API, reads TAVILY_API_KEY from Supabase secrets, and
 * returns normalized results.
 *
 * Mock fallback: if the edge function is unreachable, the API key is missing,
 * or quota is exhausted, falls back to MockSearchProvider so the Evidence
 * Pipeline never crashes.
 *
 * No Tavily response object escapes this provider — all responses are
 * normalized into DEL's SearchResult model.
 */

interface TavilyEdgeResponse {
  results: SearchResult[];
  mock?: boolean;
  warning?: string;
}

export class TavilySearchProvider implements SearchProvider {
  readonly name = 'tavily-search';
  readonly isMock = false;

  private mock = new MockSearchProvider();
  private logger = getExecutionLogger();

  isConfigured(): boolean {
    const config = getResearchProviderConfig('tavily');
    return !!config?.enabled;
  }

  async search(query: string, opts?: SearchOptions): Promise<SearchResult[]> {
    const config = getResearchProviderConfig('tavily');
    const healthManager = getResearchHealthManager();
    const quotaManager = getResearchQuotaManager();

    if (!config) return this.mock.search(query, opts);

    if (!healthManager.isAvailable('tavily')) {
      this.logger.warning('search', `Tavily unavailable (${healthManager.getState('tavily')}) — using mock fallback`);
      return this.mock.search(query, opts);
    }

    const maxResults = opts?.maxResults ?? config.maxResults;

    const result = await callResearchEdgeFunction<TavilyEdgeResponse>(
      config.edgeFunctionSlug,
      'tavily',
      {
        query,
        maxResults,
        siteScope: opts?.siteScope,
        timeRange: opts?.timeRange,
        includeContent: opts?.includeContent,
      },
      { timeoutMs: config.timeoutMs, maxRetries: config.maxRetries },
    );

    if (result.ok && result.data?.results) {
      this.logger.logResearchExecution({
        stage: 'search',
        provider: 'tavily',
        providerCategory: 'search',
        latencyMs: result.latencyMs,
        retries: result.retries,
        fallback: false,
        resultCount: result.data.results.length,
        mock: result.data.mock ?? false,
        warning: result.data.warning,
      });
      return result.data.results;
    }

    quotaManager.handleProviderError('tavily', result.error || 'Unknown error', result.status);
    this.logger.logResearchExecution({
      stage: 'search',
      provider: 'tavily',
      providerCategory: 'search',
      latencyMs: result.latencyMs,
      retries: result.retries,
      fallback: true,
      resultCount: 0,
      mock: true,
      warning: `Tavily failed: ${result.error}. Using mock fallback.`,
    });
    return this.mock.search(query, opts);
  }
}
