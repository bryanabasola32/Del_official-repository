import type { LinkedInProfile, CompanyInfo } from './types';

/*
 * EnrichmentProvider — fetches professional profile and company data.
 *
 * Implementations:
 *   - MockEnrichmentProvider    (returns placeholder profiles)
 *   - ApifyEnrichmentProvider   (future: LinkedIn via Apify — PROTOTYPE ONLY, ToS risk)
 *
 * PROTOTYPE-ONLY NOTE: LinkedIn data access via Apify is for prototype purposes
 * only, with ToS/compliance risk documented per §2 and §7.1. Not production-ready.
 */

export interface EnrichmentProvider {
  readonly name: string;
  readonly isMock: boolean;

  /** Fetch a LinkedIn profile for a person at a company. */
  getLinkedInProfile(name: string, company: string): Promise<LinkedInProfile | null>;

  /** Fetch company information (industry, website, newsroom URL). */
  getCompanyInfo(company: string): Promise<CompanyInfo | null>;

  isConfigured(): boolean;
}

// ── Mock Implementation ──────────────────────────

export class MockEnrichmentProvider implements EnrichmentProvider {
  readonly name = 'mock-enrichment';
  readonly isMock = true;

  isConfigured(): boolean {
    return true;
  }

  async getLinkedInProfile(name: string, company: string): Promise<LinkedInProfile | null> {
    return {
      name,
      title: 'Senior Executive',
      company,
      bio: `${name} is a senior technology leader at ${company} with extensive experience in digital transformation and enterprise modernization.`,
      skills: ['Digital Transformation', 'Cloud Strategy', 'Enterprise Architecture', 'AI Governance'],
      experience: [
        { title: 'Current Role', company, duration: '3+ years' },
      ],
      url: `https://www.linkedin.com/in/${name.toLowerCase().replace(/\s+/g, '-')}`,
    };
  }

  async getCompanyInfo(company: string): Promise<CompanyInfo | null> {
    return {
      name: company,
      industry: 'Technology & Financial Services',
      description: `${company} is a major Philippine enterprise with active digital transformation initiatives.`,
      website: `https://${company.toLowerCase().replace(/\s+/g, '')}.com.ph`,
      newsroomUrl: `https://${company.toLowerCase().replace(/\s+/g, '')}.com.ph/newsroom`,
    };
  }
}

// ── Factory ──────────────────────────────────────

export function createEnrichmentProvider(): EnrichmentProvider {
  return new MockEnrichmentProvider();
}
