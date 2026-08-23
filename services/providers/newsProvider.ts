import type { NewsArticle } from './types';
import { getResearchProviderConfig } from '../models/ResearchProviderConfig';
import { getResearchHealthManager } from '../router/ResearchHealthManager';

/*
 * NewsProvider — fetches news articles via global and local tracks.
 *
 * Implementations:
 *   - MockNewsProvider        (returns placeholder articles)
 *   - MarketauxNewsProvider   (production: Marketaux API via edge function)
 *   - NewsAPIProvider         (future: NewsAPI.ai)
 *   - RSSFeedProvider         (future: PNA RSS)
 *
 * The Researcher agent uses two parallel tracks:
 *   1. Global: a global news API query for the company/contact name.
 *   2. Local: site-scoped queries against named PH outlets + PNA RSS.
 */

export interface NewsProvider {
  readonly name: string;
  readonly isMock: boolean;

  /** Global news API query (e.g. NewsAPI.ai, Marketaux). */
  getGlobalNews(query: string, maxResults?: number): Promise<NewsArticle[]>;

  /** Local site-targeted queries against named PH outlets. */
  getLocalNews(query: string, sites?: string[], maxResults?: number): Promise<NewsArticle[]>;

  /** Fetch articles from an RSS feed URL (e.g. PNA). */
  getRSSFeed(feedUrl: string, maxResults?: number): Promise<NewsArticle[]>;

  isConfigured(): boolean;
}

const PH_OUTLETS = [
  'mb.com.ph',
  'bworldonline.com',
  'business.inquirer.net',
  'philstar.com',
  'businessmirror.com.ph',
];

// ── Mock Implementation ──────────────────────────

export class MockNewsProvider implements NewsProvider {
  readonly name = 'mock-news';
  readonly isMock = true;

  isConfigured(): boolean {
    return true;
  }

  async getGlobalNews(query: string, maxResults = 5): Promise<NewsArticle[]> {
    const articles: NewsArticle[] = [];
    for (let i = 0; i < Math.min(maxResults, 3); i++) {
      articles.push({
        title: `Global news article ${i + 1} about ${query}`,
        url: `https://global-news.example.com/${encodeURIComponent(query)}/${i}`,
        snippet: `Mock global news coverage about ${query}. This would be a real article snippet from a global news API.`,
        source: 'Global News API',
        sourceTier: 2,
        publishedDate: new Date(Date.now() - i * 86400000).toISOString(),
      });
    }
    return articles;
  }

  async getLocalNews(query: string, sites = PH_OUTLETS, maxResults = 5): Promise<NewsArticle[]> {
    const articles: NewsArticle[] = [];
    for (let i = 0; i < Math.min(maxResults, sites.length); i++) {
      articles.push({
        title: `Local PH news about ${query} from ${sites[i]}`,
        url: `https://${sites[i]}/${encodeURIComponent(query)}`,
        snippet: `Mock local news article about ${query} from ${sites[i]}.`,
        source: sites[i],
        sourceTier: 2,
        publishedDate: new Date(Date.now() - i * 2 * 86400000).toISOString(),
      });
    }
    return articles;
  }

  async getRSSFeed(feedUrl: string, maxResults = 5): Promise<NewsArticle[]> {
    const articles: NewsArticle[] = [];
    for (let i = 0; i < Math.min(maxResults, 3); i++) {
      articles.push({
        title: `RSS feed article ${i + 1} from ${feedUrl}`,
        url: `${feedUrl}/article/${i}`,
        snippet: `Mock RSS article from ${feedUrl}.`,
        source: 'PNA RSS',
        sourceTier: 1,
        publishedDate: new Date(Date.now() - i * 3 * 86400000).toISOString(),
      });
    }
    return articles;
  }
}

// ── Factory ──────────────────────────────────────

export function createNewsProvider(): NewsProvider {
  const config = getResearchProviderConfig('marketaux');
  const healthManager = getResearchHealthManager();

  if (config?.enabled) {
    healthManager.registerProvider('marketaux', 'ACTIVE');
    const { MarketauxNewsProvider } = require('./marketaux/MarketauxNewsProvider');
    return new MarketauxNewsProvider();
  }

  return new MockNewsProvider();
}
