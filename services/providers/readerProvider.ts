import type { PageContent } from './types';
import { getResearchProviderConfig } from '../models/ResearchProviderConfig';
import { getResearchHealthManager } from '../router/ResearchHealthManager';

/*
 * ReaderProvider — fetches and extracts readable content from a single URL.
 *
 * Implementations:
 *   - MockReaderProvider      (returns placeholder page content)
 *   - JinaReaderProvider       (production: Jina Reader API via edge function)
 *   - FirecrawlReaderProvider  (future)
 *
 * Used by the Researcher agent to fetch full page content from search hits.
 */

export interface ReaderProvider {
  readonly name: string;
  readonly isMock: boolean;

  read(url: string): Promise<PageContent>;
  isConfigured(): boolean;
}

// ── Mock Implementation ──────────────────────────

export class MockReaderProvider implements ReaderProvider {
  readonly name = 'mock-reader';
  readonly isMock = true;

  isConfigured(): boolean {
    return true;
  }

  async read(url: string): Promise<PageContent> {
    return {
      url,
      title: `Page content for ${url}`,
      text: `Mock extracted text content from ${url}. In production this would be the cleaned, readable article text with navigation and boilerplate removed.`,
      publishedDate: new Date().toISOString(),
    };
  }
}

// ── Factory ──────────────────────────────────────

export function createReaderProvider(): ReaderProvider {
  const config = getResearchProviderConfig('jina');
  const healthManager = getResearchHealthManager();

  if (config?.enabled) {
    healthManager.registerProvider('jina', 'ACTIVE');
    const { JinaReaderProvider } = require('./jina/JinaReaderProvider');
    return new JinaReaderProvider();
  }

  return new MockReaderProvider();
}
