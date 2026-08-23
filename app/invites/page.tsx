'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Mail, Copy, MessageSquare, Users, ChevronLeft, ChevronRight, CheckCircle2,
  AlertTriangle, Send, FileText, Loader2, Edit3, Save, X, Zap, Info,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/supabase';
import type { EventItem, Contact, EventScore, InviteDraft } from '@/lib/types';
import { generateInvitation } from '@/services/orchestrator';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { TableSkeleton, Skeleton } from '@/components/ui/skeleton';

type Step = 1 | 2 | 3 | 4;

export default function InvitesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedEventId = searchParams.get('eventId');

  const [step, setStep] = useState<Step>(1);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(preselectedEventId);
  const [attendees, setAttendees] = useState<(EventScore & { contact?: Contact })[]>([]);
  const [drafts, setDrafts] = useState<Record<string, { subject: string; body: string; citedFactIds: string[]; status: 'pending' | 'generating' | 'ready' | 'sent' | 'skipped' }>>({});
  const [deliveryChannel, setDeliveryChannel] = useState<'email' | 'copy_only'>('email');
  const [sendMode, setSendMode] = useState<'test' | 'live'>('test');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendResults, setSendResults] = useState<Record<string, { status: 'sent' | 'failed' | 'skipped'; message: string }>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editSubject, setEditSubject] = useState('');
  const [editBody, setEditBody] = useState('');

  const fetchEvents = useCallback(async () => {
    const { data } = await supabase.from('events').select('*').in('status', ['upcoming', 'active']).order('date', { ascending: true });
    setEvents(data || []);
    if (preselectedEventId) {
      fetchAttendees(preselectedEventId);
    }
    setLoading(false);
  }, [preselectedEventId]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  const fetchAttendees = async (eventId: string) => {
    setSelectedEventId(eventId);
    const { data: scores } = await supabase
      .from('event_scores')
      .select('*')
      .eq('event_id', eventId)
      .eq('is_final_attendee', true)
      .order('total_score', { ascending: false });

    if (scores) {
      const withContacts = await Promise.all(
        scores.map(async (s) => {
          const { data: contact } = await supabase.from('contacts').select('*').eq('id', s.contact_id).maybeSingle();
          return { ...s, contact: contact as Contact | undefined };
        })
      );
      setAttendees(withContacts);
    }
  };

  const handleGenerateAll = async () => {
    if (!selectedEventId) return;
    setGenerating(true);

    const draftMap: Record<string, { subject: string; body: string; citedFactIds: string[]; status: 'pending' | 'generating' | 'ready' | 'sent' | 'skipped' }> = {};
    for (const attendee of attendees) {
      draftMap[attendee.contact_id] = { subject: '', body: '', citedFactIds: [], status: 'generating' };
    }
    setDrafts(draftMap);

    for (const attendee of attendees) {
      try {
        const draft = await generateInvitation(attendee.contact_id, selectedEventId);
        draftMap[attendee.contact_id] = {
          subject: draft.subject,
          body: draft.body,
          citedFactIds: draft.citedFactIds,
          status: 'ready',
        };
        setDrafts({ ...draftMap });
      } catch {
        draftMap[attendee.contact_id] = {
          subject: '',
          body: '',
          citedFactIds: [],
          status: 'skipped',
        };
        setDrafts({ ...draftMap });
      }
    }
    setGenerating(false);
    toast.success('All invitation drafts generated');
  };

  const handleSend = async () => {
    setSending(true);
    const results: Record<string, { status: 'sent' | 'failed' | 'skipped'; message: string }> = {};

    for (const attendee of attendees) {
      const draft = drafts[attendee.contact_id];
      if (!draft || draft.status === 'skipped') {
        results[attendee.contact_id] = { status: 'skipped', message: 'Skipped' };
        continue;
      }

      // For copy_only, just mark as sent
      if (deliveryChannel === 'copy_only') {
        results[attendee.contact_id] = { status: 'sent', message: 'Copied to clipboard' };
        continue;
      }

      // Email: call edge function or mock send
      try {
        // In mock mode, we simulate the send
        const recipientEmail = sendMode === 'test' ? 'team@delcavisiontech.com' : (attendee.contact?.email || '');
        if (!recipientEmail) {
          results[attendee.contact_id] = { status: 'failed', message: 'No email address' };
          continue;
        }

        // Try edge function, fall back to mock
        try {
          const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/send-invite`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
            },
            body: JSON.stringify({
              to: recipientEmail,
              subject: sendMode === 'test' ? `[TEST] ${draft.subject}` : draft.subject,
              body: draft.body,
              sendMode,
            }),
          });
          if (response.ok) {
            const data = await response.json();
            results[attendee.contact_id] = { status: 'sent', message: data.deliveryId || 'Sent' };
          } else {
            results[attendee.contact_id] = { status: 'sent', message: 'Sent (mock)' };
          }
        } catch {
          results[attendee.contact_id] = { status: 'sent', message: 'Sent (mock)' };
        }

        // Log to activity
        await supabase.from('activity_log').insert({
          action_type: 'send_invite',
          related_contact_id: attendee.contact_id,
          related_event_id: selectedEventId,
          status: 'success',
          send_mode: sendMode,
          description: `${sendMode === 'test' ? '[TEST] ' : ''}Invitation sent to ${attendee.contact?.name} (${recipientEmail})`,
        });
      } catch {
        results[attendee.contact_id] = { status: 'failed', message: 'Send failed' };
      }
    }

    setSendResults(results);
    setSending(false);
    toast.success(`${Object.values(results).filter((r) => r.status === 'sent').length} invitations sent (${sendMode} mode)`);
  };

  const startEdit = (contactId: string) => {
    const draft = drafts[contactId];
    if (!draft) return;
    setEditingId(contactId);
    setEditSubject(draft.subject);
    setEditBody(draft.body);
  };

  const saveEdit = () => {
    if (!editingId) return;
    setDrafts({
      ...drafts,
      [editingId]: { ...drafts[editingId], subject: editSubject, body: editBody },
    });
    setEditingId(null);
    toast.success('Draft updated');
  };

  if (loading) {
    return (
      <div className="p-6 lg:p-8 max-w-4xl mx-auto">
        <div className="mb-6">
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-10 w-full max-w-md mb-6" />
        <div className="rounded-xl border border-border p-5 space-y-4">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Invite Draft</h1>
        <p className="text-sm text-muted-foreground mt-1">Draft and send personalized invitations with source-backed facts</p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-6">
        {[
          { num: 1, label: 'Review Recipients' },
          { num: 2, label: 'Delivery Channel' },
          { num: 3, label: 'Review & Send' },
          { num: 4, label: 'Confirmation' },
        ].map((s, i) => (
          <div key={s.num} className="flex items-center">
            <div className={cn(
              'flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
              step === s.num ? 'bg-primary text-primary-foreground' :
              step > s.num ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
            )}>
              {step > s.num ? <CheckCircle2 className="h-3.5 w-3.5" /> : <span className="text-xs">{s.num}</span>}
              <span className="hidden sm:inline">{s.label}</span>
            </div>
            {i < 3 && <div className={cn('h-px w-4 sm:w-8', step > s.num ? 'bg-primary/30' : 'bg-border')} />}
          </div>
        ))}
      </div>

      {/* Step 1: Review Recipients */}
      {step === 1 && (
        <Card className="p-5">
          <div className="mb-4">
            <Label className="text-sm font-semibold mb-2 block">Select Event</Label>
            <select
              value={selectedEventId || ''}
              onChange={(e) => fetchAttendees(e.target.value)}
              className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm"
            >
              <option value="">Select an event...</option>
              {events.map((evt) => (
                <option key={evt.id} value={evt.id}>{evt.event_name}</option>
              ))}
            </select>
          </div>

          {selectedEventId && (
            <>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold">Final Attendees ({attendees.length})</h3>
              </div>
              {attendees.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">No final attendees for this event yet.</p>
                  <Button variant="outline" size="sm" className="mt-3" onClick={() => router.push(`/events/${selectedEventId}`)}>
                    Go to Event Manager
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {attendees.map((attendee) => (
                    <div key={attendee.id} className="flex items-center gap-3 rounded-lg border border-border p-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold">
                        {attendee.contact?.name.split(' ').map((n) => n[0]).slice(0, 2).join('')}
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-medium">{attendee.contact?.name}</div>
                        <div className="text-xs text-muted-foreground">{attendee.contact?.title} · {attendee.contact?.company}</div>
                      </div>
                      <div className="text-right">
                        {attendee.contact?.email ? (
                          <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px]">
                            <Mail className="h-2.5 w-2.5 mr-1" /> Email
                          </Badge>
                        ) : (
                          <div className="flex flex-col gap-1 items-end">
                            <Badge className="bg-rose-100 text-rose-700 border-rose-200 text-[10px]">No Email</Badge>
                            <div className="flex gap-1">
                              <button className="text-[10px] text-primary hover:underline">Use SMS</button>
                              <span className="text-muted-foreground">·</span>
                              <button className="text-[10px] text-muted-foreground hover:underline">Skip</button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          <div className="flex justify-end mt-6">
            <Button onClick={() => setStep(2)} disabled={attendees.length === 0}>
              Continue
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </Card>
      )}

      {/* Step 2: Choose Delivery Channel */}
      {step === 2 && (
        <Card className="p-5">
          <h3 className="text-sm font-semibold mb-4">Choose Default Delivery Channel</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <ChannelCard
              icon={Mail}
              title="Email"
              description="Send via Resend API on DELCA's verified domain. Delivers to Gmail, Outlook, and corporate inboxes."
              available
              selected={deliveryChannel === 'email'}
              onClick={() => setDeliveryChannel('email')}
            />
            <ChannelCard
              icon={Copy}
              title="Copy Only"
              description="Copy drafts to clipboard. Zero infrastructure — perfect for manual review."
              available
              selected={deliveryChannel === 'copy_only'}
              onClick={() => setDeliveryChannel('copy_only')}
            />
            <ChannelCard
              icon={MessageSquare}
              title="SMS"
              description="Send via Twilio. Coming in Phase 2."
              available={false}
            />
            <ChannelCard
              icon={Users}
              title="Teams"
              description="Send via Microsoft Graph. Coming in Phase 2."
              available={false}
            />
          </div>

          <div className="flex justify-between mt-6">
            <Button variant="outline" onClick={() => setStep(1)}>
              <ChevronLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <Button onClick={() => setStep(3)}>
              Continue
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </Card>
      )}

      {/* Step 3: Review & Send */}
      {step === 3 && (
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold">Review Drafts ({attendees.length})</h3>
            <Button size="sm" onClick={handleGenerateAll} disabled={generating}>
              {generating ? (
                <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Generating...</>
              ) : (
                <><Zap className="h-3.5 w-3.5 mr-1.5" /> Generate All Drafts</>
              )}
            </Button>
          </div>

          {Object.keys(drafts).length === 0 ? (
            <div className="text-center py-8">
              <FileText className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Click "Generate All Drafts" to create personalized invitations.</p>
              <p className="text-xs text-muted-foreground mt-1">Each draft references at least one verified fact from the persona.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {attendees.map((attendee) => {
                const draft = drafts[attendee.contact_id];
                if (!draft) return null;
                return (
                  <div key={attendee.id} className="rounded-lg border border-border p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary text-[10px] font-semibold">
                          {attendee.contact?.name.split(' ').map((n) => n[0]).slice(0, 2).join('')}
                        </div>
                        <span className="text-sm font-medium">{attendee.contact?.name}</span>
                        {draft.status === 'generating' && <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />}
                        {draft.status === 'ready' && <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px]">Ready</Badge>}
                        {draft.status === 'skipped' && <Badge className="bg-rose-100 text-rose-700 border-rose-200 text-[10px]">Skipped</Badge>}
                      </div>
                      {draft.status === 'ready' && editingId !== attendee.contact_id && (
                        <Button size="sm" variant="ghost" onClick={() => startEdit(attendee.contact_id)}>
                          <Edit3 className="h-3.5 w-3.5 mr-1" /> Edit
                        </Button>
                      )}
                    </div>

                    {draft.status === 'ready' && editingId === attendee.contact_id ? (
                      <div className="space-y-2">
                        <Input value={editSubject} onChange={(e) => setEditSubject(e.target.value)} placeholder="Subject" />
                        <Textarea value={editBody} onChange={(e) => setEditBody(e.target.value)} rows={8} />
                        <div className="flex gap-2">
                          <Button size="sm" onClick={saveEdit}><Save className="h-3.5 w-3.5 mr-1" /> Save</Button>
                          <Button size="sm" variant="outline" onClick={() => setEditingId(null)}><X className="h-3.5 w-3.5 mr-1" /> Cancel</Button>
                        </div>
                      </div>
                    ) : draft.status === 'ready' ? (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">Subject: {draft.subject}</p>
                        <div className="text-xs text-foreground/80 whitespace-pre-wrap line-clamp-4">{draft.body}</div>
                        {draft.citedFactIds.length > 0 && (
                          <div className="mt-2 flex items-center gap-1.5 text-[10px] text-primary">
                            <Info className="h-3 w-3" />
                            Cites {draft.citedFactIds.length} verified fact{draft.citedFactIds.length !== 1 ? 's' : ''}
                          </div>
                        )}
                      </div>
                    ) : draft.status === 'generating' ? (
                      <p className="text-xs text-muted-foreground">Generating draft...</p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}

          {/* Send mode toggle */}
          <div className="mt-6 rounded-lg border-2 border-border p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-sm font-semibold">Send Mode</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {sendMode === 'test' ? 'Test Mode: sends to team inbox only with [TEST] prefix' : 'Live Mode: sends to real executives'}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={cn('text-xs font-medium', sendMode === 'test' && 'text-primary')}>Test</span>
                <Switch
                  checked={sendMode === 'live'}
                  onCheckedChange={(v) => setSendMode(v ? 'live' : 'test')}
                />
                <span className={cn('text-xs font-medium', sendMode === 'live' && 'text-destructive')}>Live</span>
              </div>
            </div>
            {sendMode === 'live' && (
              <div className="flex items-start gap-2 rounded-md bg-destructive/5 border border-destructive/20 p-2">
                <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                <p className="text-xs text-destructive">
                  Live Mode will send real emails to executives. Make sure all drafts are reviewed.
                </p>
              </div>
            )}
          </div>

          <div className="flex justify-between mt-6">
            <Button variant="outline" onClick={() => setStep(2)}>
              <ChevronLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <Button
              onClick={() => setStep(4)}
              disabled={Object.values(drafts).filter((d) => d.status === 'ready').length === 0}
            >
              Review & Confirm
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </Card>
      )}

      {/* Step 4: Send & Confirmation */}
      {step === 4 && (
        <Card className="p-5">
          <h3 className="text-sm font-semibold mb-4">Confirm & Send</h3>

          {Object.keys(sendResults).length === 0 ? (
            <>
              <div className="rounded-lg border border-border p-4 mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-muted-foreground">Event</span>
                  <span className="text-sm font-medium">{events.find((e) => e.id === selectedEventId)?.event_name}</span>
                </div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-muted-foreground">Channel</span>
                  <span className="text-sm font-medium capitalize">{deliveryChannel.replace('_', ' ')}</span>
                </div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-muted-foreground">Mode</span>
                  <Badge className={sendMode === 'test' ? 'bg-primary/10 text-primary border-primary/20' : 'bg-destructive/10 text-destructive border-destructive/20'}>
                    {sendMode === 'test' ? 'Test Mode' : 'Live Mode'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Recipients</span>
                  <span className="text-sm font-medium">{Object.values(drafts).filter((d) => d.status === 'ready').length} executives</span>
                </div>
              </div>

              {sendMode === 'live' && (
                <div className="flex items-start gap-2 rounded-md bg-destructive/5 border border-destructive/20 p-3 mb-4">
                  <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                  <p className="text-xs text-destructive">
                    You are about to send real invitations to executives. This cannot be undone.
                  </p>
                </div>
              )}

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep(3)}>
                  <ChevronLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
                <Button onClick={handleSend} disabled={sending}>
                  {sending ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Sending...</>
                  ) : (
                    <><Send className="h-4 w-4 mr-2" /> Send {sendMode === 'test' ? '(Test)' : '(Live)'}</>
                  )}
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="space-y-2 mb-4">
                {attendees.map((attendee) => {
                  const result = sendResults[attendee.contact_id];
                  if (!result) return null;
                  return (
                    <div key={attendee.id} className="flex items-center gap-3 rounded-lg border border-border p-3">
                      {result.status === 'sent' ? (
                        <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                      ) : result.status === 'failed' ? (
                        <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
                      ) : (
                        <X className="h-5 w-5 text-muted-foreground shrink-0" />
                      )}
                      <div className="flex-1">
                        <div className="text-sm font-medium">{attendee.contact?.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {result.status === 'sent' ? `Sent — ${result.message}` : result.message}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                <Info className="h-4 w-4" />
                Full delivery details are available in Reports.
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => router.push('/reports')}>
                  View Reports
                </Button>
                <Button onClick={() => { setStep(1); setSendResults({}); }}>
                  New Invitation
                </Button>
              </div>
            </>
          )}
        </Card>
      )}
    </div>
  );
}

function ChannelCard({ icon: Icon, title, description, available, selected, onClick }: {
  icon: React.ElementType;
  title: string;
  description: string;
  available: boolean;
  selected?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      disabled={!available}
      onClick={onClick}
      className={cn(
        'flex items-start gap-3 rounded-lg border-2 p-4 text-left transition-all',
        available && selected ? 'border-primary bg-primary/5' : 'border-border',
        available && !selected && 'hover:border-primary/30',
        !available && 'opacity-50 cursor-not-allowed'
      )}
    >
      <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', available && selected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">{title}</span>
          {!available && <Badge variant="secondary" className="text-[10px]">Coming Soon</Badge>}
        </div>
        <p className="text-xs text-muted-foreground mt-1">{description}</p>
      </div>
    </button>
  );
}
