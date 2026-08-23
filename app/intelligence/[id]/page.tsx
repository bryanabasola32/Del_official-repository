'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  ChevronLeft, Brain, RefreshCw, CalendarPlus,
  Clock, Award, StickyNote, Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet';
import { supabase } from '@/lib/supabase';
import type { Contact, PersonaFact, Source, EventItem, IntelligenceRecommendation } from '@/lib/types';
import { buildMasterExecutiveBrief, type MasterExecutiveBrief } from '@/services/masterExecutiveBrief';
import type { ExecutiveIntelligenceReport } from '@/services/intelligence';
import type { RelationshipIntelligenceReport } from '@/services/relationship';
import { PersonaConfidenceBadge } from '@/components/Badges';
import { ProfileSkeleton } from '@/components/ui/skeleton';
import { ProcessingDialog } from '@/components/intelligence/ProcessingDialog';
import { generateExecutiveIntelligence } from '@/services/orchestrator';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

import { SectionNav, useActiveSection } from '@/components/intelligence/detail/SectionNav';
import { OverviewSection } from '@/components/intelligence/detail/OverviewSection';
import { PersonaSection } from '@/components/intelligence/detail/PersonaSection';
import { RecommendationSection } from '@/components/intelligence/detail/RecommendationSection';
import { ActionSection } from '@/components/intelligence/detail/ActionSection';
import { EvidenceSection } from '@/components/intelligence/detail/EvidenceSection';
import { AssistantPanel } from '@/components/intelligence/detail/AssistantPanel';
import { NotesSection } from '@/components/intelligence/detail/NotesSection';
import { ScoreExplainerDrawer, useScoreExplainer } from '@/components/intelligence/detail/ScoreExplainer';
import type { IntelligenceDetailData } from '@/components/intelligence/detail/types';
import type { SectionId } from '@/components/intelligence/detail/types';

const SECTION_IDS: SectionId[] = ['overview', 'persona', 'recommendation', 'action', 'evidence'];

export default function IntelligenceDetailPage() {
  const router = useRouter();
  const params = useParams();
  const contactId = params.id as string;

  const [contact, setContact] = useState<Contact | null>(null);
  const [facts, setFacts] = useState<PersonaFact[]>([]);
  const [sources, setSources] = useState<Record<string, Source[]>>({});
  const [recommendations, setRecommendations] = useState<(IntelligenceRecommendation & { event?: EventItem })[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [execReport, setExecReport] = useState<ExecutiveIntelligenceReport | null>(null);
  const [relReport, setRelReport] = useState<RelationshipIntelligenceReport | null>(null);
  const [brief, setBrief] = useState<MasterExecutiveBrief | null>(null);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);

  const { activeSection, scrollToSection } = useActiveSection(SECTION_IDS);
  const scoreExplainer = useScoreExplainer();

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    const [contactRes, factsRes, recsRes, eventsRes] = await Promise.all([
      supabase.from('contacts').select('*').eq('id', contactId).maybeSingle(),
      supabase.from('persona_facts').select('*').eq('contact_id', contactId).order('order_index'),
      supabase.from('intelligence_recommendations').select('*').eq('contact_id', contactId).order('suitability_score', { ascending: false }),
      supabase.from('events').select('*').in('status', ['upcoming', 'active']),
    ]);

    const contactData = contactRes.data as Contact | null;
    setContact(contactData);
    setFacts(factsRes.data || []);
    setRecommendations(recsRes.data || []);
    setEvents(eventsRes.data || []);

    if (factsRes.data) {
      const sourceMap: Record<string, Source[]> = {};
      for (const fact of factsRes.data) {
        const { data: factSources } = await supabase.from('sources').select('*').eq('persona_fact_id', fact.id);
        sourceMap[fact.id] = factSources || [];
      }
      setSources(sourceMap);
    }

    const masterBrief = await buildMasterExecutiveBrief(contactId);
    setBrief(masterBrief);
    setExecReport(masterBrief.executive);
    setRelReport(masterBrief.relationship);

    if (recsRes.data && eventsRes.data) {
      const eventMap: Record<string, EventItem> = {};
      for (const e of eventsRes.data) eventMap[e.id] = e;
      setRecommendations(recsRes.data.map((r) => ({ ...r, event: eventMap[r.event_id] })));
    }

    if (!silent) setLoading(false);
  }, [contactId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleGenerate = async () => {
    if (processing) return;
    setProcessing(true);
    try {
      await generateExecutiveIntelligence(contactId);
      await fetchData(true);
      toast.success('Intelligence generated successfully');
    } catch {
      toast.error('Failed to generate intelligence');
    } finally {
      setProcessing(false);
    }
  };

  const handleApproveRecommendation = async (recId: string) => {
    const { error } = await supabase
      .from('intelligence_recommendations')
      .update({ status: 'approved' })
      .eq('id', recId);
    if (error) {
      toast.error('Failed to approve recommendation');
    } else {
      await supabase.from('contacts').update({ recommendation_status: 'approved' }).eq('id', contactId);
      toast.success('Recommendation approved');
      fetchData();
    }
  };

  const handleRejectRecommendation = async (recId: string) => {
    const { error } = await supabase
      .from('intelligence_recommendations')
      .update({ status: 'rejected' })
      .eq('id', recId);
    if (error) {
      toast.error('Failed to reject recommendation');
    } else {
      toast.success('Recommendation rejected');
      fetchData();
    }
  };

  const handleAssignEvent = async () => {
    if (!selectedEventId) return;
    const { error } = await supabase
      .from('contacts')
      .update({ assigned_event_id: selectedEventId, recommendation_status: 'assigned', updated_at: new Date().toISOString() })
      .eq('id', contactId);
    if (error) {
      toast.error('Failed to assign event');
    } else {
      toast.success('Event assigned successfully');
      setAssignDialogOpen(false);
      setSelectedEventId('');
      fetchData();
    }
  };

  if (loading) return <ProfileSkeleton />;

  if (!contact) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground">Executive not found.</p>
        <Button onClick={() => router.push('/intelligence')} className="mt-4">Back to Executive Intelligence</Button>
      </div>
    );
  }

  const hasIntelligence = facts.length > 0 || !!contact.persona_type;
  const topRec = recommendations.find((r) => r.status !== 'rejected');
  const initials = contact.name.split(' ').map((n) => n[0]).slice(0, 2).join('');

  const detailData: IntelligenceDetailData = {
    contact,
    facts,
    sources,
    recommendations,
    events,
    execReport,
    relReport,
    brief: brief ?? ({} as MasterExecutiveBrief),
    onApprove: handleApproveRecommendation,
    onReject: handleRejectRecommendation,
    topRec,
  };

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto">
      {/* ═══ Sticky Executive Intelligence Workspace ═══ */}
      <div className="sticky top-0 z-30 -mx-6 lg:-mx-8 px-6 lg:px-8 bg-background border-b border-border">
        {/* Back navigation */}
        <button onClick={() => router.push('/intelligence')} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground pt-2 transition-colors">
          <ChevronLeft className="h-3.5 w-3.5" />
          Back to Executive Intelligence
        </button>

        {/* Executive identity + actions */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2 py-2">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary text-base font-bold shrink-0">
              {initials}
            </div>
            <div className="min-w-0">
              <h1 className="text-lg font-bold tracking-tight truncate">{contact.name}</h1>
              <p className="text-xs text-muted-foreground truncate">
                {contact.title || 'Position not specified'}
                {contact.company && ` · ${contact.company}`}
                {contact.industry && ` · ${contact.industry}`}
              </p>
              <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                {execReport?.archetypeClassification?.archetype && (
                  <Badge className="bg-primary/10 text-primary border-primary/20 gap-1 text-[10px] py-0">
                    <Award className="h-2.5 w-2.5" />
                    {execReport.archetypeClassification.archetype}
                  </Badge>
                )}
                {!execReport?.archetypeClassification?.archetype && contact.persona_type && (
                  <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px] py-0">{contact.persona_type}</Badge>
                )}
                {contact.persona_confidence_level && (
                  <PersonaConfidenceBadge level={contact.persona_confidence_level} pct={contact.persona_confidence_pct} />
                )}
                {contact.last_researched_date && (
                  <Badge variant="outline" className="gap-1 text-[10px] py-0">
                    <Clock className="h-2.5 w-2.5" />
                    Updated {new Date(contact.last_researched_date).toLocaleDateString()}
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
            <Button variant="outline" size="sm" className="h-8" onClick={() => setAssistantOpen(true)}>
              <Sparkles className="h-3.5 w-3.5 mr-1" />
              Ask DEL
            </Button>
            <Button variant="outline" size="sm" className="h-8" onClick={() => setAssignDialogOpen(true)}>
              <CalendarPlus className="h-3.5 w-3.5 mr-1" />
              {contact.assigned_event_id ? 'Change Event' : 'Assign Event'}
            </Button>
            <Button variant="outline" size="sm" className="h-8" onClick={handleGenerate} disabled={processing}>
              <RefreshCw className={cn('h-3.5 w-3.5 mr-1', processing && 'animate-spin')} />
              {processing ? 'Generating...' : 'Refresh Intelligence'}
            </Button>
            <Button variant="outline" size="sm" className="h-8" onClick={() => setNotesOpen(true)}>
              <StickyNote className="h-3.5 w-3.5 mr-1" />
              Notes
            </Button>
          </div>
        </div>

        {/* Section navigation row */}
        {hasIntelligence && (
          <SectionNav activeSection={activeSection} onNavigate={scrollToSection} />
        )}
      </div>

      {/* ═══ No Intelligence State ═══ */}
      {!hasIntelligence && (
        <Card className="p-8 text-center">
          <Brain className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-sm font-medium mb-1">No intelligence generated yet</p>
          <p className="text-xs text-muted-foreground mb-4">
            Run the intelligence pipeline to generate this executive&apos;s persona, pain points, and recommendations.
          </p>
          <Button onClick={handleGenerate} disabled={processing}>
            <Brain className="h-4 w-4 mr-2" />
            Generate Intelligence
          </Button>
        </Card>
      )}

      {/* ═══ Main Content ═══ */}
      {hasIntelligence && (
        <div className="space-y-6">
          {/* Overview */}
          <section id="overview" className="scroll-mt-48">
            <OverviewSection data={detailData} onExplainScore={scoreExplainer.show} />
          </section>

          {/* Persona */}
          <section id="persona" className="scroll-mt-48">
            <PersonaSection data={detailData} onExplainScore={scoreExplainer.show} />
          </section>

          {/* Recommendation */}
          <section id="recommendation" className="scroll-mt-48">
            <RecommendationSection data={detailData} onExplainScore={scoreExplainer.show} />
          </section>

          {/* Action Plan */}
          <section id="action" className="scroll-mt-48">
            <ActionSection data={detailData} />
          </section>

          {/* Evidence */}
          <section id="evidence" className="scroll-mt-48">
            <EvidenceSection data={detailData} />
          </section>
        </div>
      )}

      {/* Score Explainer Drawer */}
      <ScoreExplainerDrawer
        open={scoreExplainer.open}
        onOpenChange={scoreExplainer.setOpen}
        data={scoreExplainer.data}
      />

      {/* Processing dialog */}
      <ProcessingDialog
        open={processing}
        onOpenChange={setProcessing}
        contactName={contact.name}
      />

      {/* Assign event dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Event</DialogTitle>
            <DialogDescription>
              Assign an event to {contact.name}. This will update the recommendation status.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Select value={selectedEventId} onValueChange={setSelectedEventId}>
              <SelectTrigger><SelectValue placeholder="Select an event..." /></SelectTrigger>
              <SelectContent>
                {events.map((e) => (
                  <SelectItem key={e.id} value={e.id}>{e.event_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAssignEvent} disabled={!selectedEventId}>Assign Event</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DEL Assistant Drawer */}
      <Sheet open={assistantOpen} onOpenChange={setAssistantOpen}>
        <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col p-4">
          <SheetHeader className="mb-3">
            <SheetTitle className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Sparkles className="h-4 w-4" />
              </div>
              DEL Assistant
            </SheetTitle>
            <SheetDescription>Ask questions about {contact.name}</SheetDescription>
          </SheetHeader>
          <div className="flex-1 min-h-0">
            <AssistantPanel
              contact={contact}
              contactId={contactId}
              brief={brief}
              sources={sources}
              autoFocusInput
            />
          </div>
        </SheetContent>
      </Sheet>

      {/* Notes Drawer */}
      <Sheet open={notesOpen} onOpenChange={setNotesOpen}>
        <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col p-4">
          <SheetHeader className="mb-3">
            <SheetTitle className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500">
                <StickyNote className="h-4 w-4" />
              </div>
              Notes
            </SheetTitle>
            <SheetDescription>Notes about {contact.name}</SheetDescription>
          </SheetHeader>
          <div className="flex-1 min-h-0">
            <NotesSection contact={contact} contactId={contactId} onSaved={() => fetchData(true)} />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
