import { supabase } from '../supabase';
import type { Contact, EventItem, EventScore, InviteDraft, ActivityLogEntry } from '../types';
import { fetchEventIntelligenceBatch, SCORE_THRESHOLDS, type EventIntelligence } from '../eventIntelligence';

export interface ReportKPIs {
  executivesAnalyzed: number;
  highFitMatches: number;
  approvedAttendees: number;
  invitationDrafts: number;
}

export interface ExecutiveReportRow {
  id: string;
  name: string;
  title: string | null;
  company: string;
  industry: string | null;
  persona_type: string | null;
  persona_confidence_level: string | null;
  persona_confidence_pct: number | null;
  executive_summary: string | null;
  tech_readiness_level: string | null;
  sources_verified_count: number | null;
  last_researched_date: string | null;
  persona_status: string;
}

export interface RecommendationReportRow {
  contact_id: string;
  contact_name: string;
  company: string;
  event_id: string;
  event_name: string;
  role_score: number;
  industry_score: number;
  painpoint_score: number;
  techreadiness_score: number;
  total_score: number;
  match_tier: string;
  recommendation_status: string;
  is_final_attendee: boolean;
}

export interface EventReportRow {
  event_id: string;
  event_name: string;
  date: string | null;
  status: string;
  total_analyzed: number;
  high_fit: number;
  medium_fit: number;
  low_fit: number;
  average_score: number | null;
  approved: number;
  pending_review: number;
  rejected: number;
  invitation_drafts: number;
  campaign_status: string;
}

export interface EventReportDetail {
  event: EventItem;
  intel: EventIntelligence;
  recommendations: RecommendationReportRow[];
  activity: ActivityLogEntry[];
}

export interface DashboardSummary {
  kpis: ReportKPIs;
  industriesRepresented: number;
  personaDistribution: { persona_type: string; count: number }[];
  confidenceDistribution: { level: string; count: number }[];
  totalEvents: number;
  activeEvents: number;
  averageMatchScore: number | null;
}

export async function fetchReportKPIs(): Promise<ReportKPIs> {
  const { count: executivesAnalyzed } = await supabase
    .from('contacts')
    .select('*', { count: 'exact', head: true })
    .not('persona_status', 'eq', 'pending');

  const { count: highFitMatches } = await supabase
    .from('event_scores')
    .select('*', { count: 'exact', head: true })
    .gte('total_score', SCORE_THRESHOLDS.high);

  const { count: approvedAttendees } = await supabase
    .from('event_scores')
    .select('*', { count: 'exact', head: true })
    .eq('is_final_attendee', true);

  const { count: invitationDrafts } = await supabase
    .from('invite_drafts')
    .select('*', { count: 'exact', head: true });

  return {
    executivesAnalyzed: executivesAnalyzed || 0,
    highFitMatches: highFitMatches || 0,
    approvedAttendees: approvedAttendees || 0,
    invitationDrafts: invitationDrafts || 0,
  };
}

export async function fetchExecutiveReportData(): Promise<ExecutiveReportRow[]> {
  const { data, error } = await supabase
    .from('contacts')
    .select('id, name, title, company, industry, persona_type, persona_confidence_level, persona_confidence_pct, executive_summary, tech_readiness_level, sources_verified_count, last_researched_date, persona_status')
    .not('persona_status', 'eq', 'pending')
    .order('name', { ascending: true });
  if (error) throw error;
  return (data || []) as ExecutiveReportRow[];
}

export async function fetchRecommendationReportData(): Promise<RecommendationReportRow[]> {
  const { data: scores, error } = await supabase
    .from('event_scores')
    .select('contact_id, event_id, role_score, industry_score, painpoint_score, techreadiness_score, total_score, recommendation_status, is_final_attendee')
    .order('total_score', { ascending: false });
  if (error) throw error;
  if (!scores || scores.length === 0) return [];

  const contactIds = Array.from(new Set(scores.map((s) => s.contact_id)));
  const eventIds = Array.from(new Set(scores.map((s) => s.event_id)));

  const [contactsRes, eventsRes] = await Promise.all([
    supabase.from('contacts').select('id, name, company').in('id', contactIds),
    supabase.from('events').select('id, event_name').in('id', eventIds),
  ]);

  const contactMap = new Map((contactsRes.data || []).map((c) => [c.id, c]));
  const eventMap = new Map((eventsRes.data || []).map((e) => [e.id, e]));

  return scores.map((s) => {
    const contact = contactMap.get(s.contact_id);
    const event = eventMap.get(s.event_id);
    const tier = s.total_score >= SCORE_THRESHOLDS.high ? 'High'
      : s.total_score >= SCORE_THRESHOLDS.medium ? 'Medium'
      : s.total_score > 0 ? 'Low' : 'None';
    return {
      contact_id: s.contact_id,
      contact_name: contact?.name || '',
      company: contact?.company || '',
      event_id: s.event_id,
      event_name: event?.event_name || '',
      role_score: s.role_score,
      industry_score: s.industry_score,
      painpoint_score: s.painpoint_score,
      techreadiness_score: s.techreadiness_score,
      total_score: s.total_score,
      match_tier: tier,
      recommendation_status: s.recommendation_status || 'pending',
      is_final_attendee: s.is_final_attendee,
    };
  });
}

export async function fetchEventReportData(): Promise<EventReportRow[]> {
  const { data: events, error } = await supabase
    .from('events')
    .select('*')
    .order('date', { ascending: true });
  if (error) throw error;
  if (!events || events.length === 0) return [];

  const eventsData = events as EventItem[];
  const intelMap = await fetchEventIntelligenceBatch(eventsData.map((e) => e.id));

  return eventsData.map((event) => {
    const intel = intelMap[event.id] || emptyIntel(event.id);
    const campaign = deriveCampaignStatus(event.status, intel);
    return {
      event_id: event.id,
      event_name: event.event_name,
      date: event.date,
      status: event.status,
      total_analyzed: intel.totalAnalyzed,
      high_fit: intel.highFit,
      medium_fit: intel.mediumFit,
      low_fit: intel.lowFit,
      average_score: intel.averageScore,
      approved: intel.approvedCount,
      pending_review: intel.pendingReview,
      rejected: intel.rejectedCount,
      invitation_drafts: intel.invitationCount,
      campaign_status: campaign,
    };
  });
}

export async function fetchEventReportDetail(eventId: string): Promise<EventReportDetail | null> {
  const { data: event, error: eventErr } = await supabase
    .from('events')
    .select('*')
    .eq('id', eventId)
    .maybeSingle();
  if (eventErr || !event) return null;

  const eventItem = event as EventItem;
  const intelMap = await fetchEventIntelligenceBatch([eventId]);
  const intel = intelMap[eventId] || emptyIntel(eventId);

  const { data: scores } = await supabase
    .from('event_scores')
    .select('contact_id, event_id, role_score, industry_score, painpoint_score, techreadiness_score, total_score, recommendation_status, is_final_attendee')
    .eq('event_id', eventId)
    .order('total_score', { ascending: false });

  let recommendations: RecommendationReportRow[] = [];
  if (scores && scores.length > 0) {
    const contactIds = scores.map((s) => s.contact_id);
    const { data: contacts } = await supabase
      .from('contacts')
      .select('id, name, company')
      .in('id', contactIds);
    const contactMap = new Map((contacts || []).map((c) => [c.id, c]));

    recommendations = scores.map((s) => {
      const contact = contactMap.get(s.contact_id);
      const tier = s.total_score >= SCORE_THRESHOLDS.high ? 'High'
        : s.total_score >= SCORE_THRESHOLDS.medium ? 'Medium'
        : s.total_score > 0 ? 'Low' : 'None';
      return {
        contact_id: s.contact_id,
        contact_name: contact?.name || '',
        company: contact?.company || '',
        event_id: eventId,
        event_name: eventItem.event_name,
        role_score: s.role_score,
        industry_score: s.industry_score,
        painpoint_score: s.painpoint_score,
        techreadiness_score: s.techreadiness_score,
        total_score: s.total_score,
        match_tier: tier,
        recommendation_status: s.recommendation_status || 'pending',
        is_final_attendee: s.is_final_attendee,
      };
    });
  }

  const { data: activity } = await supabase
    .from('activity_log')
    .select('*')
    .eq('related_event_id', eventId)
    .order('timestamp', { ascending: false })
    .limit(50);

  return {
    event: eventItem,
    intel,
    recommendations,
    activity: (activity || []) as ActivityLogEntry[],
  };
}

export async function fetchDashboardSummary(): Promise<DashboardSummary> {
  const [kpis, execData, eventsRes, scoresRes] = await Promise.all([
    fetchReportKPIs(),
    fetchExecutiveReportData(),
    supabase.from('events').select('id, status'),
    supabase.from('event_scores').select('total_score'),
  ]);

  const industries = new Set<string>();
  const personaMap = new Map<string, number>();
  const confidenceMap = new Map<string, number>();

  for (const e of execData) {
    if (e.industry) industries.add(e.industry);
    if (e.persona_type) personaMap.set(e.persona_type, (personaMap.get(e.persona_type) || 0) + 1);
    if (e.persona_confidence_level) confidenceMap.set(e.persona_confidence_level, (confidenceMap.get(e.persona_confidence_level) || 0) + 1);
  }

  const events = (eventsRes.data || []) as Pick<EventItem, 'id' | 'status'>[];
  const scores = (scoresRes.data || []) as Pick<EventScore, 'total_score'>[];
  const avgScore = scores.length > 0
    ? Math.round(scores.reduce((sum, s) => sum + (s.total_score || 0), 0) / scores.length)
    : null;

  return {
    kpis,
    industriesRepresented: industries.size,
    personaDistribution: Array.from(personaMap.entries()).map(([persona_type, count]) => ({ persona_type, count })).sort((a, b) => b.count - a.count),
    confidenceDistribution: Array.from(confidenceMap.entries()).map(([level, count]) => ({ level, count })).sort((a, b) => b.count - a.count),
    totalEvents: events.length,
    activeEvents: events.filter((e) => e.status === 'upcoming' || e.status === 'active').length,
    averageMatchScore: avgScore,
  };
}

export async function fetchRecentActivity(limit = 8): Promise<ActivityLogEntry[]> {
  const { data, error } = await supabase
    .from('activity_log')
    .select('*')
    .order('timestamp', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data || []) as ActivityLogEntry[];
}

export async function fetchActivityHistory(filters: {
  search?: string;
  type?: string;
  status?: string;
  dateRange?: 'today' | 'this_week' | 'this_month' | 'all';
  sendMode?: string;
  limit?: number;
}): Promise<ActivityLogEntry[]> {
  let query = supabase.from('activity_log').select('*').order('timestamp', { ascending: false });

  if (filters.type && filters.type !== 'all') {
    query = query.eq('action_type', filters.type);
  }
  if (filters.status && filters.status !== 'all') {
    query = query.eq('status', filters.status);
  }
  if (filters.sendMode && filters.sendMode !== 'all') {
    query = query.eq('send_mode', filters.sendMode);
  }
  if (filters.dateRange && filters.dateRange !== 'all') {
    const now = new Date();
    let start: Date;
    if (filters.dateRange === 'today') {
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (filters.dateRange === 'this_week') {
      start = new Date(now);
      start.setDate(now.getDate() - now.getDay());
      start.setHours(0, 0, 0, 0);
    } else {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
    }
    query = query.gte('timestamp', start.toISOString());
  }

  const limit = filters.limit || 100;
  query = query.limit(limit);

  const { data, error } = await query;
  if (error) throw error;

  let results = (data || []) as ActivityLogEntry[];
  if (filters.search) {
    const q = filters.search.toLowerCase();
    results = results.filter((a) =>
      (a.description || '').toLowerCase().includes(q) ||
      (a.action_type || '').toLowerCase().includes(q),
    );
  }

  return results;
}

function emptyIntel(eventId: string): EventIntelligence {
  return {
    eventId,
    totalAnalyzed: 0,
    highFit: 0,
    mediumFit: 0,
    lowFit: 0,
    averageScore: null,
    approvedCount: 0,
    pendingReview: 0,
    rejectedCount: 0,
    invitationCount: 0,
  };
}

function deriveCampaignStatus(eventStatus: string, intel: EventIntelligence): string {
  if (eventStatus === 'past' || eventStatus === 'archived') return 'Completed';
  if (intel.invitationCount > 0) return 'Invitations Ready';
  if (intel.approvedCount > 0) return 'Ready to Invite';
  if (intel.totalAnalyzed > 0) return 'Needs Review';
  return 'Not Started';
}
