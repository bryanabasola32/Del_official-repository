export type ConfidenceLevel = 'verified' | 'probable' | 'unverified' | 'insufficient_data';
export type PersonaStatus = 'pending' | 'searching' | 'retrieved' | 'synthesizing' | 'completed' | 'needs_review' | 'low_confidence';
export type PersonaConfidence = 'high' | 'medium' | 'low' | null;
export type ImportStatus = 'imported' | 'duplicate' | 'missing_company' | 'manual';
export type DecisionRole = 'budget-holder' | 'influencer' | 'unknown';
export type EventType = 'upcoming' | 'active' | 'past' | 'archived';
export type DeliveryChannel = 'email' | 'copy_only' | 'sms' | 'teams';
export type DraftStatus = 'draft' | 'sent_test' | 'sent_live' | 'skipped';
export type SendMode = 'test' | 'live';

export type FieldType = 'pain_point' | 'initiative' | 'tech_readiness' | 'professional_interest' | 'decision_making_role' | 'industry' | 'summary';

export type RecommendationStatus = 'pending' | 'approved' | 'rejected' | 'assigned';

export interface Contact {
  id: string;
  name: string;
  title: string | null;
  company: string;
  industry: string | null;
  email: string | null;
  phone: string | null;
  linkedin: string | null;
  persona_provided: string | null;
  notes: string | null;
  decision_making_role: DecisionRole;
  import_status: ImportStatus;
  persona_status: PersonaStatus;
  persona_confidence_level: PersonaConfidence;
  persona_confidence_pct: number | null;
  last_researched_date: string | null;
  // AI-generated intelligence fields
  persona_type: string | null;
  decision_style: string | null;
  executive_summary: string | null;
  tech_readiness_level: string | null;
  tech_readiness_explanation: string | null;
  sources_verified_count: number | null;
  intelligence_notes: string | null;
  recommendation_status: RecommendationStatus | null;
  assigned_event_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface PersonaFact {
  id: string;
  contact_id: string;
  field_type: FieldType;
  value: string;
  confidence_level: ConfidenceLevel;
  reasoning_note: string | null;
  timeframe: string | null;
  order_index: number;
  created_at: string;
}

export interface Source {
  id: string;
  persona_fact_id: string;
  url: string | null;
  title: string | null;
  source_tier: 1 | 2 | 3;
  source_name: string | null;
  date_found: string;
  snippet: string | null;
}

export interface EventItem {
  id: string;
  event_name: string;
  theme: string | null;
  date: string | null;
  time: string | null;
  venue: string | null;
  organizer: string | null;
  description: string | null;
  target_industries: string[] | null;
  target_audience: string | null;
  primary_theme: string | null;
  max_capacity: number | null;
  notes: string | null;
  status: EventType;
  created_at: string;
  updated_at: string;
  target_companies: string[] | null;
}

export interface EventScore {
  id: string;
  contact_id: string;
  event_id: string;
  role_score: number;
  industry_score: number;
  painpoint_score: number;
  techreadiness_score: number;
  total_score: number;
  confidence_capped: boolean;
  reasoning: string | null;
  is_final_attendee: boolean;
  recommendation_status: RecommendationStatus | null;
  scored_at: string;
}

export interface IntelligenceRecommendation {
  id: string;
  contact_id: string;
  event_id: string;
  reason: string;
  priority: 'high' | 'medium' | 'low';
  suitability_score: number;
  status: RecommendationStatus;
  created_at: string;
}

export interface InviteDraft {
  id: string;
  contact_id: string;
  event_id: string;
  subject: string | null;
  draft_text: string;
  cited_fact_ids: string[] | null;
  delivery_channel: DeliveryChannel;
  status: DraftStatus;
  created_at: string;
  updated_at: string;
}

export interface ActivityLogEntry {
  id: string;
  action_type: string;
  related_contact_id: string | null;
  related_event_id: string | null;
  related_invite_id: string | null;
  status: string | null;
  send_mode: SendMode | null;
  resend_delivery_id: string | null;
  metadata: Record<string, unknown> | null;
  description: string | null;
  timestamp: string;
}

export interface AnalysisRun {
  id: string;
  contact_id: string | null;
  run_type: string;
  status: string;
  llm_provider: string | null;
  search_provider: string | null;
  prompt_version: string | null;
  token_usage: number | null;
  estimated_cost_usd: number | null;
  processing_time_ms: number | null;
  cache_hit: boolean;
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
}

export interface NotificationItem {
  id: string;
  type: 'freshness' | 'intelligence_complete' | 'invite_sent' | 'score_ready';
  title: string;
  message: string;
  contactId?: string;
  eventId?: string;
  severity: 'info' | 'warning' | 'success';
  timestamp: string;
}
