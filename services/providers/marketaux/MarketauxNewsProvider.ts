import type { NewsProvider } from '../newsProvider';
import type { NewsArticle } from '../types';
import { MockNewsProvider } from '../newsProvider';
import { getResearchProviderConfig } from '../../models/ResearchProviderConfig';
import { getResearchHealthManager } from '../../router/ResearchHealthManager';
import { getResearchQuotaManager } from '../../router/ResearchQuotaManager';
import { callResearchEdgeFunction } from '../researchEdgeCall';
import { getExecutionLogger } from '../../logging';

/*
 * MarketauxNewsProvider — production news via the Marketaux News API.
 *
 * Production mode: calls the `news-provider` edge function which proxies
 * the Marketaux API, reads MARKETAUX_API_KEY from Supabase secrets, and
 * returns normalized NewsArticle[].
 *
 * Covers executive news, company news, acquisitions, funding, partnerships,
 * and technology announcements.
 *
 * Mock fallback: if the edge function is unreachable, the API key is
 * missing, or quota is exhausted, falls back to MockNewsProvider.
 *
 * All Marketaux response objects are normalized into DEL's NewsArticle
 * model — no external response shape escapes this provider.
 */

interface NewsEdgeResponse {
  articles: NewsArticle[];
  mock?: boolean;
  warning?: string;
}

export class MarketauxNewsProvider implements NewsProvider {
  readonly name = 'marketaux-news';
  readonly isMock = false;

  private mock = new MockNewsProvider();
  private logger = getExecutionLogger();

  isConfigured(): boolean {
    const config = getResearchProviderConfig('marketaux');
    return !!config?.enabled;
  }

  async getGlobalNews(query: string, maxResults = 5): Promise<NewsArticle[]> {
    return this.callNews('global', query, undefined, maxResults);
  }

  async getLocalNews(query: string, sites?: string[], maxResults = 5): Promise<NewsArticle[]> {
    return this.callNews('local', query, sites, maxResults);
  }

  async getRSSFeed(feedUrl: string, maxResults = 5): Promise<NewsArticle[]> {
    return this.callNews('rss', feedUrl, undefined, maxResults);
  }

  private async callNews(
    track: 'global' | 'local' | 'rss',
    query: string,
    sites?: string[],
    maxResults?: number,
  ): Promise<NewsArticle[]> {
    const config = getResearchProviderConfig('marketaux');
    const healthManager = getResearchHealthManager();
    const quotaManager = getResearchQuotaManager();

    if (!config) {
      return this.mockCall(track, query, sites, maxResults);
    }

    if (!healthManager.isAvailable('marketaux')) {
      this.logger.warning('news', `Marketaux unavailable (${healthManager.getState('marketaux')}) — using mock fallback`);
      return this.mockCall(track, query, sites, maxResults);
    }

    const limit = maxResults ?? config.maxResults;

    const result = await callResearchEdgeFunction<NewsEdgeResponse>(
      config.edgeFunctionSlug,
      'marketaux',
      { track, query, sites, maxResults: limit },
      { timeoutMs: config.timeoutMs, maxRetries: config.maxRetries },
    );

    if (result.ok && result.data?.articles) {
      this.logger.logResearchExecution({
        stage: 'news',
        provider: 'marketaux',
        providerCategory: 'news',
        latencyMs: result.latencyMs,
        retries: result.retries,
        fallback: false,
        resultCount: result.data.articles.length,
        mock: result.data.mock ?? false,
        warning: result.data.warning,
      });
      return result.data.articles;
    }

    quotaManager.handleProviderError('marketaux', result.error || 'Unknown error', result.status);
    this.logger.logResearchExecution({
      stage: 'news',
      provider: 'marketaux',
      providerCategory: 'news',
      latencyMs: result.latencyMs,
      retries: result.retries,
      fallback: true,
      resultCount: 0,
      mock: true,
      warning: `Marketaux failed: ${result.error}. Using mock fallback.`,
    });
    return this.mockCall(track, query, sites, maxResults);
  }

  private mockCall(
    track: 'global' | 'local' | 'rss',
    query: string,
    sites?: string[],
    maxResults?: number,
  ): Promise<NewsArticle[]> {
    if (track === 'global') return this.mock.getGlobalNews(query, maxResults);
    if (track === 'local') return this.mock.getLocalNews(query, sites, maxResults);
    return this.mock.getRSSFeed(query, maxResults);
  }
}
