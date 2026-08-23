import type { Contact, PersonaFact, Source, EventItem, IntelligenceRecommendation } from '@/lib/types';
import type { ExecutiveIntelligenceReport } from '@/services/intelligence';
import type { RelationshipIntelligenceReport } from '@/services/relationship';
import type { MasterExecutiveBrief } from '@/services/masterExecutiveBrief';

export interface IntelligenceDetailData {
  contact: Contact;
  facts: PersonaFact[];
  sources: Record<string, Source[]>;
  recommendations: (IntelligenceRecommendation & { event?: EventItem })[];
  events: EventItem[];
  execReport: ExecutiveIntelligenceReport | null;
  relReport: RelationshipIntelligenceReport | null;
  brief: MasterExecutiveBrief;
  onApprove: (recId: string) => void;
  onReject: (recId: string) => void;
  topRec: (IntelligenceRecommendation & { event?: EventItem }) | undefined;
}

export type SectionId = 'overview' | 'persona' | 'recommendation' | 'action' | 'evidence';

export type FactFilter = 'all' | 'verified' | 'probable' | 'unverified';
export type SourceFilter = 'all' | 'official' | 'professional' | 'news';
