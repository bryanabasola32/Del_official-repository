import type { Contact } from '@/lib/types';
import type {
  ResearchPlan,
  ResearchCategory,
  MissingField,
  PlannedQuery,
  ResearchPriority,
} from './ResearchPlan';
import { createResearchPlan } from './ResearchPlan';

/*
 * ResearchPlanner — decides what information should be researched.
 *
 * Examines the spreadsheet row (Contact) and determines which fields are
 * incomplete or require enrichment. Creates a structured Research Plan with
 * categorized search queries that downstream agents can execute.
 *
 * The planner does NOT perform searches itself — it only creates the plan.
 */

const CATEGORY_LABELS: Record<ResearchCategory, string> = {
  executive_biography: 'Executive Biography',
  current_role: 'Current Role',
  company_profile: 'Company Profile',
  company_industry: 'Company Industry',
  company_size: 'Company Size',
  professional_history: 'Professional History',
  public_interviews: 'Public Interviews',
  speaking_engagements: 'Speaking Engagements',
  awards: 'Awards',
  recent_news: 'Recent News',
  leadership_information: 'Leadership Information',
};

export class ResearchPlanner {
  /**
   * Create a research plan for a contact.
   * Examines the contact fields and determines what's missing or needs enrichment.
   */
  plan(
    contact: Pick<
      Contact,
      'id' | 'name' | 'title' | 'company' | 'industry' | 'linkedin' | 'persona_provided' | 'notes'
    >,
  ): ResearchPlan {
    const plan = createResearchPlan(contact);
    const missingFields = this.identifyMissingFields(contact);
    const categories = this.deriveCategories(missingFields);
    const queries = this.generateQueries(contact, missingFields);

    plan.missingFields = missingFields;
    plan.categories = categories;
    plan.queries = queries;
    plan.priority = this.determinePriority(missingFields);
    plan.metadata.updatedAt = new Date().toISOString();

    return plan;
  }

  private identifyMissingFields(
    contact: Pick<
      Contact,
      'id' | 'name' | 'title' | 'company' | 'industry' | 'linkedin' | 'persona_provided' | 'notes'
    >,
  ): MissingField[] {
    const missing: MissingField[] = [];

    if (!contact.title || contact.title.trim() === '') {
      missing.push({
        field: 'title',
        category: 'current_role',
        reason: 'Job title is missing',
        priority: 'high',
      });
    }

    if (!contact.industry || contact.industry.trim() === '') {
      missing.push({
        field: 'industry',
        category: 'company_industry',
        reason: 'Industry is missing',
        priority: 'high',
      });
    }

    if (!contact.linkedin || contact.linkedin.trim() === '') {
      missing.push({
        field: 'linkedin',
        category: 'executive_biography',
        reason: 'LinkedIn URL is missing — cannot verify professional background',
        priority: 'medium',
      });
    }

    if (!contact.persona_provided || contact.persona_provided.trim() === '') {
      missing.push({
        field: 'persona_provided',
        category: 'executive_biography',
        reason: 'No persona context provided — research will build from scratch',
        priority: 'high',
      });
    }

    // Always research these categories for a complete profile
    missing.push({
      field: 'professional_history',
      category: 'professional_history',
      reason: 'Career trajectory needed for persona generation',
      priority: 'medium',
    });
    missing.push({
      field: 'recent_news',
      category: 'recent_news',
      reason: 'Recent news provides current context',
      priority: 'medium',
    });
    missing.push({
      field: 'company_profile',
      category: 'company_profile',
      reason: 'Company background needed for scoring',
      priority: 'medium',
    });
    missing.push({
      field: 'speaking_engagements',
      category: 'speaking_engagements',
      reason: 'Speaking events indicate expertise areas',
      priority: 'low',
    });
    missing.push({
      field: 'awards',
      category: 'awards',
      reason: 'Awards indicate industry recognition',
      priority: 'low',
    });
    missing.push({
      field: 'public_interviews',
      category: 'public_interviews',
      reason: 'Interviews reveal opinions and priorities',
      priority: 'low',
    });

    return missing;
  }

  private deriveCategories(missingFields: MissingField[]): ResearchCategory[] {
    const seen = new Set<ResearchCategory>();
    for (const f of missingFields) {
      seen.add(f.category);
    }
    return Array.from(seen);
  }

  private generateQueries(
    contact: Pick<Contact, 'name' | 'title' | 'company' | 'industry' | 'linkedin'>,
    missingFields: MissingField[],
  ): PlannedQuery[] {
    const queries: PlannedQuery[] = [];
    const name = contact.name;
    const title = contact.title || '';
    const company = contact.company;
    const industry = contact.industry || '';
    let queryIdx = 0;

    const addQuery = (
      category: ResearchCategory,
      query: string,
      track: 'professional' | 'press' | 'industry',
      priority: ResearchPriority,
      opts?: { timeRange?: 'day' | 'week' | 'month' | 'year'; siteScope?: string[] },
    ) => {
      queries.push({
        id: `q-${queryIdx++}`,
        category,
        query,
        priority,
        track,
        timeRange: opts?.timeRange,
        siteScope: opts?.siteScope,
      });
    };

    const categoriesNeeded = new Set(missingFields.map((f) => f.category));

    if (categoriesNeeded.has('executive_biography')) {
      addQuery('executive_biography', `${name} ${title} ${company} biography`, 'professional', 'high');
      addQuery('executive_biography', `${name} ${company} LinkedIn`, 'professional', 'high', {
        siteScope: ['linkedin.com'],
      });
    }

    if (categoriesNeeded.has('current_role')) {
      addQuery('current_role', `${name} ${company} CEO OR CTO OR CFO OR CIO OR VP OR Director`, 'professional', 'high');
    }

    if (categoriesNeeded.has('company_profile')) {
      addQuery('company_profile', `${company} company about`, 'industry', 'medium');
      addQuery('company_profile', `${company} company profile overview`, 'industry', 'medium');
    }

    if (categoriesNeeded.has('company_industry')) {
      addQuery('company_industry', `${company} industry sector`, 'industry', 'high');
      if (industry) {
        addQuery('company_industry', `${company} ${industry} industry`, 'industry', 'medium');
      }
    }

    if (categoriesNeeded.has('company_size')) {
      addQuery('company_size', `${company} employees size revenue`, 'industry', 'low');
    }

    if (categoriesNeeded.has('professional_history')) {
      addQuery('professional_history', `${name} ${company} career experience background`, 'professional', 'medium');
      addQuery('professional_history', `${name} previous roles companies`, 'professional', 'low');
    }

    if (categoriesNeeded.has('public_interviews')) {
      addQuery('public_interviews', `${name} ${company} interview podcast`, 'press', 'low');
    }

    if (categoriesNeeded.has('speaking_engagements')) {
      addQuery('speaking_engagements', `${name} ${company} speaker conference talk`, 'press', 'low');
    }

    if (categoriesNeeded.has('awards')) {
      addQuery('awards', `${name} ${company} award recognition`, 'press', 'low');
    }

    if (categoriesNeeded.has('recent_news')) {
      addQuery('recent_news', `${company} ${name} news announcement`, 'press', 'medium', {
        timeRange: 'year',
      });
      addQuery('recent_news', `${company} news latest`, 'press', 'low', {
        timeRange: 'month',
      });
    }

    if (categoriesNeeded.has('leadership_information')) {
      addQuery('leadership_information', `${company} leadership team executives`, 'professional', 'medium');
    }

    return queries;
  }

  private determinePriority(missingFields: MissingField[]): ResearchPriority {
    const highCount = missingFields.filter((f) => f.priority === 'high').length;
    if (highCount >= 3) return 'high';
    if (highCount >= 1) return 'medium';
    return 'low';
  }

  /** Get human-readable label for a research category. */
  getCategoryLabel(category: ResearchCategory): string {
    return CATEGORY_LABELS[category];
  }
}
