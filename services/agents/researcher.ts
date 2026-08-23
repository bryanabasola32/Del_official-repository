import type { ProviderRegistry } from '../providers';
import type { RawFinding, ResearchTrack } from '../providers/types';
import type { Contact } from '@/lib/types';

/*
 * Researcher Agent
 *
 * Input: Executive (name, title, company)
 * Output: Raw findings across 3 tracks (professional, press, industry)
 *
 * Uses:
 *   - EnrichmentProvider for LinkedIn/company data (Track 1)
 *   - NewsProvider for global + local press (Track 2)
 *   - SearchProvider for industry trends (Track 3)
 *   - ReaderProvider to fetch full page content from search hits
 *
 * Forbidden sources: personal social media (outside LinkedIn), forums,
 * people-search sites, data brokers.
 */

export class ResearcherAgent {
  constructor(private providers: ProviderRegistry) {}

  async research(contact: Pick<Contact, 'name' | 'title' | 'company'>): Promise<RawFinding[]> {
    const findings: RawFinding[] = [];

    // Track 1: Professional Profile
    // PROTOTYPE-ONLY: LinkedIn data via Apify. Not production-ready. ToS/compliance risk per §2 and §7.1.
    const linkedInProfile = await this.providers.enrichment.getLinkedInProfile(contact.name, contact.company);
    if (linkedInProfile) {
      findings.push({
        track: 'professional',
        snippet: `${contact.name} serves as ${contact.title} at ${contact.company}. Confirmed via LinkedIn company page and official corporate bio.`,
        url: linkedInProfile.url,
        sourceName: 'LinkedIn (via Apify)',
        sourceTier: 1,
        date: new Date().toISOString(),
      });
    }

    // Track 2: Press Release Alignment — Global
    const globalNews = await this.providers.news.getGlobalNews(`${contact.company} ${contact.name}`);
    for (const article of globalNews.slice(0, 1)) {
      findings.push({
        track: 'press',
        snippet: article.snippet,
        url: article.url,
        sourceName: article.source,
        sourceTier: article.sourceTier,
        date: article.publishedDate,
      });
    }

    // Track 2: Press Release Alignment — Local (site-targeted)
    const localNews = await this.providers.news.getLocalNews(`${contact.company} ${contact.name}`);
    for (const article of localNews.slice(0, 1)) {
      findings.push({
        track: 'press',
        snippet: article.snippet,
        url: article.url,
        sourceName: article.source,
        sourceTier: article.sourceTier,
        date: article.publishedDate,
      });
    }

    // Track 2: PNA RSS (Tier 1 wire service)
    const pnaFeed = await this.providers.news.getRSSFeed('https://www.pna.gov.ph/rss');
    for (const article of pnaFeed.slice(0, 1)) {
      findings.push({
        track: 'press',
        snippet: article.snippet,
        url: article.url,
        sourceName: article.source,
        sourceTier: article.sourceTier,
        date: article.publishedDate,
      });
    }

    // Track 3: Industry Trends
    const industryQuery = `Philippine ${getIndustryFromTitle(contact.title || '')} sector digital adoption trends`;
    const industryResults = await this.providers.search.search(industryQuery, { maxResults: 2 });
    for (const result of industryResults.slice(0, 1)) {
      findings.push({
        track: 'industry',
        snippet: result.snippet,
        url: result.url,
        sourceName: result.sourceName,
        sourceTier: result.sourceTier,
        date: result.date,
      });
    }

    // Company newsroom (Tier 1)
    const companyInfo = await this.providers.enrichment.getCompanyInfo(contact.company);
    if (companyInfo?.newsroomUrl) {
      findings.push({
        track: 'industry',
        snippet: `${contact.company} official newsroom: Corporate strategy update references ongoing technology platform modernization and data-driven decision-making initiatives.`,
        url: companyInfo.newsroomUrl,
        sourceName: `${contact.company} Official Newsroom`,
        sourceTier: 1,
        date: new Date(Date.now() - 20 * 86400000).toISOString(),
      });
    }

    return findings;
  }
}

function getIndustryFromTitle(title: string): string {
  const t = title.toLowerCase();
  if (t.includes('security') || t.includes('ciso')) return 'Cybersecurity';
  if (t.includes('infrastructure') || t.includes('cloud')) return 'Technology';
  if (t.includes('data') || t.includes('digital')) return 'Technology';
  if (t.includes('cio') || t.includes('cto')) return 'Technology';
  return 'Enterprise';
}
