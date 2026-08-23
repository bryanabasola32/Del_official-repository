import type { CrawlProvider } from '../crawlProvider';
import type { CrawledPage, CrawlOptions } from '../types';
import { MockCrawlProvider } from '../crawlProvider';
import { getResearchProviderConfig } from '../../models/ResearchProviderConfig';
import { getResearchHealthManager } from '../../router/ResearchHealthManager';
import { getResearchQuotaManager } from '../../router/ResearchQuotaManager';
import { callResearchEdgeFunction } from '../researchEdgeCall';
import { getExecutionLogger } from '../../logging';

/*
 * FirecrawlProvider — production web crawling via Firecrawl API.
 *
 * Production mode: calls the `firecrawl` edge function which proxies
 * the Firecrawl API, reads FIRECRAWL_API_KEY from Supabase secrets, and
 * returns normalized CrawledPage[].
 *
 * Supports recursive crawl, sitemap crawl, configurable depth, and
 * structured content extraction.
 *
 * Mock fallback: if the edge function is unreachable, the API key is
 * missing, or quota is exhausted, falls back to MockCrawlProvider.
 */

interface FirecrawlEdgeResponse {
  pages: CrawledPage[];
  mock?: boolean;
  warning?: string;
}

export class FirecrawlProvider implements CrawlProvider {
  readonly name = 'firecrawl';
  readonly isMock = false;

  private mock = new MockCrawlProvider();
  private logger = getExecutionLogger();

  isConfigured(): boolean {
    const config = getResearchProviderConfig('firecrawl');
    return !!config?.enabled;
  }

  async crawl(url: string, opts?: CrawlOptions): Promise<CrawledPage[]> {
    const config = getResearchProviderConfig('firecrawl');
    const healthManager = getResearchHealthManager();
    const quotaManager = getResearchQuotaManager();

    if (!config) return this.mock.crawl(url, opts);

    if (!healthManager.isAvailable('firecrawl')) {
      this.logger.warning('crawl', `Firecrawl unavailable (${healthManager.getState('firecrawl')}) — using mock fallback`);
      return this.mock.crawl(url, opts);
    }

    const maxPages = opts?.maxPages ?? config.maxResults;

    const result = await callResearchEdgeFunction<FirecrawlEdgeResponse>(
      config.edgeFunctionSlug,
      'firecrawl',
      {
        url,
        maxPages,
        followLinks: opts?.followLinks,
      },
      { timeoutMs: config.timeoutMs, maxRetries: config.maxRetries },
    );

    if (result.ok && result.data?.pages) {
      this.logger.logResearchExecution({
        stage: 'crawl',
        provider: 'firecrawl',
        providerCategory: 'crawl',
        latencyMs: result.latencyMs,
        retries: result.retries,
        fallback: false,
        resultCount: result.data.pages.length,
        mock: result.data.mock ?? false,
        warning: result.data.warning,
      });
      return result.data.pages;
    }

    quotaManager.handleProviderError('firecrawl', result.error || 'Unknown error', result.status);
    this.logger.logResearchExecution({
      stage: 'crawl',
      provider: 'firecrawl',
      providerCategory: 'crawl',
      latencyMs: result.latencyMs,
      retries: result.retries,
      fallback: true,
      resultCount: 0,
      mock: true,
      warning: `Firecrawl failed: ${result.error}. Using mock fallback.`,
    });
    return this.mock.crawl(url, opts);
  }
}
