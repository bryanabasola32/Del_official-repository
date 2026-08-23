import { supabase } from './supabase';
import type { EventItem, EventScore, InviteDraft } from './types';

export type MatchTier = 'high' | 'medium' | 'low' | 'none';

export interface EventIntelligence {
  eventId: string;
  totalAnalyzed: number;
  highFit: number;
  mediumFit: number;
  lowFit: number;
  averageScore: number | null;
  approvedCount: number;
  pendingReview: number;
  rejectedCount: number;
  invitationCount: number;
}

export type CampaignStatus =
  | 'not_started'
  | 'researching'
  | 'needs_review'
  | 'ready_to_invite'
  | 'invitations_ready'
  | 'completed';

export interface CampaignInfo {
  status: CampaignStatus;
  label: string;
  description: string;
}

export const SCORE_THRESHOLDS = {
  high: 85,
  medium: 70,
} as const;

export function getMatchTier(score: number): MatchTier {
  if (score >= SCORE_THRESHOLDS.high) return 'high';
  if (score >= SCORE_THRESHOLDS.medium) return 'medium';
  if (score > 0) return 'low';
  return 'none';
}

export function getCampaignStatus(
  event: Pick<EventItem, 'status'>,
  intel: EventIntelligence,
): CampaignInfo {
  if (event.status === 'past' || event.status === 'archived') {
    return {
      status: 'completed',
      label: 'Completed',
      description: 'Event has concluded',
    };
  }

  if (intel.invitationCount > 0) {
    return {
      status: 'invitations_ready',
      label: 'Invitations Ready',
      description: `${intel.invitationCount} invitation draft${intel.invitationCount !== 1 ? 's' : ''} prepared`,
    };
  }

  if (intel.approvedCount > 0) {
    return {
      status: 'ready_to_invite',
      label: 'Ready to Invite',
      description: `${intel.approvedCount} approved attendee${intel.approvedCount !== 1 ? 's' : ''}`,
    };
  }

  if (intel.totalAnalyzed > 0 && intel.pendingReview > 0) {
    return {
      status: 'needs_review',
      label: 'Needs Review',
      description: `${intel.pendingReview} recommendation${intel.pendingReview !== 1 ? 's' : ''} awaiting review`,
    };
  }

  if (intel.totalAnalyzed > 0) {
    return {
      status: 'needs_review',
      label: 'Needs Review',
      description: `${intel.totalAnalyzed} analyzed, awaiting approvals`,
    };
  }

  return {
    status: 'not_started',
    label: 'Not Started',
    description: 'No audience analyzed yet',
  };
}

export interface KPISummary {
  activeEvents: number;
  highFitProspects: number;
  awaitingReview: number;
  invitationsReady: number;
}

export async function fetchEventIntelligenceBatch(
  eventIds: string[],
): Promise<Record<string, EventIntelligence>> {
  const result: Record<string, EventIntelligence> = {};

  if (eventIds.length === 0) return result;

  const [scoresRes, draftsRes] = await Promise.all([
    supabase
      .from('event_scores')
      .select('event_id, total_score, is_final_attendee, recommendation_status')
      .in('event_id', eventIds),
    supabase
      .from('invite_drafts')
      .select('event_id, id')
      .in('event_id', eventIds),
  ]);

  const scoresByEvent = new Map<string, EventScore[]>();
  for (const s of (scoresRes.data || []) as EventScore[]) {
    const list = scoresByEvent.get(s.event_id) || [];
    list.push(s);
    scoresByEvent.set(s.event_id, list);
  }

  const draftsByEvent = new Map<string, number>();
  for (const d of (draftsRes.data || []) as Pick<InviteDraft, 'event_id' | 'id'>[]) {
    draftsByEvent.set(d.event_id, (draftsByEvent.get(d.event_id) || 0) + 1);
  }

  for (const eventId of eventIds) {
    const scores = scoresByEvent.get(eventId) || [];
    const totalAnalyzed = scores.length;
    const highFit = scores.filter((s) => s.total_score >= SCORE_THRESHOLDS.high).length;
    const mediumFit = scores.filter(
      (s) => s.total_score >= SCORE_THRESHOLDS.medium && s.total_score < SCORE_THRESHOLDS.high,
    ).length;
    const lowFit = scores.filter((s) => s.total_score > 0 && s.total_score < SCORE_THRESHOLDS.medium).length;
    const scoreSum = scores.reduce((sum, s) => sum + (s.total_score || 0), 0);
    const averageScore = totalAnalyzed > 0 ? Math.round(scoreSum / totalAnalyzed) : null;
    const approvedCount = scores.filter((s) => s.is_final_attendee).length;
    const pendingReview = scores.filter(
      (s) => !s.is_final_attendee && s.recommendation_status !== 'rejected',
    ).length;
    const rejectedCount = scores.filter((s) => s.recommendation_status === 'rejected').length;
    const invitationCount = draftsByEvent.get(eventId) || 0;

    result[eventId] = {
      eventId,
      totalAnalyzed,
      highFit,
      mediumFit,
      lowFit,
      averageScore,
      approvedCount,
      pendingReview,
      rejectedCount,
      invitationCount,
    };
  }

  return result;
}

export async function fetchEventIntelligence(eventId: string): Promise<EventIntelligence> {
  const batch = await fetchEventIntelligenceBatch([eventId]);
  return (
    batch[eventId] || {
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
    }
  );
}

export async function fetchKPISummary(
  events: EventItem[],
  intelMap: Record<string, EventIntelligence>,
): Promise<KPISummary> {
  const activeEvents = events.filter(
    (e) => e.status === 'upcoming' || e.status === 'active',
  ).length;

  let highFitProspects = 0;
  let awaitingReview = 0;
  let invitationsReady = 0;

  for (const event of events) {
    if (event.status !== 'upcoming' && event.status !== 'active') continue;
    const intel = intelMap[event.id];
    if (!intel) continue;
    highFitProspects += intel.highFit;
    awaitingReview += intel.pendingReview;
    invitationsReady += intel.invitationCount;
  }

  return { activeEvents, highFitProspects, awaitingReview, invitationsReady };
}
