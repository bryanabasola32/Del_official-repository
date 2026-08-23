'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Sparkles, Send, Loader2, ExternalLink, FileText, Target, CheckCircle2,
  Mail, MessageSquare, AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ConversationMessage, Citation } from '@/components/intelligence';
import { detectIntent, getStagesForIntent, type ThinkingStage } from '@/services/intentDetector';
import { orchestrator } from '@/services/orchestrator';
import { getIntelligenceRouter } from '@/services/router';
import { toPromptContext, type MasterExecutiveBrief } from '@/services/masterExecutiveBrief';
import type { Contact, Source } from '@/lib/types';

const EXEC_CHAT_PROMPTS = [
  { icon: FileText, label: 'Summarize this executive', prompt: 'Summarize this executive for me' },
  { icon: Target, label: 'Why this recommendation?', prompt: 'Why was this recommendation made?' },
  { icon: CheckCircle2, label: 'Should we invite them?', prompt: 'Should we invite this executive?' },
  { icon: Mail, label: 'Write an outreach email', prompt: 'Write an executive outreach email for this executive' },
  { icon: MessageSquare, label: 'Suggest conversation starters', prompt: 'Suggest conversation starters for this executive' },
  { icon: AlertTriangle, label: 'Explain the risks', prompt: 'Explain the risks with this executive' },
];

export function AssistantPanel({
  contact,
  contactId,
  brief,
  sources,
  autoFocusInput,
}: {
  contact: Contact;
  contactId: string;
  brief: MasterExecutiveBrief | null;
  sources: Record<string, Source[]>;
  autoFocusInput?: boolean;
}) {
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [input, setInput] = useState('');
  const [processing, setProcessing] = useState(false);
  const [thinkingStages, setThinkingStages] = useState<ThinkingStage[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, processing]);

  useEffect(() => {
    if (autoFocusInput) {
      const timer = setTimeout(() => inputRef.current?.focus(), 300);
      return () => clearTimeout(timer);
    }
  }, [autoFocusInput]);

  const handleSend = useCallback(async (text: string) => {
    if (!text.trim() || processing || !contact) return;

    const userMsg: ConversationMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    };
    setMessages((m) => [...m, userMsg]);
    setProcessing(true);
    setInput('');

    try {
      const intent = detectIntent(text);
      const stages = getStagesForIntent(intent, true);
      setThinkingStages(stages);

      for (let i = 0; i < stages.length; i++) {
        setThinkingStages((prev) => {
          const updated = [...prev];
          if (updated[i]) updated[i] = { ...updated[i], status: 'running', timestamp: Date.now() };
          return updated;
        });
        await new Promise((r) => setTimeout(r, 200));
        setThinkingStages((prev) => {
          const updated = [...prev];
          if (updated[i]) updated[i] = { ...updated[i], status: 'completed', timestamp: Date.now() };
          return updated;
        });
      }

      let executiveContextStr = '';
      if (brief) {
        executiveContextStr = `\n\nExecutive intelligence context:\nName: ${contact.name}\nTitle: ${contact.title || 'Unknown'}\nCompany: ${contact.company}\n\n${toPromptContext(brief)}`;
      } else {
        executiveContextStr = `\n\nExecutive context:\nName: ${contact.name}\nTitle: ${contact.title || 'Unknown'}\nCompany: ${contact.company}\nPersona Status: ${contact.persona_status}\nPersona Type: ${contact.persona_type || 'Not generated'}\nConfidence: ${contact.persona_confidence_pct || 'N/A'}%\nExecutive Summary: ${contact.executive_summary || 'Not available'}\nDecision Style: ${contact.decision_style || 'Not available'}\nTech Readiness: ${contact.tech_readiness_level || 'Not available'}`;
      }

      const systemPrompt = `You are DEL Intelligence, an AI assistant for an executive event management platform. You are currently viewing the executive profile page for ${contact.name}. Answer questions about this executive using the intelligence context provided below. Ground every answer in the specific evidence and reports generated for this contact. State conclusions plainly.${executiveContextStr}`;

      const task = {
        taskType: intent.taskType,
        prompt: text,
        systemPrompt,
        context: {
          sessionId: `exec-${contactId}`,
          intent: intent.type,
          executiveId: contactId,
          executiveName: contact.name,
        },
        metadata: {
          sessionId: `exec-${contactId}`,
          source: 'intelligence-detail',
          intent: intent.type,
        },
        temperature: 0.7,
        maxTokens: 2048,
      };

      orchestrator.ensureProvidersRegistered();
      const router = getIntelligenceRouter();
      const response = await router.execute(task as Parameters<typeof router.execute>[0]);

      let citations: Citation[] | undefined;
      const allSources = Object.values(sources).flat();
      if (allSources.length > 0) {
        citations = allSources.slice(0, 5).map((s) => ({
          title: s.title || s.source_name || s.url || 'Untitled',
          url: s.url || '#',
          source_tier: s.source_tier,
          snippet: s.snippet || undefined,
        }));
      }

      const assistantMsg: ConversationMessage = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: response.content,
        timestamp: new Date().toISOString(),
        thinkingStages: stages,
        provider: response.provider,
        model: response.model,
        isMock: response.isMock,
        citations,
        executiveId: contactId,
        executiveName: contact.name,
      };
      setMessages((m) => [...m, assistantMsg]);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Unknown error';
      const errorMsg: ConversationMessage = {
        id: `e-${Date.now()}`,
        role: 'assistant',
        content: `I encountered an error: ${errMsg}. Please try again.`,
        timestamp: new Date().toISOString(),
      };
      setMessages((m) => [...m, errorMsg]);
    } finally {
      setProcessing(false);
      setThinkingStages([]);
    }
  }, [processing, contact, brief, contactId, sources]);

  return (
    <div className="flex flex-col h-full">
      <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-thin space-y-3 pr-1">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary mb-3">
              <Sparkles className="h-6 w-6" />
            </div>
            <p className="text-sm font-medium mb-1">Ask DEL about this executive</p>
            <p className="text-xs text-muted-foreground mb-4 max-w-sm">
              Use the generated intelligence to ask questions, draft emails, or explore risks.
            </p>
            <div className="flex flex-wrap gap-2 justify-center max-w-lg">
              {EXEC_CHAT_PROMPTS.map((prompt, i) => (
                <button
                  key={i}
                  onClick={() => handleSend(prompt.prompt)}
                  disabled={processing}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted hover:border-primary/30 transition-colors disabled:opacity-50"
                >
                  <prompt.icon className="h-3.5 w-3.5 text-primary" />
                  {prompt.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg) => (
              <div key={msg.id} className={cn('flex gap-3 animate-slide-up', msg.role === 'user' && 'flex-row-reverse')}>
                <div className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                  msg.role === 'assistant' ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'
                )}>
                  {msg.role === 'assistant' ? <Sparkles className="h-4 w-4" /> : <span className="text-xs font-semibold">You</span>}
                </div>
                <div className={cn('flex-1 min-w-0', msg.role === 'user' && 'flex justify-end')}>
                  <div className={cn(
                    'inline-block rounded-2xl px-4 py-3 text-sm leading-relaxed max-w-[85%]',
                    msg.role === 'assistant'
                      ? 'bg-card border border-border text-foreground rounded-tl-sm'
                      : 'bg-primary text-primary-foreground rounded-tr-sm'
                  )}>
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                    {msg.citations && msg.citations.length > 0 && (
                      <div className="mt-2 space-y-1">
                        <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Sources</div>
                        {msg.citations.map((cite, i) => (
                          <a key={i} href={cite.url} target="_blank" rel="noopener noreferrer" className="flex items-start gap-1.5 text-xs text-primary hover:underline">
                            <ExternalLink className="h-3 w-3 mt-0.5 shrink-0" />
                            <span className="truncate">{cite.title}</span>
                          </a>
                        ))}
                      </div>
                    )}
                    {msg.provider && (
                      <div className="mt-2 flex items-center gap-1 text-[10px] text-muted-foreground/50">
                        {msg.provider}{msg.model ? ` · ${msg.model}` : ''}
                        {msg.isMock && <span className="text-amber-500"> · mock</span>}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {processing && (
              <div className="flex gap-3 animate-slide-up">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div className="flex items-center gap-2 pt-2">
                  <Loader2 className="h-4 w-4 text-primary animate-spin" />
                  <span className="text-sm text-muted-foreground">DEL is thinking...</span>
                </div>
              </div>
            )}
          </>
        )}
      </div>
      <div className="border-t border-border pt-3 mt-2">
        <div className="relative flex-1">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend(input);
              }
            }}
            disabled={processing}
            placeholder="Ask DEL about this executive..."
            rows={1}
            className="w-full resize-none rounded-xl border border-border bg-card px-4 py-3 pr-12 text-sm leading-relaxed placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 disabled:opacity-60 scrollbar-thin"
            style={{ maxHeight: '120px' }}
          />
          <button
            onClick={() => handleSend(input)}
            disabled={processing || !input.trim()}
            className="absolute bottom-2.5 right-2.5 flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            aria-label="Send"
          >
            {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
