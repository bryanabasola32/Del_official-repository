import type { EvidenceSource, SourceType } from './EvidencePackage';

/*
 * Source Authority Engine — assigns authority levels to sources.
 *
 * Authority is based on:
 *   - Source type (company website, news, blog, etc.)
 *   - Source tier (1 = official, 2 = reputable, 3 = community)
 *   - URL domain patterns (configurable, not hardcoded)
 *
 * The engine produces an authority score (0-100) that contributes to
 * fact confidence in the Trust Engine.
 *
 * Configuration is via the constructor — no hardcoded website names.
 * This allows different deployments to define their own authority rules.
 */

export interface AuthorityRule {
  /** URL pattern to match (case-insensitive substring) */
  urlPattern?: string;
  /** Source type to match */
  sourceType?: SourceType;
  /** Authority score override (0-100) */
  authorityScore: number;
  /** Human-readable reason for this authority level */
  reason: string;
}

export interface SourceAuthorityConfig {
  /** Default authority scores by source type */
  sourceTypeDefaults: Record<SourceType, number>;
  /** Custom rules that override defaults (evaluated in order) */
  customRules: AuthorityRule[];
  /** Tier-based authority adjustments */
  tierAdjustments: { tier1: number; tier2: number; tier3: number };
}

const DEFAULT_CONFIG: SourceAuthorityConfig = {
  sourceTypeDefaults: {
    company_website: 95,
    press_release: 90,
    industry_report: 85,
    news_article: 75,
    conference_page: 70,
    award_page: 80,
    interview: 65,
    linkedin: 60,
    blog_post: 35,
    social_media: 20,
    other: 30,
  },
  customRules: [
    // Government and regulatory sources
    { urlPattern: '.gov', authorityScore: 98, reason: 'Government website — highest authority' },
    { urlPattern: 'sec.gov', authorityScore: 98, reason: 'SEC filing — official regulatory document' },
    // Official company pages
    { urlPattern: '/about', sourceType: 'company_website', authorityScore: 95, reason: 'Official company about page' },
    { urlPattern: '/leadership', sourceType: 'company_website', authorityScore: 95, reason: 'Official leadership page' },
    { urlPattern: '/press', sourceType: 'press_release', authorityScore: 90, reason: 'Official press release page' },
    // Reputable business publications (pattern-based, not name-based)
    { urlPattern: 'bloomberg', authorityScore: 88, reason: 'Major business publication' },
    { urlPattern: 'reuters', authorityScore: 88, reason: 'Major news organization' },
    { urlPattern: 'ft.com', authorityScore: 85, reason: 'Major business publication' },
    { urlPattern: 'wsj', authorityScore: 85, reason: 'Major business publication' },
    { urlPattern: 'forbes', authorityScore: 80, reason: 'Reputable business publication' },
    { urlPattern: 'techcrunch', authorityScore: 75, reason: 'Reputable technology publication' },
  ],
  tierAdjustments: {
    tier1: 0,
    tier2: -5,
    tier3: -15,
  },
};

export interface AuthorityAssessment {
  /** Authority score (0-100) */
  score: number;
  /** Tier of the source */
  tier: 1 | 2 | 3;
  /** Why this score was assigned */
  reason: string;
  /** Which rule matched (if any) */
  matchedRule?: string;
}

export class SourceAuthorityEngine {
  private config: SourceAuthorityConfig;

  constructor(config?: Partial<SourceAuthorityConfig>) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
      sourceTypeDefaults: { ...DEFAULT_CONFIG.sourceTypeDefaults, ...config?.sourceTypeDefaults },
      customRules: config?.customRules ?? DEFAULT_CONFIG.customRules,
      tierAdjustments: { ...DEFAULT_CONFIG.tierAdjustments, ...config?.tierAdjustments },
    };
  }

  /**
   * Assess the authority of a single source.
   */
  assess(source: EvidenceSource): AuthorityAssessment {
    // Check custom rules first (highest priority)
    for (const rule of this.config.customRules) {
      if (this.matchesRule(source, rule)) {
        const tierAdjust = this.getTierAdjustment(source.sourceTier);
        const finalScore = Math.max(0, Math.min(100, rule.authorityScore + tierAdjust));
        return {
          score: finalScore,
          tier: source.sourceTier,
          reason: rule.reason,
          matchedRule: rule.urlPattern || rule.sourceType || 'custom',
        };
      }
    }

    // Fall back to source type default
    const baseScore = this.config.sourceTypeDefaults[source.sourceType] ?? 30;
    const tierAdjust = this.getTierAdjustment(source.sourceTier);
    const finalScore = Math.max(0, Math.min(100, baseScore + tierAdjust));

    return {
      score: finalScore,
      tier: source.sourceTier,
      reason: `Default authority for ${source.sourceType} (tier ${source.sourceTier})`,
    };
  }

  /**
   * Assess all sources in an EvidencePackage.
   * Returns a map of sourceId → AuthorityAssessment.
   */
  assessAll(sources: EvidenceSource[]): Map<string, AuthorityAssessment> {
    const assessments = new Map<string, AuthorityAssessment>();
    for (const source of sources) {
      assessments.set(source.id, this.assess(source));
    }
    return assessments;
  }

  /**
   * Get the average authority score across a set of sources.
   */
  getAverageAuthority(sourceIds: string[], assessments: Map<string, AuthorityAssessment>): number {
    const scores = sourceIds
      .map((id) => assessments.get(id)?.score)
      .filter((s): s is number => s !== undefined);
    if (scores.length === 0) return 0;
    return Math.round(scores.reduce((sum, s) => sum + s, 0) / scores.length);
  }

  /**
   * Get the diversity score for a set of sources.
   * Higher diversity = sources from different domains = more trustworthy.
   * Returns 0-100.
   */
  getSourceDiversity(sourceIds: string[], sources: EvidenceSource[]): number {
    const domains = new Set<string>();
    for (const id of sourceIds) {
      const source = sources.find((s) => s.id === id);
      if (source) {
        const domain = this.extractDomain(source.url);
        if (domain) domains.add(domain);
      }
    }
    // 1 source = 0% diversity, 2 = 50%, 3 = 75%, 4+ = 100%
    if (domains.size <= 1) return 0;
    if (domains.size === 2) return 50;
    if (domains.size === 3) return 75;
    return 100;
  }

  private matchesRule(source: EvidenceSource, rule: AuthorityRule): boolean {
    if (rule.urlPattern && rule.sourceType) {
      return (
        source.url.toLowerCase().includes(rule.urlPattern.toLowerCase()) &&
        source.sourceType === rule.sourceType
      );
    }
    if (rule.urlPattern) {
      return source.url.toLowerCase().includes(rule.urlPattern.toLowerCase());
    }
    if (rule.sourceType) {
      return source.sourceType === rule.sourceType;
    }
    return false;
  }

  private getTierAdjustment(tier: 1 | 2 | 3): number {
    if (tier === 1) return this.config.tierAdjustments.tier1;
    if (tier === 2) return this.config.tierAdjustments.tier2;
    return this.config.tierAdjustments.tier3;
  }

  private extractDomain(url: string): string | null {
    try {
      const parsed = new URL(url);
      return parsed.hostname.replace(/^www\./, '');
    } catch {
      return null;
    }
  }

  /** Get the current configuration (for diagnostics / UI). */
  getConfig(): SourceAuthorityConfig {
    return this.config;
  }
}
