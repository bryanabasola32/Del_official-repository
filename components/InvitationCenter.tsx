'use client';

import { useState, useEffect, useCallback } from 'react';
import { Mail, FileText, Eye, Loader2, Sparkles, RefreshCw, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { InvitationStatusBadge } from '@/components/InvitationStatusBadge';
import { InvitationEditor } from '@/components/InvitationEditor';
import {
  createEmptyInvitation, GENERATION_STEPS,
  type InvitationRecord,
} from '@/lib/invitation';
import { generateInvitation } from '@/services/orchestrator';
import { supabase } from '@/lib/supabase';
import type { Contact, EventItem, EventScore, InviteDraft } from '@/lib/types';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface InvitationCenterProps {
  event: EventItem;
  attendees: (EventScore & { contact?: Contact })[];
}

type DraftStatus = 'loading' | 'ready' | 'error' | 'empty';

export function InvitationCenter({ event, attendees }: InvitationCenterProps) {
  const [drafts, setDrafts] = useState<Record<string, InviteDraft>>({});
  const [draftStatus, setDraftStatus] = useState<DraftStatus>('loading');
  const [editorOpen, setEditorOpen] = useState(false);
  const [activeContactId, setActiveContactId] = useState<string | null>(null);
  const [batchGenerating, setBatchGenerating] = useState(false);
  const [batchStep, setBatchStep] = useState(0);
  const [batchTarget, setBatchTarget] = useState<string | null>(null);
  const [generatingContact, setGeneratingContact] = useState<string | null>(null);

  const fetchDrafts = useCallback(async () => {
    if (attendees.length === 0) {
      setDrafts({});
      setDraftStatus('empty');
      return;
    }
    setDraftStatus('loading');
    const contactIds = attendees.map((a) => a.contact_id);
    const { data, error } = await supabase
      .from('invite_drafts')
      .select('*')
      .eq('event_id', event.id)
      .in('contact_id', contactIds);

    if (error) {
      setDraftStatus('error');
      return;
    }

    const map: Record<string, InviteDraft> = {};
    for (const d of (data || []) as InviteDraft[]) {
      map[d.contact_id] = d;
    }
    setDrafts(map);
    setDraftStatus('ready');
  }, [event.id, attendees]);

  useEffect(() => { fetchDrafts(); }, [fetchDrafts]);

  const handleGenerate = async (contactId: string) => {
    setGeneratingContact(contactId);
    try {
      await generateInvitation(contactId, event.id);
      await fetchDrafts();
      toast.success('Invitation draft generated and saved');
    } catch {
      toast.error('Failed to generate invitation');
    } finally {
      setGeneratingContact(null);
    }
  };

  const handleBatchGenerate = async () => {
    setBatchGenerating(true);
    setBatchStep(0);
    const pendingContacts = attendees.filter((a) => {
      const draft = drafts[a.contact_id];
      return !draft && a.contact;
    });

    for (let i = 0; i < pendingContacts.length; i++) {
      const a = pendingContacts[i];
      setBatchTarget(a.contact_id);
      setBatchStep(0);
      const interval = setInterval(() => {
        setBatchStep((s) => Math.min(s + 1, GENERATION_STEPS.length - 1));
      }, 500);

      try {
        await generateInvitation(a.contact_id, event.id);
      } catch {
        // continue on individual failures
      }

      clearInterval(interval);
    }

    setBatchGenerating(false);
    setBatchTarget(null);
    await fetchDrafts();
    toast.success(`${pendingContacts.length} invitation drafts generated and saved`);
  };

  const handleOpenEditor = (contactId: string) => {
    setActiveContactId(contactId);
    setEditorOpen(true);
  };

  const handleSave = (record: InvitationRecord) => {
    setEditorOpen(false);
    fetchDrafts();
  };

  const handleSend = (record: InvitationRecord) => {
    setEditorOpen(false);
    fetchDrafts();
    toast.success(`Invitation sent to ${record.executiveName}`);
  };

  const handleCopy = (_record: InvitationRecord) => {
    // copy is handled within the editor
  };

  const activeContact = attendees.find((a) => a.contact_id === activeContactId)?.contact || null;
  const activeDraft = activeContactId ? drafts[activeContactId] : null;

  const allGenerated = attendees.every((a) => drafts[a.contact_id]);
  const hasAnyGenerated = attendees.some((a) => drafts[a.contact_id]);
  const generatedCount = attendees.filter((a) => drafts[a.contact_id]).length;

  if (attendees.length === 0) return null;

  const activeInvitation: InvitationRecord | null = activeContact && activeDraft
    ? {
        id: activeDraft.id,
        contactId: activeDraft.contact_id,
        eventId: activeDraft.event_id,
        executiveName: activeContact.name,
        company: activeContact.company,
        status: activeDraft.status === 'draft' ? 'draft_ready'
          : activeDraft.status === 'sent_test' ? 'sent'
          : activeDraft.status === 'sent_live' ? 'sent'
          : 'reviewed',
        method: activeDraft.delivery_channel === 'email' ? 'email'
          : activeDraft.delivery_channel === 'copy_only' ? 'copy'
          : activeDraft.delivery_channel === 'sms' ? 'sms'
          : 'teams',
        subject: activeDraft.subject || '',
        body: activeDraft.draft_text,
        template: 'professional',
        generatedDate: activeDraft.created_at,
        editedBy: null,
        lastUpdated: activeDraft.updated_at,
        history: [],
      }
    : activeContact
      ? createEmptyInvitation(activeContactId!, event.id, activeContact.name, activeContact.company)
      : null;

  return (
    <Card className="p-5 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Mail className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold">Invitation Center</h2>
            <p className="text-xs text-muted-foreground">
              Generate, review, and send personalized invitations
              {hasAnyGenerated && (
                <span className="ml-1 text-muted-foreground/70">· {generatedCount}/{attendees.length} drafts saved</span>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {draftStatus === 'error' && (
            <Button size="sm" variant="outline" onClick={fetchDrafts}>
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              Retry
            </Button>
          )}
          {hasAnyGenerated && !allGenerated && !batchGenerating && (
            <Button size="sm" onClick={handleBatchGenerate}>
              <Sparkles className="h-3.5 w-3.5 mr-1.5" />
              Generate All
            </Button>
          )}
        </div>
      </div>

      {/* Error state */}
      {draftStatus === 'error' && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 mb-4">
          <div className="flex items-center gap-2 mb-1">
            <AlertCircle className="h-4 w-4 text-destructive" />
            <span className="text-sm font-medium text-destructive">Invitation Data Unavailable</span>
          </div>
          <p className="text-xs text-muted-foreground">Unable to load saved invitation drafts. Click Retry to try again.</p>
        </div>
      )}

      {/* Empty state */}
      {!hasAnyGenerated && draftStatus === 'ready' && !batchGenerating && (
        <div className="text-center py-10">
          <Mail className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm font-medium mb-1">No invitations have been generated.</p>
          <p className="text-xs text-muted-foreground mb-4">Generate personalized invitations for all approved attendees. Drafts are saved automatically.</p>
          <Button size="sm" onClick={handleBatchGenerate}>
            <Sparkles className="h-3.5 w-3.5 mr-1.5" />
            Generate Invitations
          </Button>
        </div>
      )}

      {/* Loading state */}
      {draftStatus === 'loading' && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 text-muted-foreground animate-spin" />
          <span className="text-sm text-muted-foreground ml-2">Loading saved invitations...</span>
        </div>
      )}

      {/* Batch generation overlay */}
      {batchGenerating && batchTarget && (
        <div className="rounded-lg border border-border bg-muted/20 p-4 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <Loader2 className="h-4 w-4 text-primary animate-spin" />
            <span className="text-sm font-medium">
              Generating for {attendees.find((a) => a.contact_id === batchTarget)?.contact?.name || '...'}
            </span>
          </div>
          <div className="space-y-1.5">
            {GENERATION_STEPS.map((step, i) => {
              const isComplete = i < batchStep;
              const isActive = i === batchStep;
              return (
                <div key={i} className="flex items-center gap-2">
                  <div className={cn(
                    'flex h-5 w-5 items-center justify-center rounded-full shrink-0 transition-all',
                    isComplete ? 'bg-emerald-100 dark:bg-emerald-900/30' : isActive ? 'bg-primary/10' : 'bg-muted',
                  )}>
                    {isComplete ? (
                      <div className="h-2 w-2 rounded-full bg-emerald-500" />
                    ) : isActive ? (
                      <Loader2 className="h-3 w-3 animate-spin text-primary" />
                    ) : (
                      <div className="h-1 w-1 rounded-full bg-muted-foreground/30" />
                    )}
                  </div>
                  <span className={cn(
                    'text-xs transition-colors',
                    isComplete ? 'text-foreground font-medium' : isActive ? 'text-foreground' : 'text-muted-foreground',
                  )}>
                    {step}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Invitation table */}
      {draftStatus === 'ready' && (hasAnyGenerated || batchGenerating) && !batchGenerating && (
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full">
            <thead className="border-b border-border">
              <tr>
                <th className="text-left p-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Executive</th>
                <th className="text-left p-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">Company</th>
                <th className="text-left p-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Invitation Status</th>
                <th className="text-left p-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Method</th>
                <th className="text-right p-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {attendees.map((a) => {
                if (!a.contact) return null;
                const draft = drafts[a.contact_id];
                const invStatus = draft
                  ? draft.status === 'draft' ? 'draft_ready'
                    : draft.status === 'sent_test' ? 'sent'
                    : draft.status === 'sent_live' ? 'sent'
                    : 'reviewed'
                  : 'not_generated';
                return (
                  <tr key={a.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="p-2">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold shrink-0">
                          {a.contact.name.split(' ').map((n) => n[0]).slice(0, 2).join('')}
                        </div>
                        <div>
                          <div className="text-sm font-medium">{a.contact.name}</div>
                          <div className="text-xs text-muted-foreground">{a.contact.title || '—'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="p-2 hidden md:table-cell">
                      <span className="text-sm">{a.contact.company}</span>
                    </td>
                    <td className="p-2">
                      <InvitationStatusBadge status={invStatus} />
                    </td>
                    <td className="p-2 hidden lg:table-cell">
                      {draft ? (
                        <Badge variant="outline" className="text-[10px] capitalize">{draft.delivery_channel.replace('_', ' ')}</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="p-2 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {!draft && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleGenerate(a.contact_id)}
                            disabled={generatingContact === a.contact_id}
                          >
                            {generatingContact === a.contact_id ? (
                              <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                            ) : (
                              <Mail className="h-3.5 w-3.5 mr-1" />
                            )}
                            {generatingContact === a.contact_id ? 'Generating...' : 'Generate'}
                          </Button>
                        )}
                        {draft && (
                          <>
                            <Button size="sm" variant="ghost" onClick={() => handleOpenEditor(a.contact_id)} title="View / Edit">
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => handleOpenEditor(a.contact_id)}>
                              <FileText className="h-3.5 w-3.5 mr-1" />
                              Edit
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Editor dialog */}
      {activeContact && activeInvitation && (
        <InvitationEditor
          open={editorOpen}
          onOpenChange={setEditorOpen}
          contact={activeContact}
          event={event}
          invitation={activeInvitation}
          onSave={handleSave}
          onSend={handleSend}
          onCopy={handleCopy}
        />
      )}
    </Card>
  );
}
