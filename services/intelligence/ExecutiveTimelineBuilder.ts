import type { EvidenceContext, ContextFact } from '../research/EvidenceContextBuilder';
import type { TimelineEntry, TimelineEventType } from './IntelligenceTypes';
import { FactHelper } from './FactHelper';

/*
 * ExecutiveTimelineBuilder — generates a chronological timeline
 * from verified evidence.
 *
 * Each timeline entry retains citations (factIds, sourceIds) and confidence.
 * Entries are sorted by date (null dates sort last).
 *
 * Timeline event types:
 *   Career, Promotions, Awards, Speaking, News, Investments,
 *   Board Seats, Education, Publications, Company Events
 */

export class ExecutiveTimelineBuilder {
  build(context: EvidenceContext): TimelineEntry[] {
    const entries: TimelineEntry[] = [];

    entries.push(...this.extractCareer(context));
    entries.push(...this.extractAwards(context));
    entries.push(...this.extractSpeaking(context));
    entries.push(...this.extractNews(context));
    entries.push(...this.extractPublications(context));
    entries.push(...this.extractBoardSeats(context));
    entries.push(...this.extractEducation(context));
    entries.push(...this.extractCompanyEvents(context));

    return entries.sort((a, b) => {
      if (a.sortDate === null && b.sortDate === null) return 0;
      if (a.sortDate === null) return 1;
      if (b.sortDate === null) return -1;
      return b.sortDate - a.sortDate;
    });
  }

  // ── Career / Promotions ───────────────────────────

  private extractCareer(context: EvidenceContext): TimelineEntry[] {
    const entries: TimelineEntry[] = [];

    const roleFacts = [
      ...FactHelper.byCategoryContains(context, 'current_position'),
      ...FactHelper.byCategoryContains(context, 'previous_role'),
      ...FactHelper.byCategoryContains(context, 'leadership_position'),
    ];

    for (const fact of roleFacts) {
      const isPromotion = fact.predicate.toLowerCase().includes('promot') ||
        fact.predicate.toLowerCase().includes('appoint') ||
        fact.predicate.toLowerCase().includes('elevat');

      entries.push({
        type: isPromotion ? 'promotion' : 'career',
        title: `${fact.predicate}: ${fact.value}`,
        description: `${context.contact.name} — ${fact.predicate}: ${fact.value} at ${fact.subject === context.contact.name ? context.contact.company : fact.subject}`,
        date: this.extractDate(fact),
        sortDate: this.parseSortDate(this.extractDate(fact)),
        factIds: [fact.factId],
        sourceIds: fact.sourceIds,
        confidence: fact.confidence,
      });
    }

    return entries;
  }

  // ── Awards ────────────────────────────────────────

  private extractAwards(context: EvidenceContext): TimelineEntry[] {
    const entries: TimelineEntry[] = [];

    const awardFacts = FactHelper.byCategoryContains(context, 'award');
    for (const fact of awardFacts) {
      entries.push({
        type: 'award',
        title: `Award: ${fact.value}`,
        description: `${context.contact.name} received recognition: ${fact.predicate}: ${fact.value}`,
        date: this.extractDate(fact),
        sortDate: this.parseSortDate(this.extractDate(fact)),
        factIds: [fact.factId],
        sourceIds: fact.sourceIds,
        confidence: fact.confidence,
      });
    }

    const awardKeywords = FactHelper.byKeywords(context, ['award', 'honored', 'recognition', 'distinguished']);
    for (const fact of awardKeywords) {
      if (awardFacts.includes(fact)) continue;
      entries.push({
        type: 'award',
        title: `Recognition: ${fact.value}`,
        description: `${context.contact.name} — ${fact.predicate}: ${fact.value}`,
        date: this.extractDate(fact),
        sortDate: this.parseSortDate(this.extractDate(fact)),
        factIds: [fact.factId],
        sourceIds: fact.sourceIds,
        confidence: fact.confidence,
      });
    }

    return entries;
  }

  // ── Speaking ──────────────────────────────────────

  private extractSpeaking(context: EvidenceContext): TimelineEntry[] {
    const entries: TimelineEntry[] = [];

    const speakingFacts = FactHelper.byCategoryContains(context, 'speaking');
    for (const fact of speakingFacts) {
      entries.push({
        type: 'speaking',
        title: `Speaking: ${fact.value}`,
        description: `${context.contact.name} — ${fact.predicate}: ${fact.value}`,
        date: this.extractDate(fact),
        sortDate: this.parseSortDate(this.extractDate(fact)),
        factIds: [fact.factId],
        sourceIds: fact.sourceIds,
        confidence: fact.confidence,
      });
    }

    const speakingKeywords = FactHelper.byKeywords(context, ['keynote', 'speaker', 'panel', 'conference', 'summit']);
    for (const fact of speakingKeywords) {
      if (speakingFacts.includes(fact)) continue;
      entries.push({
        type: 'speaking',
        title: `Speaking: ${fact.value}`,
        description: `${context.contact.name} — ${fact.predicate}: ${fact.value}`,
        date: this.extractDate(fact),
        sortDate: this.parseSortDate(this.extractDate(fact)),
        factIds: [fact.factId],
        sourceIds: fact.sourceIds,
        confidence: fact.confidence,
      });
    }

    return entries;
  }

  // ── News ──────────────────────────────────────────

  private extractNews(context: EvidenceContext): TimelineEntry[] {
    const entries: TimelineEntry[] = [];

    const newsFacts = FactHelper.byCategoryContains(context, 'recent_news');
    for (const fact of newsFacts) {
      entries.push({
        type: 'news',
        title: `News: ${fact.value}`,
        description: `${context.contact.name} — ${fact.predicate}: ${fact.value}`,
        date: this.extractDate(fact),
        sortDate: this.parseSortDate(this.extractDate(fact)),
        factIds: [fact.factId],
        sourceIds: fact.sourceIds,
        confidence: fact.confidence,
      });
    }

    return entries;
  }

  // ── Publications ─────────────────────────────────

  private extractPublications(context: EvidenceContext): TimelineEntry[] {
    const entries: TimelineEntry[] = [];

    const pubFacts = FactHelper.byCategoryContains(context, 'publication');
    for (const fact of pubFacts) {
      entries.push({
        type: 'publication',
        title: `Publication: ${fact.value}`,
        description: `${context.contact.name} — ${fact.predicate}: ${fact.value}`,
        date: this.extractDate(fact),
        sortDate: this.parseSortDate(this.extractDate(fact)),
        factIds: [fact.factId],
        sourceIds: fact.sourceIds,
        confidence: fact.confidence,
      });
    }

    const pubKeywords = FactHelper.byKeywords(context, ['published', 'author', 'article', 'paper', 'book']);
    for (const fact of pubKeywords) {
      if (pubFacts.includes(fact)) continue;
      entries.push({
        type: 'publication',
        title: `Publication: ${fact.value}`,
        description: `${context.contact.name} — ${fact.predicate}: ${fact.value}`,
        date: this.extractDate(fact),
        sortDate: this.parseSortDate(this.extractDate(fact)),
        factIds: [fact.factId],
        sourceIds: fact.sourceIds,
        confidence: fact.confidence,
      });
    }

    return entries;
  }

  // ── Board Seats ───────────────────────────────────

  private extractBoardSeats(context: EvidenceContext): TimelineEntry[] {
    const entries: TimelineEntry[] = [];

    const boardFacts = FactHelper.byKeywords(context, ['board', 'director', 'advisor', 'trustee']);
    for (const fact of boardFacts) {
      entries.push({
        type: 'board_seat',
        title: `Board/Advisory: ${fact.value}`,
        description: `${context.contact.name} — ${fact.predicate}: ${fact.value}`,
        date: this.extractDate(fact),
        sortDate: this.parseSortDate(this.extractDate(fact)),
        factIds: [fact.factId],
        sourceIds: fact.sourceIds,
        confidence: fact.confidence,
      });
    }

    return entries;
  }

  // ── Education ─────────────────────────────────────

  private extractEducation(context: EvidenceContext): TimelineEntry[] {
    const entries: TimelineEntry[] = [];

    const eduFacts = FactHelper.byKeywords(context, ['education', 'degree', 'university', 'college', 'mba', 'school', 'graduated']);
    for (const fact of eduFacts) {
      entries.push({
        type: 'education',
        title: `Education: ${fact.value}`,
        description: `${context.contact.name} — ${fact.predicate}: ${fact.value}`,
        date: this.extractDate(fact),
        sortDate: this.parseSortDate(this.extractDate(fact)),
        factIds: [fact.factId],
        sourceIds: fact.sourceIds,
        confidence: fact.confidence,
      });
    }

    return entries;
  }

  // ── Company Events ─────────────────────────────────

  private extractCompanyEvents(context: EvidenceContext): TimelineEntry[] {
    const entries: TimelineEntry[] = [];

    const companyFacts = FactHelper.byCategoryContains(context, 'company');
    for (const fact of companyFacts) {
      const isEvent = fact.predicate.toLowerCase().includes('acquisition') ||
        fact.predicate.toLowerCase().includes('merger') ||
        fact.predicate.toLowerCase().includes('funding') ||
        fact.predicate.toLowerCase().includes('launch') ||
        fact.predicate.toLowerCase().includes('expansion') ||
        fact.predicate.toLowerCase().includes('partnership');

      if (isEvent) {
        entries.push({
          type: 'company_event',
          title: `Company Event: ${fact.value}`,
          description: `${context.contact.company} — ${fact.predicate}: ${fact.value}`,
          date: this.extractDate(fact),
          sortDate: this.parseSortDate(this.extractDate(fact)),
          factIds: [fact.factId],
          sourceIds: fact.sourceIds,
          confidence: fact.confidence,
        });
      }
    }

    return entries;
  }

  // ── Date Helpers ──────────────────────────────────

  private extractDate(fact: ContextFact): string | null {
    const dateMatch = fact.value.match(/(\d{4}-\d{2}-\d{2}|\d{4}\/\d{2}\/\d{2}|\d{4})/);
    if (dateMatch) {
      return dateMatch[1];
    }

    if (!fact.isFresh) {
      return null;
    }

    return null;
  }

  private parseSortDate(dateStr: string | null): number | null {
    if (!dateStr) return null;

    const parsed = new Date(dateStr);
    if (!isNaN(parsed.getTime())) {
      return parsed.getTime();
    }

    const yearMatch = dateStr.match(/(\d{4})/);
    if (yearMatch) {
      return new Date(parseInt(yearMatch[1], 10), 0, 1).getTime();
    }

    return null;
  }
}
