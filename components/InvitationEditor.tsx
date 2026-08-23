'use client';

import { useState, useMemo } from 'react';
import {
  Mail, MessageSquare, Copy, Linkedin, Smartphone, Users as TeamsIcon,
  Monitor, Send, Save, CheckCircle2, AlertTriangle,
  History, FileText, Eye, Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { InvitationStatusBadge } from '@/components/InvitationStatusBadge';
import {
  COMMUNICATION_METHODS, TEMPLATE_LABELS, GENERATION_STEPS,
  generateMockInvitation, type InvitationRecord, type InvitationStatus,
  type CommunicationMethod, type MessageTemplate,
} from '@/lib/invitation';
import type { Contact, EventItem } from '@/lib/types';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface InvitationEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact: Contact;
  event: EventItem;
  invitation: InvitationRecord;
  onSave: (record: InvitationRecord) => void;
  onSend: (record: InvitationRecord) => void;
  onCopy: (record: InvitationRecord) => void;
}

type SendPhase = 'idle' | 'sending' | 'queued' | 'sent';

export function InvitationEditor({
  open, onOpenChange, contact, event, invitation, onSave, onSend, onCopy,
}: InvitationEditorProps) {
  const [subject, setSubject] = useState(invitation.subject);
  const [body, setBody] = useState(invitation.body);
  const [method, setMethod] = useState<CommunicationMethod>(invitation.method ?? 'email');
  const [template, setTemplate] = useState<MessageTemplate>(invitation.template);
  const [generating, setGenerating] = useState(false);
  const [genStep, setGenStep] = useState(0);
  const [sendPhase, setSendPhase] = useState<SendPhase>('idle');
  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile' | 'email'>('email');

  const hasEmail = !!contact.email;
  const hasPhone = !!contact.phone;

  const methodIcon: Record<CommunicationMethod, React.ElementType> = {
    email: Mail,
    sms: MessageSquare,
    copy: Copy,
    linkedin: Linkedin,
    whatsapp: Smartphone,
    teams: TeamsIcon,
  };

  const handleGenerate = () => {
    setGenerating(true);
    setGenStep(0);
    const interval = setInterval(() => {
      setGenStep((s) => {
        if (s >= GENERATION_STEPS.length - 1) {
          clearInterval(interval);
          return s;
        }
        return s + 1;
      });
    }, 700);

    setTimeout(() => {
      clearInterval(interval);
      const draft = generateMockInvitation(contact, event, template);
      setSubject(draft.subject);
      setBody(draft.body);
      setGenStep(GENERATION_STEPS.length - 1);
      setGenerating(false);
      toast.success('Draft generated');
    }, GENERATION_STEPS.length * 700);
  };

  const handleTemplateChange = (t: MessageTemplate) => {
    setTemplate(t);
    if (subject || body) {
      const draft = generateMockInvitation(contact, event, t);
      setSubject(draft.subject);
      setBody(draft.body);
    }
  };

  const handleSave = () => {
    const updated: InvitationRecord = {
      ...invitation,
      subject,
      body,
      method,
      template,
      status: 'reviewed',
      editedBy: 'You',
      lastUpdated: new Date().toISOString(),
      history: [
        ...invitation.history,
        {
          id: `h-${Date.now()}`,
          timestamp: new Date().toISOString(),
          action: 'Edited',
          detail: 'Draft reviewed and saved',
          editedBy: 'You',
          status: 'reviewed',
          method,
        },
      ],
    };
    onSave(updated);
    toast.success('Invitation saved');
  };

  const handleSend = () => {
    setSendPhase('sending');
    setTimeout(() => setSendPhase('queued'), 800);
    setTimeout(() => {
      setSendPhase('sent');
      const updated: InvitationRecord = {
        ...invitation,
        subject,
        body,
        method,
        template,
        status: 'sent',
        editedBy: 'You',
        lastUpdated: new Date().toISOString(),
        history: [
          ...invitation.history,
          {
            id: `h-${Date.now()}`,
            timestamp: new Date().toISOString(),
            action: 'Sent',
            detail: `Invitation sent via ${method}`,
            editedBy: 'You',
            status: 'sent',
            method,
          },
        ],
      };
      onSend(updated);
      setTimeout(() => {
        setSendPhase('idle');
        onOpenChange(false);
      }, 1200);
    }, 1800);
  };

  const handleCopy = () => {
    const text = `Subject: ${subject}\n\n${body}`;
    navigator.clipboard.writeText(text).then(() => {
      const updated: InvitationRecord = {
        ...invitation,
        subject,
        body,
        method: 'copy',
        template,
        status: 'sent',
        editedBy: 'You',
        lastUpdated: new Date().toISOString(),
        history: [
          ...invitation.history,
          {
            id: `h-${Date.now()}`,
            timestamp: new Date().toISOString(),
            action: 'Copied',
            detail: 'Invitation copied to clipboard',
            editedBy: 'You',
            status: 'sent',
            method: 'copy',
          },
        ],
      };
      onCopy(updated);
      toast.success('Copied successfully');
    });
  };

  const emailValidation = useMemo(() => {
    if (method !== 'email') return null;
    if (!hasEmail) return { type: 'error', message: 'This executive does not have an email address. Use SMS or Copy to Clipboard instead.' };
    return { type: 'ok', message: 'Email Ready' };
  }, [method, hasEmail]);

  const smsValidation = useMemo(() => {
    if (method !== 'sms') return null;
    if (!hasPhone) return { type: 'error', message: 'No phone number available.' };
    return { type: 'ok', message: 'SMS Ready' };
  }, [method, hasPhone]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Invitation Editor</DialogTitle>
          <DialogDescription>
            {contact.name} · {contact.company} · {event.event_name}
          </DialogDescription>
        </DialogHeader>

        {/* Generation overlay */}
        {generating && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm rounded-lg">
            <div className="mx-4 w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-xl">
              <div className="mb-4 text-center">
                <Loader2 className="h-8 w-8 text-primary animate-spin mx-auto mb-2" />
                <h3 className="text-sm font-semibold">Generating Invitation</h3>
                <p className="text-xs text-muted-foreground mt-0.5">for {contact.name}</p>
              </div>
              <div className="space-y-2.5">
                {GENERATION_STEPS.map((step, i) => {
                  const isComplete = i < genStep;
                  const isActive = i === genStep;
                  return (
                    <div key={i} className="flex items-center gap-3">
                      <div className={cn(
                        'flex h-7 w-7 items-center justify-center rounded-full shrink-0 transition-all',
                        isComplete ? 'bg-emerald-100 dark:bg-emerald-900/30' : isActive ? 'bg-primary/10' : 'bg-muted',
                      )}>
                        {isComplete ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                        ) : isActive ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                        ) : (
                          <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/30" />
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

        {/* Send overlay */}
        {sendPhase !== 'idle' && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm rounded-lg">
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card p-8 shadow-xl">
              {sendPhase === 'sending' && (
                <>
                  <Loader2 className="h-8 w-8 text-primary animate-spin" />
                  <p className="text-sm font-medium">Sending...</p>
                </>
              )}
              {sendPhase === 'queued' && (
                <>
                  <div className="h-8 w-8 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                    <History className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                  </div>
                  <p className="text-sm font-medium">Invitation queued.</p>
                </>
              )}
              {sendPhase === 'sent' && (
                <>
                  <div className="h-8 w-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <p className="text-sm font-medium">Sent successfully.</p>
                </>
              )}
            </div>
          </div>
        )}

        <Tabs defaultValue="compose" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="compose"><FileText className="h-3.5 w-3.5 mr-1.5" />Compose</TabsTrigger>
            <TabsTrigger value="preview"><Eye className="h-3.5 w-3.5 mr-1.5" />Preview</TabsTrigger>
            <TabsTrigger value="history"><History className="h-3.5 w-3.5 mr-1.5" />History</TabsTrigger>
          </TabsList>

          {/* Compose Tab */}
          <TabsContent value="compose" className="space-y-4 mt-4">
            {/* Generate button */}
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-semibold">AI Draft Generation</Label>
                <p className="text-xs text-muted-foreground mt-0.5">Generate a personalized draft based on executive intelligence and event objectives.</p>
              </div>
              <Button size="sm" onClick={handleGenerate} disabled={generating}>
                <Mail className="h-3.5 w-3.5 mr-1.5" />
                {generating ? 'Generating...' : 'Generate Invitation'}
              </Button>
            </div>

            {/* Template selector */}
            <div>
              <Label className="text-xs font-medium mb-2 block">Message Template</Label>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(TEMPLATE_LABELS) as MessageTemplate[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => handleTemplateChange(t)}
                    className={cn(
                      'rounded-lg border px-3 py-1.5 text-xs font-medium transition-all',
                      template === t
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border text-muted-foreground hover:border-primary/30 hover:text-foreground',
                    )}
                  >
                    {TEMPLATE_LABELS[t]}
                  </button>
                ))}
              </div>
            </div>

            {/* Subject */}
            <div>
              <Label htmlFor="inv-subject" className="text-xs font-medium mb-1.5 block">Subject</Label>
              <Input
                id="inv-subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Enter subject line..."
              />
            </div>

            {/* Body */}
            <div>
              <Label htmlFor="inv-body" className="text-xs font-medium mb-1.5 block">Message</Label>
              <Textarea
                id="inv-body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={10}
                placeholder="Write your invitation message..."
                className="resize-y"
              />
            </div>

            {/* Communication Method */}
            <div>
              <Label className="text-xs font-medium mb-2 block">Communication Method</Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {COMMUNICATION_METHODS.map((m) => {
                  const Icon = methodIcon[m.id];
                  const isDisabled = !m.available ||
                    (m.id === 'email' && !hasEmail) ||
                    (m.id === 'sms' && !hasPhone);
                  const isSelected = method === m.id;
                  return (
                    <button
                      key={m.id}
                      disabled={isDisabled}
                      onClick={() => setMethod(m.id)}
                      className={cn(
                        'flex items-center gap-2 rounded-lg border-2 px-3 py-2 text-left transition-all',
                        isSelected ? 'border-primary bg-primary/5' : 'border-border',
                        isDisabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-primary/30',
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <div className="min-w-0">
                        <div className="text-xs font-medium truncate">{m.label}</div>
                        {!m.available && (
                          <div className="text-[10px] text-muted-foreground">Coming Soon</div>
                        )}
                        {m.available && m.id === 'email' && !hasEmail && (
                          <div className="text-[10px] text-rose-500">No email</div>
                        )}
                        {m.available && m.id === 'sms' && !hasPhone && (
                          <div className="text-[10px] text-rose-500">No phone</div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Validation messages */}
            {emailValidation && (
              <div className={cn(
                'flex items-start gap-2 rounded-lg border p-3',
                emailValidation.type === 'error'
                  ? 'border-rose-200 bg-rose-50 dark:border-rose-800 dark:bg-rose-900/10'
                  : 'border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-900/10',
              )}>
                {emailValidation.type === 'error' ? (
                  <AlertTriangle className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                )}
                <p className={cn(
                  'text-xs',
                  emailValidation.type === 'error' ? 'text-rose-700 dark:text-rose-400' : 'text-emerald-700 dark:text-emerald-400',
                )}>
                  {emailValidation.message}
                </p>
              </div>
            )}
            {smsValidation && (
              <div className={cn(
                'flex items-start gap-2 rounded-lg border p-3',
                smsValidation.type === 'error'
                  ? 'border-rose-200 bg-rose-50 dark:border-rose-800 dark:bg-rose-900/10'
                  : 'border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-900/10',
              )}>
                {smsValidation.type === 'error' ? (
                  <AlertTriangle className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                )}
                <p className={cn(
                  'text-xs',
                  smsValidation.type === 'error' ? 'text-rose-700 dark:text-rose-400' : 'text-emerald-700 dark:text-emerald-400',
                )}>
                  {smsValidation.message}
                </p>
              </div>
            )}
          </TabsContent>

          {/* Preview Tab */}
          <TabsContent value="preview" className="space-y-3 mt-4">
            {/* Preview mode toggle */}
            <div className="flex items-center gap-2">
              <div className="flex rounded-lg border border-border p-0.5">
                {([
                  { id: 'email', label: 'Email', icon: Mail },
                  { id: 'desktop', label: 'Desktop', icon: Monitor },
                  { id: 'mobile', label: 'Mobile', icon: Smartphone },
                ] as const).map((m) => {
                  const Icon = m.icon;
                  return (
                    <button
                      key={m.id}
                      onClick={() => setPreviewMode(m.id)}
                      className={cn(
                        'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                        previewMode === m.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {m.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Preview content */}
            {previewMode === 'email' && (
              <div className="rounded-lg border border-border overflow-hidden">
                <div className="border-b border-border bg-muted/30 px-4 py-2.5 space-y-1">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-muted-foreground font-medium">To:</span>
                    <span className="text-foreground">{hasEmail ? contact.email : '(no email)'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-muted-foreground font-medium">Subject:</span>
                    <span className="text-foreground font-medium">{subject || '(no subject)'}</span>
                  </div>
                </div>
                <div className="p-4">
                  <div className="text-sm whitespace-pre-wrap leading-relaxed">{body || '(empty message)'}</div>
                </div>
              </div>
            )}

            {previewMode === 'desktop' && (
              <div className="rounded-lg border border-border p-6">
                <div className="text-xs text-muted-foreground mb-1">Subject: {subject || '(no subject)'}</div>
                <div className="border-t border-border pt-3">
                  <div className="text-sm whitespace-pre-wrap leading-relaxed">{body || '(empty message)'}</div>
                </div>
              </div>
            )}

            {previewMode === 'mobile' && (
              <div className="flex justify-center">
                <div className="w-[320px] rounded-2xl border-4 border-slate-800 dark:border-slate-700 p-3 bg-card">
                  <div className="text-[10px] text-muted-foreground text-center mb-2">Mobile Preview</div>
                  <div className="rounded-lg border border-border p-3">
                    <div className="text-xs font-semibold mb-1">{subject || '(no subject)'}</div>
                    <div className="border-t border-border pt-2">
                      <div className="text-xs whitespace-pre-wrap leading-relaxed">{body || '(empty message)'}</div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history" className="space-y-3 mt-4">
            <div className="grid grid-cols-2 gap-3 rounded-lg border border-border p-3">
              <div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Generated Date</div>
                <div className="text-sm font-medium">{invitation.generatedDate ? new Date(invitation.generatedDate).toLocaleString() : '—'}</div>
              </div>
              <div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Edited By</div>
                <div className="text-sm font-medium">{invitation.editedBy || '—'}</div>
              </div>
              <div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Communication Method</div>
                <div className="text-sm font-medium capitalize">{invitation.method?.replace('_', ' ') || '—'}</div>
              </div>
              <div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Status</div>
                <div><InvitationStatusBadge status={invitation.status} /></div>
              </div>
              <div className="col-span-2">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Last Updated</div>
                <div className="text-sm font-medium">{new Date(invitation.lastUpdated).toLocaleString()}</div>
              </div>
            </div>

            {invitation.history.length > 0 ? (
              <div className="space-y-2">
                {invitation.history.slice().reverse().map((h) => (
                  <div key={h.id} className="flex items-start gap-3 rounded-lg border border-border p-3">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary shrink-0">
                      <History className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{h.action}</span>
                        <InvitationStatusBadge status={h.status} />
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{h.detail}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {new Date(h.timestamp).toLocaleString()} · by {h.editedBy}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6">
                <History className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No history yet.</p>
              </div>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={handleCopy} disabled={!subject && !body}>
            <Copy className="h-4 w-4 mr-2" />
            Copy to Clipboard
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleSave} disabled={!subject && !body}>
              <Save className="h-4 w-4 mr-2" />
              Save Draft
            </Button>
            <Button onClick={handleSend} disabled={!subject || !body || sendPhase !== 'idle'}>
              <Send className="h-4 w-4 mr-2" />
              Send
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
