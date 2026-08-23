'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  ChevronLeft, Calendar, MapPin, Building2, Users, Clock, FileText,
  Sparkles, TrendingUp, CheckCircle2, XCircle, Eye, Mail, UserMinus,
  Target, Layers, Info, Brain, Loader2, Users2, Award, ClipboardList,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { supabase } from '@/lib/supabase';
import type { EventItem, EventScore, Contact } from '@/lib/types';
import { ScoreRing, PersonaConfidenceBadge } from '@/components/Badges';
import { ProfileSkeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { generateRecommendation } from '@/services/orchestrator';
import { InvitationCenter } from '@/components/InvitationCenter';
import {
  fetchEventIntelligence, getCampaignStatus, SCORE_THRESHOLDS,
  type EventIntelligence,
} from '@/lib/eventIntelligence';
import { SCORING_RUBRIC } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const RECOMMENDATION_STEPS = [
  'Researching event...',
  'Understanding audience...',
  'Matching personas...',
  'Ranking executives...',
  'Calculating suitability...',
  'Preparing recommendations...',
  'Complete',
];

export default function EventDetailPage() {
  const router = useRouter();
  const params = useParams();
  const eventId = params.id as string;

  const [event, setEvent] = useState<EventItem | null>(null);
  const [scores, setScores] = useState<(EventScore & { contact?: Contact })[]>([]);
  const [allContacts, setAllContacts] = useState<Contact[]>([]);
  const [intel, setIntel] = useState<EventIntelligence | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [genStep, setGenStep] = useState(0);
  const [removeTarget, setRemoveTarget] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [eventRes, scoresRes, contactsRes, intelData] = await Promise.all([
      supabase.from('events').select('*').eq('id', eventId).maybeSingle(),
      supabase.from('event_scores').select('*').eq('event_id', eventId).order('total_score', { ascending: false }),
      supabase.from('contacts').select('*').not('persona_status', 'eq', 'pending'),
      fetchEventIntelligence(eventId),
    ]);

    setEvent(eventRes.data as EventItem | null);
    setAllContacts(contactsRes.data || []);
    setIntel(intelData);

    if (scoresRes.data) {
      const contactIds = scoresRes.data.map((s) => s.contact_id);
      let contactsById = new Map<string, Contact>();
      if (contactIds.length > 0) {
        const { data: contactsData } = await supabase
          .from('contacts')
          .select('*')
          .in('id', contactIds);
        for (const c of (contactsData || []) as Contact[]) {
          contactsById.set(c.id, c);
        }
      }
      const scoresWithContacts = scoresRes.data.map((s) => ({
        ...s,
        contact: contactsById.get(s.contact_id),
      }));
      setScores(scoresWithContacts);
    }
    setLoading(false);
  }, [eventId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleGenerateRecommendations = async () => {
    setGenerating(true);
    setGenStep(0);

    const stepInterval = setInterval(() => {
      setGenStep((s) => Math.min(s + 1, RECOMMENDATION_STEPS.length - 1));
    }, 800);

    try {
      const contactsToIntel = allContacts.filter(
        (c) => c.persona_status === 'completed' || c.persona_status === 'low_confidence',
      );

      for (const contact of contactsToIntel) {
        const existing = scores.find((s) => s.contact_id === contact.id);
        if (!existing) {
          try {
            await generateRecommendation(contact.id, eventId);
          } catch { /* continue on individual failures */ }
        }
      }

      await fetchData();
      toast.success(`Generated recommendations for ${contactsToIntel.length} executives`);
    } catch {
      toast.error('Failed to generate recommendations');
    } finally {
      clearInterval(stepInterval);
      setGenStep(RECOMMENDATION_STEPS.length - 1);
      setTimeout(() => setGenerating(false), 600);
    }
  };

  const handleApprove = async (scoreId: string, contactId: string) => {
    const { error } = await supabase
      .from('event_scores')
      .update({ recommendation_status: 'approved', is_final_attendee: true })
      .eq('id', scoreId);
    if (error) { toast.error('Failed to approve'); return; }

    await supabase.from('activity_log').insert({
      action_type: 'approve_attendee',
      related_contact_id: contactId,
      related_event_id: eventId,
      status: 'success',
      description: `Approved attendee for ${event?.event_name}`,
    });

    toast.success('Attendee approved');
    fetchData();
  };

  const handleReject = async (scoreId: string, contactId: string) => {
    const { error } = await supabase
      .from('event_scores')
      .update({ recommendation_status: 'rejected', is_final_attendee: false })
      .eq('id', scoreId);
    if (error) { toast.error('Failed to reject'); return; }

    await supabase.from('activity_log').insert({
      action_type: 'reject_attendee',
      related_contact_id: contactId,
      related_event_id: eventId,
      status: 'success',
      description: `Rejected recommendation for ${event?.event_name}`,
    });

    toast.success('Recommendation rejected');
    fetchData();
  };

  const handleRemove = async () => {
    if (!removeTarget) return;
    const score = scores.find((s) => s.id === removeTarget);
    if (!score) return;

    const { error } = await supabase
      .from('event_scores')
      .update({ is_final_attendee: false, recommendation_status: 'pending' })
      .eq('id', removeTarget);
    if (error) { toast.error('Failed to remove attendee'); return; }

    await supabase.from('activity_log').insert({
      action_type: 'remove_attendee',
      related_contact_id: score.contact_id,
      related_event_id: eventId,
      status: 'success',
      description: `Removed ${score.contact?.name} from ${event?.event_name}`,
    });

    toast.success(`${score.contact?.name} removed from attendees`);
    setRemoveTarget(null);
    fetchData();
  };

  if (loading) return <ProfileSkeleton />;

  if (!event) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground">Event not found.</p>
        <Button onClick={() => router.push('/events')} className="mt-4">Back to Events</Button>
      </div>
    );
  }

  const recommended = scores
    .filter((s) => !s.is_final_attendee && s.recommendation_status !== 'rejected')
    .sort((a, b) => b.total_score - a.total_score);

  const rejected = scores.filter((s) => s.recommendation_status === 'rejected');
  const attendees = scores.filter((s) => s.is_final_attendee);
  const eventDate = event.date ? new Date(event.date) : null;
  const campaign = intel ? getCampaignStatus(event, intel) : null;

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto">
      <button onClick={() => router.push('/events')} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ChevronLeft className="h-4 w-4" />
        Back to Events
      </button>

      {/* Event Header */}
      <Card className="p-6 mb-6">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold mb-1">{event.event_name}</h1>
            <p className="text-sm text-muted-foreground mb-3">{event.primary_theme || event.theme}</p>
            <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
              {eventDate && (
                <span className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" /> {eventDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
              )}
              {event.time && (
                <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> {event.time}</span>
              )}
              {event.venue && (
                <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" /> {event.venue}</span>
              )}
              {event.organizer && (
                <span className="flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5" /> {event.organizer}</span>
              )}
              {event.max_capacity && (
                <span className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5" /> {event.max_capacity} max</span>
              )}
            </div>
          </div>
          <EventStatusBadge status={event.status} />
        </div>
      </Card>

      {/* DEL Intelligence Summary */}
      {intel && (
        <Card className="p-5 mb-6 border-l-4 border-l-primary">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Brain className="h-4 w-4" />
            </div>
            <h2 className="text-sm font-semibold">DEL Intelligence</h2>
            {campaign && (
              <Badge className={cn('ml-auto text-[10px]')}>
                {campaign.label}
              </Badge>
            )}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <IntelStat icon={Users2} label="Executives Analyzed" value={intel.totalAnalyzed} />
            <IntelStat icon={TrendingUp} label="High-Fit" value={intel.highFit} valueClass="text-emerald-600 dark:text-emerald-400" />
            <IntelStat icon={Award} label="Avg. Match" value={intel.averageScore !== null ? `${intel.averageScore}/100` : '—'} />
            <IntelStat icon={CheckCircle2} label="Approved" value={intel.approvedCount} valueClass="text-cyan-600 dark:text-cyan-400" />
          </div>
          {recommended.length > 0 && (
            <div className="mt-4 pt-3 border-t border-border">
              <Button size="sm" variant="outline" onClick={() => router.push(`/events/${eventId}`)}>
                <ClipboardList className="h-3.5 w-3.5 mr-1.5" />
                Review Recommended Audience
                <ChevronLeft className="h-3.5 w-3.5 ml-1.5 rotate-[-90deg]" />
              </Button>
            </div>
          )}
        </Card>
      )}

      {/* Event Information */}
      <Card className="p-5 mb-6">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <FileText className="h-4 w-4" />
          </div>
          <h2 className="text-sm font-semibold">Event Information</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {event.description && (
            <div className="md:col-span-2 lg:col-span-3 rounded-lg border border-border p-3">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                <Info className="h-3 w-3" /> Description
              </div>
              <p className="text-sm leading-relaxed">{event.description}</p>
            </div>
          )}
          <InfoTile icon={Target} label="Primary Theme" value={event.primary_theme || event.theme || '—'} />
          <InfoTile icon={Layers} label="Target Industries" value={(event.target_industries || []).join(', ') || '—'} />
          <InfoTile icon={Users} label="Target Audience" value={event.target_audience || '—'} />
          <InfoTile icon={Users} label="Capacity" value={event.max_capacity ? String(event.max_capacity) : '—'} />
          <InfoTile icon={Calendar} label="Date" value={eventDate ? eventDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) : '—'} />
          <InfoTile icon={Building2} label="Organizer" value={event.organizer || '—'} />
          {event.notes && (
            <div className="md:col-span-2 lg:col-span-3 rounded-lg border border-border p-3">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                <FileText className="h-3 w-3" /> Notes
              </div>
              <p className="text-sm">{event.notes}</p>
            </div>
          )}
        </div>
      </Card>

      {/* AI Recommendation Panel */}
      <Card className="p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold">AI Recommendation Panel</h2>
              <p className="text-xs text-muted-foreground">Del scores every executive against this event — you approve or reject each one.</p>
            </div>
          </div>
          <Button size="sm" onClick={handleGenerateRecommendations} disabled={generating}>
            {generating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Brain className="h-4 w-4 mr-2" />}
            {generating ? 'Generating...' : 'Generate Recommendations'}
          </Button>
        </div>

        {scores.length === 0 && !generating && (
          <div className="py-8">
            <EmptyState
              icon={Brain}
              title="No Audience Analyzed"
              description="DEL hasn't matched executives against this event yet. Generate recommendations to start the audience analysis."
              action={{ label: 'Generate Recommendations', onClick: handleGenerateRecommendations }}
            />
          </div>
        )}

        {scores.length > 0 && intel && intel.highFit <= 4 && intel.highFit > 0 && !generating && (
          <div className="rounded-lg border border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-900/10 p-4 mb-4">
            <div className="flex items-center gap-2 mb-1">
              <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <span className="text-sm font-medium text-amber-700 dark:text-amber-400">Limited Audience Potential</span>
            </div>
            <p className="text-xs text-amber-700/80 dark:text-amber-400/80">
              DEL analyzed {intel.totalAnalyzed} executives, but only {intel.highFit} currently meet the high-fit threshold (≥{SCORE_THRESHOLDS.high}).
            </p>
          </div>
        )}
      </Card>

      {/* Recommended Executives */}
      {recommended.length > 0 && (
        <Card className="p-5 mb-6">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <TrendingUp className="h-4 w-4" />
            </div>
            <h2 className="text-sm font-semibold">Recommended Executives ({recommended.length})</h2>
            <span className="text-xs text-muted-foreground">Sorted by suitability score</span>
          </div>
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full">
              <thead className="border-b border-border">
                <tr>
                  <th className="text-left p-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Executive</th>
                  <th className="text-left p-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">Persona</th>
                  <th className="text-left p-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Confidence</th>
                  <th className="text-left p-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Match</th>
                  <th className="text-left p-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden xl:table-cell">Reasoning</th>
                  <th className="text-left p-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                  <th className="text-right p-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {recommended.map((score) => (
                  <RecommendationRow
                    key={score.id}
                    score={score}
                    onApprove={() => handleApprove(score.id, score.contact_id)}
                    onReject={() => handleReject(score.id, score.contact_id)}
                    onViewIntel={() => router.push(`/intelligence/${score.contact_id}`)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Final Attendee List */}
      {attendees.length > 0 && (
        <Card className="p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20">
                <CheckCircle2 className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-sm font-semibold">Final Attendee List ({attendees.length})</h2>
                <p className="text-xs text-muted-foreground">Manager-approved — ready for invitations</p>
              </div>
            </div>
            {attendees.length > 0 && (
              <Button size="sm" variant="outline" onClick={() => router.push(`/invites?eventId=${eventId}`)}>
                <Mail className="h-4 w-4 mr-2" />
                Generate Invitations
              </Button>
            )}
          </div>
          <div className="space-y-2">
            {attendees.map((score) => (
              <AttendeeRow
                key={score.id}
                score={score}
                onRemove={() => setRemoveTarget(score.id)}
                onViewIntel={() => router.push(`/intelligence/${score.contact_id}`)}
                onGenerateInvite={() => router.push(`/invites?eventId=${eventId}&contactId=${score.contact_id}`)}
              />
            ))}
          </div>
        </Card>
      )}

      {/* Invitation Center */}
      <InvitationCenter event={event} attendees={attendees} />

      {/* Rejected (hidden by default, shown if any) */}
      {rejected.length > 0 && (
        <Card className="p-5 mb-6 opacity-60">
          <div className="flex items-center gap-2.5 mb-3">
            <XCircle className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Rejected ({rejected.length})</h2>
          </div>
          <div className="space-y-1">
            {rejected.map((score) => (
              <div key={score.id} className="flex items-center gap-3 text-sm py-1.5">
                <span className="font-medium">{score.contact?.name}</span>
                <span className="text-muted-foreground">· {score.contact?.company}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Processing Dialog */}
      {generating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl">
            <div className="mb-6 text-center">
              <h2 className="text-lg font-bold">Generating Recommendations</h2>
              <p className="text-sm text-muted-foreground mt-1">for {event.event_name}</p>
            </div>
            <div className="space-y-3">
              {RECOMMENDATION_STEPS.map((step, i) => {
                const isComplete = i < genStep;
                const isActive = i === genStep;
                return (
                  <div key={i} className="flex items-center gap-3">
                    <div className={cn(
                      'flex h-8 w-8 items-center justify-center rounded-full shrink-0 transition-all',
                      isComplete ? 'bg-emerald-100 dark:bg-emerald-900/30' : isActive ? 'bg-primary/10' : 'bg-muted',
                    )}>
                      {isComplete ? (
                        <svg className="h-4 w-4 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      ) : isActive ? (
                        <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <div className="h-2 w-2 rounded-full bg-muted-foreground/30" />
                      )}
                    </div>
                    <span className={cn(
                      'text-sm transition-colors',
                      isComplete ? 'text-foreground font-medium' : isActive ? 'text-foreground' : 'text-muted-foreground',
                    )}>
                      {step}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Remove confirmation */}
      <Dialog open={!!removeTarget} onOpenChange={(v) => !v && setRemoveTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Attendee</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove this attendee from the final list? You can re-approve them later.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoveTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleRemove}>Remove</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function IntelStat({ icon: Icon, label, value, valueClass }: {
  icon: React.ElementType; label: string; value: string | number; valueClass?: string;
}) {
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
        <Icon className="h-3 w-3" /> {label}
      </div>
      <div className={cn('text-lg font-bold tabular-nums', valueClass)}>{value}</div>
    </div>
  );
}

function InfoTile({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
        <Icon className="h-3 w-3" /> {label}
      </div>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}

function RecommendationRow({ score, onApprove, onReject, onViewIntel }: {
  score: EventScore & { contact?: Contact };
  onApprove: () => void;
  onReject: () => void;
  onViewIntel: () => void;
}) {
  const [showScoreBreakdown, setShowScoreBreakdown] = useState(false);
  const [showReason, setShowReason] = useState(false);
  const scoreColor = score.total_score >= 85 ? 'text-emerald-600' : score.total_score >= 70 ? 'text-blue-600' : 'text-amber-600';
  const scoreBadge = score.total_score >= 85 ? 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800'
    : score.total_score >= 70 ? 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800'
    : 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800';
  const scoreLabel = score.total_score >= 85 ? 'High Match' : score.total_score >= 70 ? 'Medium Match' : 'Low Match';
  const statusLabel = score.recommendation_status === 'approved' ? 'Approved'
    : score.recommendation_status === 'rejected' ? 'Rejected'
    : 'Needs Review';

  return (
    <tr className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
      <td className="p-2">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold shrink-0">
            {score.contact?.name?.split(' ').map((n) => n[0]).slice(0, 2).join('') || '?'}
          </div>
          <div>
            <button onClick={onViewIntel} className="text-sm font-medium hover:underline">{score.contact?.name}</button>
            <div className="text-xs text-muted-foreground">{score.contact?.company}</div>
          </div>
        </div>
      </td>
      <td className="p-2 hidden md:table-cell">
        {score.contact?.persona_type ? <span className="text-xs font-medium">{score.contact.persona_type}</span> : <span className="text-xs text-muted-foreground">—</span>}
      </td>
      <td className="p-2 hidden lg:table-cell">
        {score.contact?.persona_confidence_level ? <PersonaConfidenceBadge level={score.contact.persona_confidence_level} pct={score.contact.persona_confidence_pct} /> : <span className="text-xs text-muted-foreground">—</span>}
      </td>
      <td className="p-2">
        <div className="flex items-center gap-2">
          <ScoreRing score={score.total_score} capped={score.confidence_capped} size={36} />
          <div className="flex flex-col">
            <Badge className={cn('text-[10px]', scoreBadge)}>{scoreLabel}</Badge>
            <button
              onClick={() => setShowScoreBreakdown(!showScoreBreakdown)}
              className="text-[10px] text-primary hover:underline mt-0.5 text-left"
            >
              {showScoreBreakdown ? 'Hide' : 'Breakdown'}
            </button>
          </div>
        </div>
        {showScoreBreakdown && (
          <ScoreBreakdown score={score} />
        )}
      </td>
      <td className="p-2 hidden xl:table-cell max-w-[200px]">
        {score.reasoning ? (
          <div>
            <p className="text-xs text-muted-foreground line-clamp-2">{score.reasoning}</p>
            <button onClick={() => setShowReason(!showReason)} className="text-[10px] text-primary hover:underline mt-1">
              {showReason ? 'Hide' : 'Show'} details
            </button>
            {showReason && (
              <div className="mt-1 text-xs text-muted-foreground bg-muted/40 rounded p-2 italic whitespace-pre-line">
                {score.reasoning}
              </div>
            )}
          </div>
        ) : <span className="text-xs text-muted-foreground">—</span>}
      </td>
      <td className="p-2">
        <Badge variant="outline" className="text-[10px]">{statusLabel}</Badge>
      </td>
      <td className="p-2 text-right">
        <div className="flex items-center justify-end gap-1">
          <Button size="sm" variant="ghost" onClick={onViewIntel} title="View Intelligence">
            <Eye className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" variant="outline" onClick={onReject} title="Reject">
            <XCircle className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" onClick={onApprove} title="Approve">
            <CheckCircle2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </td>
    </tr>
  );
}

function ScoreBreakdown({ score }: { score: EventScore }) {
  const components = SCORING_RUBRIC.map((rubric) => {
    const key = rubric.key as keyof EventScore;
    const rawValue = score[key] as number;
    return {
      label: rubric.criterion,
      weight: rubric.weight,
      value: rawValue,
    };
  });

  return (
    <div className="mt-2 rounded-lg border border-border bg-muted/20 p-3 text-xs space-y-1.5">
      <div className="font-semibold text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Match Score Breakdown</div>
      {components.map((c) => (
        <div key={c.label} className="flex items-center justify-between">
          <span className="text-muted-foreground">{c.label}</span>
          <span className="font-medium tabular-nums">{c.value} / {c.weight}</span>
        </div>
      ))}
      <div className="flex items-center justify-between pt-1.5 border-t border-border">
        <span className="font-medium">Total</span>
        <span className="font-bold tabular-nums">{score.total_score} / 100</span>
      </div>
      {score.confidence_capped && (
        <div className="text-[10px] text-rose-500 pt-1">
          Score capped due to low research confidence
        </div>
      )}
    </div>
  );
}

function AttendeeRow({ score, onRemove, onViewIntel, onGenerateInvite }: {
  score: EventScore & { contact?: Contact };
  onRemove: () => void;
  onViewIntel: () => void;
  onGenerateInvite: () => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border p-3 hover:bg-muted/20 transition-colors">
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 text-xs font-semibold shrink-0 dark:bg-emerald-900/20">
        {score.contact?.name?.split(' ').map((n) => n[0]).slice(0, 2).join('') || '?'}
      </div>
      <div className="flex-1 min-w-0">
        <button onClick={onViewIntel} className="text-sm font-medium hover:underline">{score.contact?.name}</button>
        <div className="text-xs text-muted-foreground">{score.contact?.title} · {score.contact?.company}</div>
      </div>
      <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800 text-[10px]">
        <CheckCircle2 className="h-3 w-3 mr-1" /> Approved
      </Badge>
      <div className="flex items-center gap-1">
        <Button size="sm" variant="ghost" onClick={onViewIntel} title="View Intelligence">
          <Eye className="h-3.5 w-3.5" />
        </Button>
        <Button size="sm" variant="outline" onClick={onGenerateInvite} title="Generate Invitation">
          <Mail className="h-3.5 w-3.5" />
        </Button>
        <Button size="sm" variant="ghost" onClick={onRemove} title="Remove" className="text-rose-500 hover:text-rose-600">
          <UserMinus className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

function EventStatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; dot: string; cls: string }> = {
    draft: { label: 'Draft', dot: 'bg-slate-500', cls: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800/50 dark:text-slate-400 dark:border-slate-700' },
    upcoming: { label: 'Open', dot: 'bg-blue-500', cls: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800' },
    active: { label: 'Open', dot: 'bg-blue-500', cls: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800' },
    ready: { label: 'Ready for Invitations', dot: 'bg-violet-500', cls: 'bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-900/30 dark:text-violet-400 dark:border-violet-800' },
    completed: { label: 'Completed', dot: 'bg-emerald-500', cls: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800' },
    past: { label: 'Completed', dot: 'bg-emerald-500', cls: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800' },
  };
  const c = config[status] || config.upcoming;
  return (
    <Badge className={c.cls}>
      <span className={cn('h-1.5 w-1.5 rounded-full mr-1.5', c.dot)} />
      {c.label}
    </Badge>
  );
}
