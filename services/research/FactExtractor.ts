import type { EvidencePackage, EvidenceSource } from './EvidencePackage';
import type { Fact, FactCategory, ExtractionMethod } from './Fact';
import { createFact } from './Fact';

/*
 * FactExtractor — converts collected evidence into structured factual statements.
 *
 * The Fact Extractor scans the EvidencePackage's documents and sources,
 * identifies factual claims, and creates Fact objects with full provenance.
 *
 * Each extracted fact preserves:
 *   - sourceIds: which sources support this fact
 *   - extractedFrom: which documents it was found in
 *   - extractedAt: when the extraction happened
 *   - extractionMethod: how it was extracted (heuristic, AI-assisted, mock)
 *
 * The Fact Extractor does NOT determine whether a fact is true.
 * It only extracts structured statements from collected evidence.
 * Verification belongs to the Verifier Agent.
 *
 * Extraction strategy:
 *   - Heuristic extraction: pattern-matching against known source types
 *     and categories (e.g. company_website → company name/industry,
 *     linkedin → executive name/title, news_article → recent events)
 *   - Each source's category (from the ResearchPlan) guides what facts
 *     to extract from it
 */

export class FactExtractor {
  /**
   * Extract structured facts from an EvidencePackage.
   * Returns an array of Facts with full provenance.
   */
  extract(evidence: EvidencePackage): Fact[] {
    const facts: Fact[] = [];
    let factIdx = 0;

    for (const source of evidence.sources) {
      const document = evidence.documents.find((d) => d.url === source.url);
      const extractedFrom = document ? [document.url] : [];

      const sourceFacts = this.extractFromSource(source, document, evidence, factIdx);
      facts.push(...sourceFacts);
      factIdx += sourceFacts.length;
    }

    // Also extract from structured sections of the EvidencePackage
    facts.push(...this.extractFromStructuredSections(evidence, factIdx));

    return facts;
  }

  private extractFromSource(
    source: EvidenceSource,
    document: { url: string; title: string; text: string; publishedDate?: string; author?: string } | undefined,
    evidence: EvidencePackage,
    startIdx: number,
  ): Fact[] {
    const facts: Fact[] = [];
    const text = document?.text || source.snippet;
    const contact = evidence.contact;
    let idx = startIdx;

    const makeFact = (
      category: FactCategory,
      subject: string,
      predicate: string,
      value: string,
      extractionMethod: ExtractionMethod = 'heuristic',
    ): Fact => {
      return createFact({
        factId: `fact-${idx++}`,
        category,
        subject,
        predicate,
        value,
        sourceIds: [source.id],
        extractedFrom: document ? [document.url] : [source.url],
        extractionMethod,
      });
    };

    // Extract based on source category
    switch (source.category) {
      case 'executive_biography':
      case 'current_role':
        facts.push(makeFact('current_position', contact.name, 'holds_position', contact.title || source.title, 'heuristic'));
        facts.push(makeFact('executive_name', contact.name, 'name', contact.name, 'heuristic'));
        if (source.sourceType === 'linkedin') {
          facts.push(makeFact('biography', contact.name, 'has_linkedin', source.url, 'heuristic'));
        }
        break;

      case 'company_profile':
      case 'company_industry':
      case 'company_size':
        facts.push(makeFact('company', contact.company, 'company_name', contact.company, 'heuristic'));
        if (source.snippet) {
          facts.push(makeFact('company_industry', contact.company, 'industry', this.extractIndustry(source.snippet), 'heuristic'));
        }
        if (source.sourceType === 'company_website') {
          facts.push(makeFact('company', contact.company, 'website', source.url, 'heuristic'));
        }
        break;

      case 'professional_history':
        facts.push(makeFact('previous_role', contact.name, 'career_history', source.snippet || source.title, 'heuristic'));
        break;

      case 'public_interviews':
        facts.push(makeFact('interview', contact.name, 'gave_interview', source.title, 'heuristic'));
        break;

      case 'speaking_engagements':
        facts.push(makeFact('speaking_engagement', contact.name, 'spoke_at', source.title, 'heuristic'));
        break;

      case 'awards':
        facts.push(makeFact('award', contact.name, 'received_award', source.title, 'heuristic'));
        break;

      case 'recent_news':
        facts.push(makeFact('recent_news', contact.name, 'mentioned_in', source.title, 'heuristic'));
        facts.push(makeFact('recent_news', contact.company, 'mentioned_in', source.title, 'heuristic'));
        break;

      case 'leadership_information':
        facts.push(makeFact('leadership_position', contact.name, 'leadership_role', contact.title || source.title, 'heuristic'));
        break;

      default:
        // Generic extraction — create a fact from the snippet
        if (source.snippet) {
          facts.push(makeFact('biography', contact.name, 'mentioned_in', source.title, 'heuristic'));
        }
        break;
    }

    return facts;
  }

  private extractFromStructuredSections(evidence: EvidencePackage, startIdx: number): Fact[] {
    const facts: Fact[] = [];
    let idx = startIdx;
    const contact = evidence.contact;

    const makeFact = (
      category: FactCategory,
      subject: string,
      predicate: string,
      value: string,
      sourceIds: string[],
    ): Fact => {
      return createFact({
        factId: `fact-${idx++}`,
        category,
        subject,
        predicate,
        value,
        sourceIds,
        extractedFrom: [],
        extractionMethod: 'heuristic',
      });
    };

    // Extract from professional history entries
    for (const entry of evidence.professionalHistory) {
      facts.push(makeFact('previous_role', contact.name, 'held_position', entry.title, entry.sourceIds));
    }

    // Extract from news entries
    for (const entry of evidence.news) {
      facts.push(makeFact('recent_news', contact.name, 'news_mention', entry.title, entry.sourceIds));
    }

    // Extract from interview entries
    for (const entry of evidence.interviews) {
      facts.push(makeFact('interview', contact.name, 'gave_interview', entry.title, entry.sourceIds));
    }

    // Extract from speaking events
    for (const entry of evidence.speakingEvents) {
      facts.push(makeFact('speaking_engagement', contact.name, 'spoke_at', entry.title, entry.sourceIds));
    }

    // Extract from awards
    for (const entry of evidence.awards) {
      facts.push(makeFact('award', contact.name, 'received_award', entry.title, entry.sourceIds));
    }

    // Extract from company info
    if (evidence.company.industry) {
      facts.push(makeFact('company_industry', contact.company, 'industry', evidence.company.industry, evidence.company.sourceIds));
    }
    if (evidence.company.website) {
      facts.push(makeFact('company', contact.company, 'website', evidence.company.website, evidence.company.sourceIds));
    }

    return facts;
  }

  private extractIndustry(snippet: string): string {
    // Simple heuristic — look for industry keywords in the snippet
    const industryKeywords = [
      'technology', 'finance', 'healthcare', 'manufacturing', 'retail',
      'consulting', 'education', 'real estate', 'energy', 'telecommunications',
      'media', 'transportation', 'agriculture', 'construction', 'hospitality',
    ];

    const lowerSnippet = snippet.toLowerCase();
    for (const keyword of industryKeywords) {
      if (lowerSnippet.includes(keyword)) {
        return keyword.charAt(0).toUpperCase() + keyword.slice(1);
      }
    }

    return snippet.slice(0, 100);
  }
}
