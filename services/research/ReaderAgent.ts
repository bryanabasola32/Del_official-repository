import type { ReaderProvider } from '../providers/readerProvider';
import type { PageContent } from '../providers/types';
import type { EvidencePackage, EvidenceSource } from './EvidencePackage';

/*
 * ReaderAgent — reads webpage content and extracts meaningful text.
 *
 * Upgraded to preserve full source provenance:
 *   - Source URL
 *   - Publication date
 *   - Author when available
 *   - Document title
 *
 * The ReaderAgent does NOT perform verification — it only reads and
 * extracts content. Verification belongs to the Verifier Agent (MP3 Part 2).
 *
 * The ReaderProvider abstraction is maintained — the agent wraps the provider
 * with research-specific logic (deduplication, snippet extraction, metadata
 * enrichment). Future providers (Firecrawl, Jina) can be swapped in without
 * changing this agent.
 */

export interface ReaderAgentConfig {
  maxDocuments: number;
  maxSnippetLength: number;
  /** Skip URLs that match these patterns (ads, tracking, etc.) */
  skipUrlPatterns?: string[];
}

const DEFAULT_CONFIG: ReaderAgentConfig = {
  maxDocuments: 10,
  maxSnippetLength: 500,
  skipUrlPatterns: [
    '/ads/',
    '/tracking/',
    '/redirect/',
    'doubleclick.net',
    'googleads',
    'facebook.com/tr',
    'analytics',
  ],
};

export class ReaderAgent {
  constructor(
    private readerProvider: ReaderProvider,
    private config: ReaderAgentConfig = DEFAULT_CONFIG,
  ) {}

  async read(evidence: EvidencePackage): Promise<EvidencePackage> {
    const urlsToRead = evidence.searchResults
      .slice(0, this.config.maxDocuments)
      .filter((r) => !this.shouldSkipUrl(r.url));

    const documents: PageContent[] = [];
    const updatedSources: EvidenceSource[] = [];

    for (let i = 0; i < urlsToRead.length; i++) {
      const searchResult = urlsToRead[i];
      const url = searchResult.url;

      // Find the matching source entry (if one was created by SearchAgent)
      const existingSource = evidence.sources.find((s) => s.url === url);

      try {
        const page = await this.readerProvider.read(url);

        // Clean the text — remove navigation, boilerplate markers
        const cleanedText = this.cleanText(page.text);
        const snippet = cleanedText.slice(0, this.config.maxSnippetLength);

        documents.push({
          ...page,
          text: cleanedText,
        });

        // Enrich the source with reader metadata
        if (existingSource) {
          updatedSources.push({
            ...existingSource,
            snippet,
            publishedDate: page.publishedDate || existingSource.publishedDate,
            author: page.author,
            title: page.title || existingSource.title,
          });
        } else {
          updatedSources.push({
            id: `src-${i}`,
            url: page.url,
            title: page.title,
            sourceName: searchResult.sourceName || page.url,
            sourceTier: searchResult.sourceTier || 2,
            snippet,
            publishedDate: page.publishedDate,
            retrievedAt: new Date().toISOString(),
            author: page.author,
            sourceType: this.inferSourceType(page.url),
          });
        }
      } catch {
        // Skip unreadable pages — research continues with what we have
        if (existingSource) {
          updatedSources.push(existingSource);
        }
      }
    }

    evidence.documents = documents;
    evidence.sources = updatedSources;
    evidence.metadata.documentCount = documents.length;
    evidence.metadata.agentsRun.push('ReaderAgent');
    evidence.metadata.updatedAt = new Date().toISOString();

    return evidence;
  }

  private shouldSkipUrl(url: string): boolean {
    const lowerUrl = url.toLowerCase();
    const patterns = this.config.skipUrlPatterns || [];
    return patterns.some((pattern) => lowerUrl.includes(pattern));
  }

  private cleanText(text: string): string {
    return text
      // Remove common navigation markers
      .replace(/^(Home|Menu|Navigation|Search|Skip to content|Skip to main content)\s*$/gim, '')
      // Remove cookie consent banners
      .replace(/(Cookie preferences|Accept cookies|We use cookies|Privacy Policy|Terms of Service)/gi, '')
      // Remove advertisement markers
      .replace(/(Advertisement|Sponsored|Promoted|Subscribe to|Sign up for|Newsletter)/gi, '')
      // Remove social media share buttons
      .replace(/(Share on|Share this|Follow us on|Connect with us)/gi, '')
      // Remove excessive whitespace
      .replace(/\n{3,}/g, '\n\n')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }

  private inferSourceType(url: string): EvidenceSource['sourceType'] {
    const lowerUrl = url.toLowerCase();
    if (lowerUrl.includes('linkedin.com')) return 'linkedin';
    if (lowerUrl.includes('news')) return 'news_article';
    if (lowerUrl.includes('press')) return 'press_release';
    if (lowerUrl.includes('blog')) return 'blog_post';
    if (lowerUrl.includes('interview') || lowerUrl.includes('podcast')) return 'interview';
    if (lowerUrl.includes('conference') || lowerUrl.includes('summit')) return 'conference_page';
    if (lowerUrl.includes('award')) return 'award_page';
    if (lowerUrl.includes('about') || lowerUrl.includes('company')) return 'company_website';
    return 'other';
  }
}
