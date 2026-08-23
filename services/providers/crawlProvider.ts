import type { CrawledPage, CrawlOptions } from './types';
import { getResearchProviderConfig } from '../models/ResearchProviderConfig';
import { getResearchHealthManager } from '../router/ResearchHealthManager';

/*
 * CrawlProvider — crawls pages from a starting URL, optionally following links.
 *
 * Implementations:
 *   - MockCrawlProvider      (returns placeholder crawled pages)
 *   - FirecrawlProvider      (production: Firecrawl API via edge function)
 *   - ApifyCrawlProvider     (future)
 *
 * Used by the Researcher agent for site-targeted press queries (e.g. crawling
 * named PH news outlets via site: scoped queries).
 */

export interface CrawlProvider {
  readonly name: string;
  readonly isMock: boolean;

  crawl(url: string, opts?: CrawlOptions): Promise<CrawledPage[]>;
  isConfigured(): boolean;
}

// ── Mock Implementation ──────────────────────────

export class MockCrawlProvider implements CrawlProvider {
  readonly name = 'mock-crawl';
  readonly isMock = true;

  isConfigured(): boolean {
    return true;
  }

  async crawl(url: string, opts?: CrawlOptions): Promise<CrawledPage[]> {
    const maxPages = opts?.maxPages ?? 3;
    const pages: CrawledPage[] = [];

    for (let i = 0; i < maxPages; i++) {
      pages.push({
        url: i === 0 ? url : `${url}/page/${i}`,
        title: `Crawled page ${i + 1}`,
        text: `Mock crawled content from page ${i + 1} of ${url}.`,
        links: i === 0 && opts?.followLinks ? [`${url}/page/1`, `${url}/page/2`] : undefined,
        crawledAt: new Date().toISOString(),
      });
    }

    return pages;
  }
}

// ── Factory ──────────────────────────────────────

export function createCrawlProvider(): CrawlProvider {
  const config = getResearchProviderConfig('firecrawl');
  const healthManager = getResearchHealthManager();

  if (config?.enabled) {
    healthManager.registerProvider('firecrawl', 'ACTIVE');
    const { FirecrawlProvider } = require('./firecrawl/FirecrawlProvider');
    return new FirecrawlProvider();
  }

  return new MockCrawlProvider();
}
