import type { Contact } from '@/lib/types';

/*
 * ResearchPlan — the shared data structure for DEL's research pipeline.
 *
 * The Research Planner creates this plan by examining a spreadsheet row
 * and determining which fields are incomplete or require enrichment.
 * Downstream agents (Search, Reader, Collector) consume the plan to
 * execute research in a structured, trackable way.
 *
 * The plan is NOT a database table — it's an in-memory execution context
 * that the Research Coordinator manages. Persistence (if needed) goes
 * through the existing analysis_runs table.
 */

export type ResearchCategory =
  | 'executive_biography'
  | 'current_role'
  | 'company_profile'
  | 'company_industry'
  | 'company_size'
  | 'professional_history'
  | 'public_interviews'
  | 'speaking_engagements'
  | 'awards'
  | 'recent_news'
  | 'leadership_information';

export type ResearchPriority = 'high' | 'medium' | 'low';
export type ResearchStatus = 'planned' | 'searching' | 'reading' | 'crawling' | 'collecting' | 'completed' | 'failed';

export interface PlannedQuery {
  id: string;
  category: ResearchCategory;
  query: string;
  priority: ResearchPriority;
  /** Which search track this query belongs to */
  track: 'professional' | 'press' | 'industry';
  /** Time range filter for the search */
  timeRange?: 'day' | 'week' | 'month' | 'year';
  /** Site scope for targeted searches (e.g. linkedin.com) */
  siteScope?: string[];
}

export interface MissingField {
  field: string;
  category: ResearchCategory;
  reason: string;
  priority: ResearchPriority;
}

export interface ResearchPlan {
  planId: string;
  contactId: string;
  contactName: string;
  contactTitle: string;
  company: string;
  /** Fields that are missing or need enrichment */
  missingFields: MissingField[];
  /** All planned search categories */
  categories: ResearchCategory[];
  /** Generated search queries to execute */
  queries: PlannedQuery[];
  /** Overall priority for this research run */
  priority: ResearchPriority;
  /** Current execution status */
  status: ResearchStatus;
  /** Execution metadata */
  metadata: {
    createdAt: string;
    updatedAt: string;
    completedAt: string | null;
    queriesExecuted: number;
    sourcesFound: number;
    documentsRead: number;
  };
}

export function createResearchPlan(
  contact: Pick<Contact, 'id' | 'name' | 'title' | 'company' | 'industry' | 'linkedin' | 'persona_provided' | 'notes'>,
): ResearchPlan {
  const now = new Date().toISOString();
  return {
    planId: `plan-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    contactId: contact.id,
    contactName: contact.name,
    contactTitle: contact.title || '',
    company: contact.company,
    missingFields: [],
    categories: [],
    queries: [],
    priority: 'high',
    status: 'planned',
    metadata: {
      createdAt: now,
      updatedAt: now,
      completedAt: null,
      queriesExecuted: 0,
      sourcesFound: 0,
      documentsRead: 0,
    },
  };
}
