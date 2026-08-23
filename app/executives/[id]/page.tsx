'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Mail, Phone, Building2, Globe, User, FileText, Brain,
  Pencil, MoreVertical, Trash2, Loader2, Calendar, Briefcase, Factory,
  Sparkles, Target, CalendarCheck, CheckCircle2, Clock, CircleDashed,
  TrendingUp, Lightbulb, Shield, Award, ChevronRight, Link2, ExternalLink,
  RefreshCw, AlertCircle, Search, ChevronDown, Users, ShieldCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/lib/supabase';
import type { Contact, EventItem, EventScore, PersonaFact, Source, IntelligenceRecommendation, InviteDraft } from '@/lib/types';
import { EditExecutiveDialog } from '@/components/EditExecutiveDialog';
import { generateExecutiveIntelligence } from '@/services/orchestrator';
import { toast } from 'sonner';
import { ProfileSkeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { IntelligenceStatusBadge, getIntelligenceState, ScoreBadge, scoreLabel } from '@/components/ExecutiveIntelligenceBadge';

interface ProfileData {
  contact: Contact;
  personaFacts: PersonaFact[];
  sources: Source[];
  recommendations: (IntelligenceRecommendation & { event: EventItem | null })[];
  assignedEvents: (EventScore & { event: EventItem | null })[];
  inviteDrafts: InviteDraft[];
}

export default function ExecutiveProfilePage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [data, setData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [generating, setGenerating] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data: contact } = await supabase.from('contacts').select('*').eq('id', id).maybeSingle();
    if (!contact) {
      setData(null);
      setLoading(false);
      return;
    }

    const [factsResult, sourcesResult, recsResult, scoresResult, draftsResult, eventsResult] = await Promise.all([
      supabase.from('persona_facts').select('*').eq('contact_id', id).order('order_index', { ascending: true }),
      supabase.from('sources').select('*').in('persona_fact_id', (await supabase.from('persona_facts').select('id').eq('contact_id', id)).data?.map((f) => f.id) || []),
      supabase
        .from('intelligence_recommendations')
        .select('*, event:events(*)')
        .eq('contact_id', id)
        .order('suitability_score', { ascending: false }),
      supabase
        .from('event_scores')
        .select('*, event:events(*)')
        .eq('contact_id', id)
        .eq('is_final_attendee', true)
        .order('scored_at', { ascending: false }),
      supabase.from('invite_drafts').select('*').eq('contact_id', id).order('created_at', { ascending: false }),
      supabase.from('events').select('*'),
    ]);

    const factIds = (factsResult.data || []).map((f) => f.id);
    let sources: Source[] = [];
    if (factIds.length > 0) {
      const { data: srcData } = await supabase.from('sources').select('*').in('persona_fact_id', factIds);
      sources = srcData || [];
    }

    setData({
      contact,
      personaFacts: factsResult.data || [],
      sources,
      recommendations: (recsResult.data || []) as (IntelligenceRecommendation & { event: EventItem | null })[],
      assignedEvents: (scoresResult.data || []) as (EventScore & { event: EventItem | null })[],
      inviteDrafts: draftsResult.data || [],
    });
    setLoading(false);
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleGenerate = async () => {
    if (!data?.contact) return;
    setGenerating(true);
    toast.info(`Generating intelligence for ${data.contact.name}...`);
    try {
      await generateExecutiveIntelligence(data.contact.id);
      toast.success(`Intelligence generated for ${data.contact.name}`);
      fetchData();
    } catch {
      toast.error(`Failed to generate intelligence for ${data.contact.name}`);
    } finally {
      setGenerating(false);
    }
  };

  const handleDelete = async () => {
    if (!data?.contact) return;
    setDeleting(true);
    const { error } = await supabase.from('contacts').delete().eq('id', data.contact.id);
    if (error) {
      toast.error('Failed to delete executive');
    } else {
      toast.success(`${data.contact.name} deleted`);
      router.push('/executives');
    }
    setDeleting(false);
  };

  const handleAssignToEvent = async (eventId: string) => {
    if (!data?.contact) return;
    const { error } = await supabase
      .from('event_scores')
      .update({ is_final_attendee: true, recommendation_status: 'assigned' })
      .eq('contact_id', data.contact.id)
      .eq('event_id', eventId);
    if (error) {
      const { error: insertError } = await supabase
        .from('event_scores')
        .insert({ contact_id: data.contact.id, event_id: eventId, is_final_attendee: true, recommendation_status: 'assigned', total_score: 0 });
      if (insertError) {
        toast.error('Failed to assign executive to event');
        return;
      }
    }
    toast.success('Executive assigned to event');
    fetchData();
  };

  if (loading) return <ProfileSkeleton />;

  if (!data) {
    return (
      <div className="p-6 lg:p-8 max-w-3xl mx-auto">
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <User className="h-12 w-12 text-muted-foreground mb-3" />
          <h2 className="text-lg font-semibold">Executive not found</h2>
          <p className="text-sm text-muted-foreground mt-1">This executive may have been deleted.</p>
          <Link href="/executives" className="mt-4">
            <Button variant="outline">Back to Executive List</Button>
          </Link>
        </div>
      </div>
    );
  }

  const { contact, personaFacts, sources, recommendations, assignedEvents, inviteDrafts } = data;
  const intelligenceState = getIntelligenceState(contact);
  const initials = contact.name.split(' ').map((n) => n[0]).slice(0, 2).join('');

  const factsByType = (type: string) => personaFacts.filter((f) => f.field_type === type);

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-6">
        <Link href="/executives" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Executive List
        </Link>
      </div>

      {/* Header Card */}
      <Card className="p-6 mb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 text-primary text-lg font-semibold shrink-0">
              {initials}
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">{contact.name}</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                {contact.title || 'No position provided'}
                {contact.company && ` at ${contact.company}`}
              </p>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <IntelligenceStatusBadge state={intelligenceState} />
                {contact.persona_confidence_pct != null && intelligenceState === 'ready' && (
                  <Badge className="bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800">
                    Confidence: {contact.persona_confidence_pct}%
                  </Badge>
                )}
                {contact.persona_provided && contact.persona_provided.trim() && (
                  <Badge className="bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800/50 dark:text-slate-400 dark:border-slate-700">
                    Persona Provided
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setEditOpen(true)}>
                <Pencil className="h-4 w-4 mr-2" />
                Edit Executive
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleGenerate} disabled={generating}>
                {generating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Brain className="h-4 w-4 mr-2" />}
                {generating ? 'Analyzing...' : intelligenceState === 'not_started' ? 'Analyze' : 'Re-analyze'}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => router.push(`/invites?contact=${contact.id}`)}
              >
                <Mail className="h-4 w-4 mr-2" />
                Generate Invitation
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setDeleteOpen(true)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Remove Executive
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Quick stats row */}
        <div className="flex flex-wrap gap-6 mt-5 pt-5 border-t border-border">
          <QuickStat icon={Target} label="Recommendations" value={recommendations.length} />
          <QuickStat icon={CalendarCheck} label="Assigned Events" value={assignedEvents.length} />
          <QuickStat icon={FileText} label="Persona Facts" value={personaFacts.length} />
          <QuickStat icon={Shield} label="Sources Verified" value={contact.sources_verified_count ?? sources.length} />
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left column: Executive Info + Intelligence Status */}
        <div className="space-y-4">
          {/* Executive Information */}
          <Card className="p-5">
            <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
              <User className="h-4 w-4 text-primary" />
              Executive Information
            </h2>
            <div className="space-y-3">
              <InfoField icon={User} label="Full Name" value={contact.name} />
              <InfoField icon={Briefcase} label="Position" value={contact.title} />
              <InfoField icon={Building2} label="Company" value={contact.company} />
              <InfoField icon={Factory} label="Industry" value={contact.industry} />
              <InfoField icon={Mail} label="Email" value={contact.email} />
              <InfoField icon={Phone} label="Phone" value={contact.phone} />
              <InfoField icon={Globe} label="LinkedIn" value={contact.linkedin} link />
              {contact.company && (
                <InfoField icon={Link2} label="Company Website" value={contact.company ? `https://${contact.company.toLowerCase().replace(/\s+/g, '')}.com.ph` : null} link />
              )}
            </div>
          </Card>

          {/* Intelligence Status */}
          <Card className="p-5">
            <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
              <Brain className="h-4 w-4 text-primary" />
              DEL Intelligence Status
            </h2>
            <div className="space-y-3">
              <StatusLine
                label="Research"
                done={!!contact.last_researched_date}
                detail={contact.last_researched_date ? new Date(contact.last_researched_date).toLocaleDateString() : 'Not started'}
              />
              <StatusLine
                label="Executive Persona"
                done={intelligenceState === 'ready' || intelligenceState === 'assigned' || intelligenceState === 'drafted'}
                detail={
                  intelligenceState === 'ready' || intelligenceState === 'assigned' || intelligenceState === 'drafted'
                    ? 'Generated'
                    : intelligenceState === 'processing'
                    ? 'Generating...'
                    : intelligenceState === 'needs_review'
                    ? 'Awaiting review'
                    : 'Not started'
                }
              />
              <StatusLine
                label="Recommendation Analysis"
                done={recommendations.length > 0}
                detail={recommendations.length > 0 ? `${recommendations.length} recommendations` : 'Unavailable'}
              />
              {contact.last_researched_date && (
                <div className="pt-3 border-t border-border">
                  <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Last Updated</div>
                  <div className="text-sm font-medium">{new Date(contact.last_researched_date).toLocaleDateString()}</div>
                </div>
              )}
              {contact.persona_confidence_pct != null && (
                <div className="pt-3 border-t border-border">
                  <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Confidence Score</div>
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      'text-2xl font-bold',
                      contact.persona_confidence_level === 'high' ? 'text-emerald-600 dark:text-emerald-400' :
                      contact.persona_confidence_level === 'medium' ? 'text-amber-600 dark:text-amber-400' :
                      'text-rose-600 dark:text-rose-400'
                    )}>{contact.persona_confidence_pct}%</span>
                    {contact.persona_confidence_level && (
                      <Badge className={cn(
                        'ml-1',
                        contact.persona_confidence_level === 'high' ? 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800' :
                        contact.persona_confidence_level === 'medium' ? 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800' :
                        'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-400 dark:border-rose-800'
                      )}>
                        {contact.persona_confidence_level.toUpperCase()}
                      </Badge>
                    )}
                  </div>
                </div>
              )}
            </div>

            {intelligenceState !== 'ready' && intelligenceState !== 'assigned' && intelligenceState !== 'drafted' && (
              <Button
                className="w-full mt-4"
                onClick={handleGenerate}
                disabled={generating}
              >
                {generating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
                {generating ? 'Analyzing...' : intelligenceState === 'not_started' ? 'Analyze' : 'Re-analyze'}
              </Button>
            )}
            {(intelligenceState === 'ready' || intelligenceState === 'assigned' || intelligenceState === 'drafted' || intelligenceState === 'needs_review') && (
              <Button
                variant="outline"
                className="w-full mt-4"
                onClick={handleGenerate}
                disabled={generating}
              >
                {generating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                {generating ? 'Analyzing...' : 'Re-analyze'}
              </Button>
            )}
          </Card>
        </div>

        {/* Right column: Persona + Recommendations + Assigned Events */}
        <div className="lg:col-span-2 space-y-4">
          {/* Executive Persona */}
          {intelligenceState === 'ready' || intelligenceState === 'assigned' || intelligenceState === 'drafted' ? (
            <Card className="p-5">
              <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                Executive Persona
              </h2>

              {contact.executive_summary && (
                <div className="mb-4 p-4 rounded-lg bg-primary/5 border border-primary/10">
                  <div className="text-xs font-medium text-primary uppercase tracking-wider mb-2">Executive Summary</div>
                  <p className="text-sm leading-relaxed">{contact.executive_summary}</p>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <PersonaField icon={Award} label="Leadership Style" value={contact.decision_style} />
                <PersonaField icon={TrendingUp} label="Technology Readiness" value={contact.tech_readiness_level} />
                <PersonaField icon={Lightbulb} label="Persona Type" value={contact.persona_type} />
                {contact.tech_readiness_explanation && (
                  <div className="sm:col-span-2">
                    <PersonaField icon={Brain} label="Tech Readiness Explanation" value={contact.tech_readiness_explanation} />
                  </div>
                )}
              </div>

              {/* Persona Facts */}
              {personaFacts.length > 0 && (
                <div className="mt-5 pt-5 border-t border-border">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Extracted Facts</div>
                    <Badge className="bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800/50 dark:text-slate-400 dark:border-slate-700">
                      {personaFacts.length}
                    </Badge>
                  </div>
                  <div className="max-h-64 overflow-y-auto scrollbar-thin pr-1 -mr-1">
                    <div className="space-y-2">
                      {personaFacts.map((f) => <FactChip key={f.id} fact={f} />)}
                    </div>
                  </div>
                </div>
              )}

              {/* Client-provided persona */}
              {contact.persona_provided && contact.persona_provided.trim() && (
                <div className="mt-4 pt-4 border-t border-border">
                  <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Client-Provided Persona</div>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">{contact.persona_provided}</p>
                </div>
              )}
            </Card>
          ) : intelligenceState === 'processing' || intelligenceState === 'needs_review' ? (
            <Card className="p-8 text-center">
              {intelligenceState === 'processing' ? (
                <Loader2 className="h-10 w-10 text-amber-500 mx-auto mb-3 animate-spin" />
              ) : (
                <AlertCircle className="h-10 w-10 text-violet-500 mx-auto mb-3" />
              )}
              <h3 className="text-sm font-semibold">{intelligenceState === 'processing' ? 'Intelligence Processing' : 'Needs Review'}</h3>
              <p className="text-xs text-muted-foreground mt-1">
                {intelligenceState === 'processing'
                  ? 'Research and persona generation are in progress. This page will update automatically.'
                  : 'The generated persona has been flagged for human review before it can be used.'}
              </p>
            </Card>
          ) : (
            <Card className="p-8 text-center">
              <CircleDashed className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
              <h3 className="text-sm font-semibold">No Intelligence Available</h3>
              <p className="text-xs text-muted-foreground mt-1 mb-4">Research has not been started. No persona has been generated. No recommendations are available yet.</p>
              <Button onClick={handleGenerate} disabled={generating}>
                {generating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
                {generating ? 'Analyzing...' : 'Analyze'}
              </Button>
            </Card>
          )}

          {/* Recommended Events */}
          <Card className="p-5">
            <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              Recommended Events
              {recommendations.length > 0 && (
                <Badge className="ml-1 bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800">
                  {recommendations.length}
                </Badge>
              )}
            </h2>

            {recommendations.length === 0 ? (
              <div className="text-center py-8">
                <Target className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-sm font-medium">No Recommended Events</p>
                <p className="text-xs text-muted-foreground mt-1 mb-4 max-w-sm mx-auto">
                  DEL could not find a suitable event based on the current executive profile.
                </p>
                <div className="flex flex-col gap-2 items-center">
                  {intelligenceState !== 'ready' && intelligenceState !== 'assigned' && intelligenceState !== 'drafted' && (
                    <Button size="sm" onClick={handleGenerate} disabled={generating}>
                      <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                      Analyze
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => router.push('/events')}>
                    <Calendar className="h-3.5 w-3.5 mr-1.5" />
                    Create a New Event
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {recommendations.map((rec) => {
                  const scoreLabelInfo = scoreLabel(rec.suitability_score);
                  const isAssigned = assignedEvents.some((a) => a.event_id === rec.event_id);
                  return (
                    <div
                      key={rec.id}
                      className="rounded-lg border border-border p-4 hover:border-primary/30 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="min-w-0">
                          <h3 className="font-medium text-sm truncate">{rec.event?.event_name || 'Unknown Event'}</h3>
                          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                            {rec.event?.target_industries && rec.event.target_industries.length > 0 && (
                              <span className="flex items-center gap-1">
                                <Factory className="h-3 w-3" />
                                {rec.event.target_industries[0]}
                              </span>
                            )}
                            {rec.event?.date && (
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {new Date(rec.event.date).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <ScoreBadge score={rec.suitability_score} />
                          {isAssigned && (
                            <Badge className="bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-900/30 dark:text-violet-400 dark:border-violet-800">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Assigned
                            </Badge>
                          )}
                        </div>
                      </div>

                      <div className={cn('text-xs font-medium mb-2', scoreLabelInfo.cls)}>
                        {scoreLabelInfo.text}
                      </div>

                      {rec.reason && (
                        <div className="mb-3">
                          <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Reason</div>
                          <p className="text-sm text-muted-foreground leading-relaxed">{rec.reason}</p>
                        </div>
                      )}

                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => router.push(`/events/${rec.event_id}`)}
                        >
                          <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                          View Event
                        </Button>
                        {!isAssigned && (
                          <Button
                            size="sm"
                            onClick={() => handleAssignToEvent(rec.event_id)}
                          >
                            <CalendarCheck className="h-3.5 w-3.5 mr-1.5" />
                            Add to Attendee List
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Assigned Events */}
          <Card className="p-5">
            <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
              <CalendarCheck className="h-4 w-4 text-primary" />
              Assigned Events
              {assignedEvents.length > 0 && (
                <Badge className="ml-1 bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-900/30 dark:text-violet-400 dark:border-violet-800">
                  {assignedEvents.length}
                </Badge>
              )}
            </h2>

            {assignedEvents.length === 0 ? (
              <div className="text-center py-6">
                <CalendarCheck className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-sm font-medium">No Assigned Events</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                  This executive has not yet been added to any attendee list. You may assign them from the recommended events above or manually from the Event List.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {assignedEvents.map((assignment) => {
                  const hasInvite = inviteDrafts.some((d) => d.event_id === assignment.event_id);
                  const inviteSent = inviteDrafts.some((d) => d.event_id === assignment.event_id && (d.status === 'sent_test' || d.status === 'sent_live'));
                  return (
                    <div
                      key={assignment.id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-border p-3 hover:bg-muted/30 transition-colors"
                    >
                      <div className="min-w-0">
                        <h3 className="font-medium text-sm truncate">{assignment.event?.event_name || 'Unknown Event'}</h3>
                        {assignment.event?.date && (
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {new Date(assignment.event.date).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge className={cn(
                          'border',
                          assignment.recommendation_status === 'assigned'
                            ? 'bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-900/30 dark:text-violet-400 dark:border-violet-800'
                            : 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800/50 dark:text-slate-400 dark:border-slate-700'
                        )}>
                          {assignment.recommendation_status === 'assigned' ? 'Assigned' : 'Pending'}
                        </Badge>
                        <Badge className={cn(
                          'border',
                          inviteSent
                            ? 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800'
                            : hasInvite
                            ? 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800'
                            : 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800/50 dark:text-slate-400 dark:border-slate-700'
                        )}>
                          {inviteSent ? 'Invitation Sent' : hasInvite ? 'Draft Ready' : 'Invitation Pending'}
                        </Badge>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => router.push(`/events/${assignment.event_id}`)}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Research Evidence */}
          {sources.length > 0 && (
            <ResearchEvidenceCard sources={sources} />
          )}

          {/* Notes */}
          {contact.notes && contact.notes.trim() && (
            <Card className="p-5">
              <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                Notes
              </h2>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">{contact.notes}</p>
            </Card>
          )}
        </div>
      </div>

      {/* Dialogs */}
      <EditExecutiveDialog open={editOpen} onOpenChange={setEditOpen} contact={contact} onSaved={fetchData} />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Executive</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {contact.name}? This will also remove all associated intelligence and scores. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function QuickStat({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div>
        <div className="text-lg font-bold leading-none">{value}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
      </div>
    </div>
  );
}

function InfoField({ icon: Icon, label, value, link }: {
  icon?: React.ElementType;
  label: string;
  value: string | null;
  link?: boolean;
}) {
  const hasValue = value && value.trim();
  return (
    <div className="flex items-start gap-2.5">
      {Icon && <Icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />}
      <div className="min-w-0">
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</div>
        {hasValue ? (
          link && value!.startsWith('http') ? (
            <a href={value!} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline truncate block">
              {value}
            </a>
          ) : (
            <div className="text-sm text-foreground">{value}</div>
          )
        ) : (
          <div className="text-sm text-muted-foreground/50">—</div>
        )}
      </div>
    </div>
  );
}

function StatusLine({ label, done, detail }: { label: string; done: boolean; detail: string }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        {done ? (
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
        ) : (
          <Clock className="h-4 w-4 text-muted-foreground/40" />
        )}
        <span className="text-sm">{label}</span>
      </div>
      <span className={cn('text-xs', done ? 'text-muted-foreground' : 'text-muted-foreground/50')}>{detail}</span>
    </div>
  );
}

function PersonaField({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string | null }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      {value ? (
        <p className="text-sm leading-relaxed">{value}</p>
      ) : (
        <p className="text-sm text-muted-foreground/50">—</p>
      )}
    </div>
  );
}

function ResearchEvidenceCard({ sources }: { sources: Source[] }) {
  const [sourceFilter, setSourceFilter] = useState<'all' | 'official' | 'professional' | 'news'>('all');
  const [showAllSources, setShowAllSources] = useState(false);
  const [sourceSearch, setSourceSearch] = useState('');
  const [expandedSource, setExpandedSource] = useState<string | null>(null);

  const tier1Sources = useMemo(() => sources.filter((s) => s.source_tier === 1), [sources]);
  const tier2Sources = useMemo(() => sources.filter((s) => s.source_tier === 2), [sources]);
  const tier3Sources = useMemo(() => sources.filter((s) => s.source_tier === 3), [sources]);

  const filteredSources = useMemo(() => {
    let result = sources;
    if (sourceFilter === 'official') result = tier1Sources;
    else if (sourceFilter === 'professional') result = tier2Sources;
    else if (sourceFilter === 'news') result = tier3Sources;
    if (sourceSearch) {
      const q = sourceSearch.toLowerCase();
      result = result.filter((s) =>
        (s.source_name || '').toLowerCase().includes(q) ||
        (s.title || '').toLowerCase().includes(q) ||
        (s.snippet || '').toLowerCase().includes(q)
      );
    }
    return result;
  }, [sources, tier1Sources, tier2Sources, tier3Sources, sourceFilter, sourceSearch]);

  const visibleSources = showAllSources ? filteredSources : filteredSources.slice(0, 8);

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">Research Evidence</h2>
        </div>
        <Badge className="bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800/50 dark:text-slate-400 dark:border-slate-700">
          {sources.length}
        </Badge>
      </div>

      {/* Summary metrics */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <SourceMetricCard icon={ShieldCheck} count={tier1Sources.length} label="Official Sources" />
        <SourceMetricCard icon={Users} count={tier2Sources.length} label="Professional Profiles" />
        <SourceMetricCard icon={FileText} count={tier3Sources.length} label="News & Publications" />
      </div>

      {/* Filter bar */}
      <div className="flex flex-col sm:flex-row gap-2 mb-3">
        <div className="flex gap-1.5 flex-wrap">
          {(['all', 'official', 'professional', 'news'] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => setSourceFilter(filter)}
              className={cn(
                'rounded-lg px-2.5 py-1.5 text-xs font-medium capitalize transition-colors',
                sourceFilter === filter
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/70'
              )}
            >
              {filter}
            </button>
          ))}
        </div>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={sourceSearch}
            onChange={(e) => setSourceSearch(e.target.value)}
            placeholder="Search sources..."
            className="pl-9 h-8 text-xs"
          />
        </div>
      </div>

      {/* Source rows */}
      <div className="space-y-2">
        {visibleSources.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-4">No sources match this filter.</p>
        )}
        {visibleSources.map((src) => (
          <ResearchSourceRow
            key={src.id}
            source={src}
            expanded={expandedSource === src.id}
            onToggle={() => setExpandedSource(expandedSource === src.id ? null : src.id)}
          />
        ))}
      </div>

      {/* View all / show less */}
      {!showAllSources && filteredSources.length > 8 && (
        <div className="text-center mt-3">
          <Button variant="ghost" size="sm" onClick={() => setShowAllSources(true)}>
            View All Sources ({filteredSources.length})
            <ChevronRight className="h-4 w-4 ml-1.5" />
          </Button>
        </div>
      )}
      {showAllSources && filteredSources.length > 8 && (
        <div className="text-center mt-3">
          <Button variant="ghost" size="sm" onClick={() => setShowAllSources(false)}>
            Show Less
            <ChevronDown className="h-4 w-4 ml-1.5" />
          </Button>
        </div>
      )}
    </Card>
  );
}

function SourceMetricCard({ icon: Icon, count, label }: { icon: React.ElementType; count: number; label: string }) {
  return (
    <div className="rounded-lg border border-border p-3 text-center">
      <Icon className="h-4 w-4 text-muted-foreground mx-auto mb-1" />
      <div className="text-xl font-bold leading-none">{count}</div>
      <div className="text-[10px] text-muted-foreground uppercase tracking-wider mt-1">{label}</div>
    </div>
  );
}

function ResearchSourceRow({ source, expanded, onToggle }: { source: Source; expanded: boolean; onToggle: () => void }) {
  const tierLabels: Record<number, string> = { 1: 'Official', 2: 'Professional', 3: 'News' };
  const tierColors: Record<number, string> = {
    1: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    2: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    3: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  };

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 p-3 hover:bg-muted/20 transition-colors text-left"
      >
        <Badge className={cn('shrink-0 text-[10px]', tierColors[source.source_tier])}>
          {tierLabels[source.source_tier] || `Tier ${source.source_tier}`}
        </Badge>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">{source.source_name || source.title || 'Untitled'}</div>
          {source.snippet && !expanded && <div className="text-xs text-muted-foreground truncate">{source.snippet}</div>}
        </div>
        {source.url && (
          <a
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-0.5 text-xs text-primary hover:underline shrink-0"
          >
            <ExternalLink className="h-3 w-3" />
            View
          </a>
        )}
        {expanded ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
      </button>
      {expanded && (
        <div className="px-3 pb-3 space-y-2">
          {source.snippet && (
            <div>
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Relevant Intelligence</span>
              <p className="text-xs text-muted-foreground mt-0.5">{source.snippet}</p>
            </div>
          )}
          <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
            <span>Found: {new Date(source.date_found).toLocaleDateString()}</span>
            {source.url && <span className="truncate">URL: {source.url}</span>}
          </div>
        </div>
      )}
    </div>
  );
}

function FactChip({ fact }: { fact: PersonaFact }) {
  const typeHeadings: Record<string, string> = {
    pain_point: 'Pain Point',
    initiative: 'Strategic Initiative',
    tech_readiness: 'Tech Readiness',
    professional_interest: 'Professional Interest',
    decision_making_role: 'Leadership Signal',
    industry: 'Industry',
    summary: 'Summary',
  };
  const confidenceLabels: Record<string, string> = {
    verified: 'Verified',
    probable: 'Probable',
    unverified: 'Unverified',
    insufficient_data: 'Insufficient Data',
  };
  const heading = `${typeHeadings[fact.field_type] || fact.field_type} ${confidenceLabels[fact.confidence_level] || ''}`.trim().toUpperCase();
  return (
    <div className="rounded-lg border border-border p-3 bg-muted/20">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
        {heading}
      </div>
      <p className="text-sm font-medium leading-relaxed">{fact.value}</p>
      <div className="flex items-center gap-2 mt-1.5">
        <span className="text-[10px] text-muted-foreground/70">[Curated Library]</span>
        {fact.reasoning_note && (
          <span className="text-[10px] text-muted-foreground/70 truncate">{fact.reasoning_note}</span>
        )}
      </div>
    </div>
  );
}
