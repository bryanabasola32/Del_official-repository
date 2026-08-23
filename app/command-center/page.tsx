'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Sparkles, Brain, RefreshCw, FileText, Mail, Target,
  Loader2,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/AuthProvider';
import { useConversationContext } from '@/components/ConversationProvider';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import {
  AIPromptInput,
  ConversationBubble,
  SuggestedPromptCard,
  type ConversationMessage,
  type ConversationAction,
  type Citation,
} from '@/components/intelligence';
import type { AnalysisTabData, ExecutiveAccordionContext } from '@/components/intelligence';
import { getIntelligenceRouter } from '@/services/router';
import type { RouterTask } from '@/services/router';
import { orchestrator, generateExecutiveIntelligence } from '@/services/orchestrator';
import { detectIntent, getStagesForIntent, type ThinkingStage, type DetectedIntent } from '@/services/intentDetector';
import { getExecutiveResolver } from '@/services/identity';
import { loadReport } from '@/services/intelligencePipeline';
import type { ExecutiveIntelligenceReport } from '@/services/intelligence';
import { buildMasterExecutiveBrief, toPromptContext } from '@/services/masterExecutiveBrief';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { Contact, PersonaFact, Source, EventItem, IntelligenceRecommendation } from '@/lib/types';

const SUGGESTED_PROMPTS = [
  { icon: Brain, label: 'Research an executive', prompt: 'Research Fabian Dee' },
  { icon: Target, label: 'Recommend events for an executive', prompt: 'Recommend suitable events for Maria Santos' },
  { icon: RefreshCw, label: 'Refresh outdated intelligence', prompt: 'Refresh outdated executive intelligence' },
  { icon: FileText, label: 'Summarize recent intelligence', prompt: 'Summarize recent company intelligence' },
  { icon: Mail, label: 'Generate invitation drafts', prompt: 'Generate invitation drafts for top-scored executives' },
];

interface ExecutiveContext {
  contact: Contact;
  facts: PersonaFact[];
  sources: Source[];
  recommendations: (IntelligenceRecommendation & { event: EventItem | null })[];
  report: ExecutiveIntelligenceReport | null;
}

function buildSystemPrompt(context: {
  contactsCount: number;
  eventsCount: number;
  pendingCount: number;
  recentActivity: string[];
  upcomingEvents: string[];
  topExecutives: string[];
}): string {
  return `You are DEL Intelligence, an AI assistant for an executive event management platform called DEL (Delaware Leadership). You help users manage executives, events, intelligence generation, and invitation drafting.

Your capabilities:
- Generate executive intelligence profiles (personas, pain points, recommendations)
- Recommend executives for events using a weighted scoring rubric
- Draft personalized invitations referencing verified facts
- Summarize research activity and intelligence reports
- Analyze companies and strategic opportunities
- Explain why executives are high-priority leads

Current system state:
- Total executives: ${context.contactsCount}
- Total events: ${context.eventsCount}
- Executives pending intelligence: ${context.pendingCount}
- Upcoming events: ${context.upcomingEvents.length > 0 ? context.upcomingEvents.join('; ') : 'None'}
- Top executives by score: ${context.topExecutives.length > 0 ? context.topExecutives.join('; ') : 'None yet'}
- Recent activity: ${context.recentActivity.length > 0 ? context.recentActivity.join('; ') : 'None'}

You are an executive intelligence analyst. Ground every answer in the specific evidence and reports generated for the contact. State conclusions plainly — do not narrate your own process. When the user asks about specific executives or events, reference the system state and the executive intelligence context provided below. You CAN research executives and generate intelligence directly from this chat — do NOT tell the user to navigate to another page unless they explicitly ask to perform a UI action like importing data or creating an event. If intelligence context is provided above, use it to answer the user's question directly.`;
}

function buildConversationHistory(messages: ConversationMessage[]): string {
  if (messages.length === 0) return '';
  const recent = messages.slice(-10);
  const lines = recent.map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`);
  return `\n\nConversation history:\n${lines.join('\n')}`;
}

function parseAIResponse(content: string): { content: string; sections?: { type: 'summary' | 'key_findings' | 'recommendations' | 'reliability' | 'evidence'; title: string; items: string[] }[] } {
  const sections: { type: 'summary' | 'key_findings' | 'recommendations' | 'reliability' | 'evidence'; title: string; items: string[] }[] = [];
  const lines = content.split('\n').filter((l) => l.trim());
  let currentSection: { type: 'summary' | 'key_findings' | 'recommendations' | 'reliability' | 'evidence'; title: string; items: string[] } | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (/^(summary|key findings|recommendations?|reliability|evidence|findings?):?$/i.test(trimmed) ||
        /^(summary|key findings|recommendations?|reliability|evidence|findings?)\s*:/i.test(trimmed)) {
      if (currentSection) sections.push(currentSection);
      const title = trimmed.replace(/:$/, '').replace(/^\w/, (c) => c.toUpperCase());
      const typeMap: Record<string, 'summary' | 'key_findings' | 'recommendations' | 'reliability' | 'evidence'> = {
        'summary': 'summary', 'key findings': 'key_findings', 'findings': 'key_findings',
        'recommendation': 'recommendations', 'recommendations': 'recommendations',
        'reliability': 'reliability', 'evidence': 'evidence',
      };
      const lowerTitle = title.toLowerCase();
      currentSection = { type: typeMap[lowerTitle] || 'summary', title, items: [] };
    } else if (/^[•\-*]\s+/.test(trimmed) || /^\d+\.\s+/.test(trimmed)) {
      const item = trimmed.replace(/^[•\-*]\s+/, '').replace(/^\d+\.\s+/, '');
      if (currentSection) {
        currentSection.items.push(item);
      }
    }
  }
  if (currentSection) sections.push(currentSection);
  return { content, sections: sections.length > 0 ? sections : undefined };
}

export default function CommandCenterPage() {
  return (
    <ProtectedRoute>
      <CommandCenterContent />
    </ProtectedRoute>
  );
}

function CommandCenterContent() {
  const router = useRouter();
  const { user } = useAuth();
  const {
    conversations,
    activeConversationId,
    messages,
    messagesLoading,
    setMessages,
    selectConversation,
    createConversation,
    addMessage,
    updateConversationTitle,
  } = useConversationContext();

  const [inputValue, setInputValue] = useState('');
  const [processing, setProcessing] = useState(false);
  const [activeThinkingStages, setActiveThinkingStages] = useState<ThinkingStage[]>([]);
  const [activeProvider, setActiveProvider] = useState<string | undefined>();
  const [activeModel, setActiveModel] = useState<string | undefined>();
  const [activeExecTime, setActiveExecTime] = useState<number | undefined>();
  const [activeCacheHit, setActiveCacheHit] = useState<boolean | undefined>();
  const [executiveContext, setExecutiveContext] = useState<ExecutiveContext | null>(null);
  const [lastAssistantId, setLastAssistantId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef<ConversationMessage[]>([]);
  const activeConvRef = useRef<string | null>(null);
  const sessionIdRef = useRef<string>(`session-${Date.now()}`);
  const activeExecutiveRef = useRef<{ id: string; name: string } | null>(null);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    activeConvRef.current = activeConversationId;
  }, [activeConversationId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    orchestrator.ensureProvidersRegistered();
  }, []);

  const handleNewChat = useCallback(() => {
    selectConversation(null);
    setActiveThinkingStages([]);
    setExecutiveContext(null);
    setInputValue('');
    setLastAssistantId(null);
    activeExecutiveRef.current = null;
  }, [selectConversation]);

  const advanceStage = useCallback((stages: ThinkingStage[], index: number) => {
    return new Promise<void>((resolve) => {
      setActiveThinkingStages((prev) => {
        const updated = [...prev];
        if (updated[index]) {
          updated[index] = { ...updated[index], status: 'running', timestamp: Date.now() };
        }
        return updated;
      });
      setTimeout(() => {
        setActiveThinkingStages((prev) => {
          const updated = [...prev];
          if (updated[index]) {
            updated[index] = { ...updated[index], status: 'completed', timestamp: Date.now() };
          }
          return updated;
        });
        resolve();
      }, 300 + Math.random() * 200);
    });
  }, []);

  const findExecutiveByName = useCallback(async (name: string, companyName?: string | null): Promise<Contact | null> => {
    const resolver = getExecutiveResolver();
    const result = await resolver.resolve(name, {
      companyName: companyName ?? undefined,
      activeExecutiveId: activeExecutiveRef.current?.id ?? undefined,
    });
    if (result.ambiguous) {
      return null;
    }
    return result.contact;
  }, []);

  const loadExecutiveContext = useCallback(async (contactId: string): Promise<ExecutiveContext> => {
    const { data: contact } = await supabase.from('contacts').select('*').eq('id', contactId).maybeSingle();
    const [factsRes, recsRes] = await Promise.all([
      supabase.from('persona_facts').select('*').eq('contact_id', contactId).order('order_index'),
      supabase.from('intelligence_recommendations').select('*, event:events(*)').eq('contact_id', contactId).order('suitability_score', { ascending: false }),
    ]);
    const factIds = (factsRes.data || []).map((f) => f.id);
    let sources: Source[] = [];
    if (factIds.length > 0) {
      const { data: srcData } = await supabase.from('sources').select('*').in('persona_fact_id', factIds);
      sources = srcData || [];
    }
    const report = await loadReport<ExecutiveIntelligenceReport>(contactId, 'executive');
    return {
      contact: contact as Contact,
      facts: factsRes.data || [],
      sources,
      recommendations: (recsRes.data || []) as (IntelligenceRecommendation & { event: EventItem | null })[],
      report,
    };
  }, []);

  const handleSend = useCallback(async (text: string) => {
    if (!text.trim() || processing) return;

    let convId = activeConvRef.current;
    if (!convId) {
      convId = await createConversation(text.substring(0, 50));
      if (!convId) {
        toast.error('Failed to create conversation');
        return;
      }
    }

    const userMsg: ConversationMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    };
    setMessages((m) => [...m, userMsg]);
    await addMessage(convId, userMsg);
    setProcessing(true);

    const response = await processCommand(text, convId);
    setProcessing(false);

    const assistantId = `a-${Date.now()}`;
    const assistantMsg: ConversationMessage = {
      id: assistantId,
      role: 'assistant',
      content: response.content,
      timestamp: new Date().toISOString(),
      thinkingStages: activeThinkingStages,
      provider: response.provider,
      model: response.model,
      isMock: response.isMock,
      citations: response.citations,
      responseCard: response.responseCard,
      actions: response.actions,
      executiveId: response.executiveId,
      executiveName: response.executiveName,
      executionTimeMs: activeExecTime,
      cacheHit: activeCacheHit,
    };
    setMessages((m) => [...m, assistantMsg]);
    await addMessage(convId, assistantMsg);
    setLastAssistantId(assistantId);

    if (response.executiveId) {
      const ctx = await loadExecutiveContext(response.executiveId);
      setExecutiveContext(ctx);
    }

    if (!activeConvRef.current || activeConvRef.current !== convId) return;
    if (messagesRef.current.length <= 2) {
      await updateConversationTitle(convId, text.substring(0, 60));
    }
  }, [processing, createConversation, addMessage, activeThinkingStages, loadExecutiveContext, updateConversationTitle, activeExecTime, activeCacheHit]);

  const processCommand = useCallback(async (text: string, _convId: string): Promise<{
    content: string;
    provider?: string;
    model?: string;
    isMock?: boolean;
    citations?: Citation[];
    responseCard?: { sections: { type: 'summary' | 'key_findings' | 'recommendations' | 'reliability' | 'evidence'; title: string; items: string[] }[] };
    actions?: ConversationAction[];
    executiveId?: string;
    executiveName?: string;
  }> => {
    const intent = detectIntent(text, {
      activeExecutiveName: activeExecutiveRef.current?.name ?? null,
    });

    let existingContact: Contact | null = null;
    let hasExistingIntelligence = false;

    if (intent.executiveName) {
      existingContact = await findExecutiveByName(intent.executiveName, intent.companyName);
      if (existingContact) {
        hasExistingIntelligence = existingContact.persona_status === 'completed' &&
          (existingContact.persona_type !== null || existingContact.executive_summary !== null);
      }
    }

    const stages = getStagesForIntent(intent, hasExistingIntelligence);
    setActiveThinkingStages(stages);

    await advanceStage(stages, 0);
    await advanceStage(stages, 1);

    let cacheHit = false;

    if (hasExistingIntelligence && existingContact) {
      const cachedStageIdx = stages.findIndex((s) => s.key === 'cached');
      if (cachedStageIdx >= 0) {
        await advanceStage(stages, cachedStageIdx);
        cacheHit = true;
      }

      if (intent.type === 'research_executive') {
        const researchStageIdx = stages.findIndex((s) => s.key === 'research');
        if (researchStageIdx >= 0) {
          for (let i = researchStageIdx; i <= stages.findIndex((s) => s.key === 'trust'); i++) {
            if (i >= 0 && stages[i] && stages[i].key !== 'cached') {
              stages[i] = { ...stages[i], status: 'skipped' };
            }
          }
        }
      }
    } else if (intent.type === 'research_executive' && intent.executiveName) {
      const researchStageIdx = stages.findIndex((s) => s.key === 'research');
      if (researchStageIdx >= 0) {
        if (!existingContact) {
          const resolver = getExecutiveResolver();
          const resolveResult = await resolver.resolve(intent.executiveName, {
            companyName: intent.companyName ?? undefined,
            activeExecutiveId: activeExecutiveRef.current?.id ?? undefined,
          });
          if (resolveResult.ambiguous) {
            const names = resolveResult.candidates.map((c) => `${c.name} (${c.company})`).join(' or ');
            return {
              content: `I found multiple executives that could match "${intent.executiveName}": ${names}. Could you clarify which one you mean?`,
              actions: resolveResult.candidates.map((c) => ({ label: `Research ${c.name}`, href: `/intelligence/${c.id}` })),
            };
          }
          if (resolveResult.contact) {
            existingContact = resolveResult.contact;
          } else {
            const { data: newContact } = await supabase
              .from('contacts')
              .insert({ name: intent.executiveName, company: intent.companyName || '', import_status: 'manual' })
              .select()
              .maybeSingle();
            if (newContact) {
              existingContact = newContact as Contact;
            }
          }
        }

        let researchError: string | null = null;
        if (existingContact) {
          for (let i = researchStageIdx; i < stages.length; i++) {
            if (stages[i].key === 'prompt' || stages[i].key === 'routing' || stages[i].key === 'generating' || stages[i].key === 'citations' || stages[i].key === 'saving' || stages[i].key === 'complete') break;
            setActiveThinkingStages((prev) => {
              const updated = [...prev];
              if (updated[i]) updated[i] = { ...updated[i], status: 'running', timestamp: Date.now() };
              return updated;
            });
          }

          try {
            await generateExecutiveIntelligence(existingContact.id);
            // Re-fetch the contact to get updated persona_status, executive_summary, etc.
            const { data: refreshed } = await supabase
              .from('contacts')
              .select('*')
              .eq('id', existingContact.id)
              .maybeSingle();
            if (refreshed) {
              existingContact = refreshed as Contact;
              hasExistingIntelligence = existingContact.persona_status === 'completed' &&
                (existingContact.persona_type !== null || existingContact.executive_summary !== null);
            }
          } catch (err) {
            console.error('[DEL AI] Research pipeline error:', err);
            researchError = err instanceof Error ? err.message : 'Unknown research error';
          }

          for (let i = researchStageIdx; i < stages.length; i++) {
            if (stages[i].key === 'prompt' || stages[i].key === 'routing' || stages[i].key === 'generating' || stages[i].key === 'citations' || stages[i].key === 'saving' || stages[i].key === 'complete') break;
            const status = researchError ? 'skipped' : 'completed';
            setActiveThinkingStages((prev) => {
              const updated = [...prev];
              if (updated[i]) updated[i] = { ...updated[i], status, timestamp: Date.now() };
              return updated;
            });
          }
        }
      }
    }

    const promptStageIdx = stages.findIndex((s) => s.key === 'prompt');
    if (promptStageIdx >= 0) await advanceStage(stages, promptStageIdx);

    const routingStageIdx = stages.findIndex((s) => s.key === 'routing');
    if (routingStageIdx >= 0) await advanceStage(stages, routingStageIdx);

    const generatingStageIdx = stages.findIndex((s) => s.key === 'generating');
    if (generatingStageIdx >= 0) await advanceStage(stages, generatingStageIdx);

    const [
      { count: contactsCount },
      { count: eventsCount },
      { data: pendingContacts },
      { data: upcomingEvents },
      { data: activity },
      { data: topScored },
    ] = await Promise.all([
      supabase.from('contacts').select('*', { count: 'exact', head: true }),
      supabase.from('events').select('*', { count: 'exact', head: true }),
      supabase.from('contacts').select('id, name, title, company').in('persona_status', ['pending', 'needs_review']).limit(10),
      supabase.from('events').select('event_name, date').in('status', ['upcoming', 'active']).limit(5),
      supabase.from('activity_log').select('description, action_type, timestamp').order('timestamp', { ascending: false }).limit(5),
      supabase.from('event_scores').select('contact_id, total_score, contacts(name, title, company)').order('total_score', { ascending: false }).limit(5),
    ]);

    const recentActivity = (activity || []).map((a) => {
      const desc = (a as Record<string, unknown>).description || (a as Record<string, unknown>).action_type;
      const ts = (a as Record<string, unknown>).timestamp;
      const date = ts ? new Date(ts as string).toLocaleDateString() : '';
      return `${desc} (${date})`;
    });
    const upcomingEventNames = (upcomingEvents || []).map((e) => {
      const ev = e as Record<string, unknown>;
      const date = ev.date ? ` — ${new Date(ev.date as string).toLocaleDateString()}` : '';
      return `${ev.event_name}${date}`;
    });
    const topExecutives = (topScored || [])
      .filter((s) => (s as unknown as Record<string, unknown>).contacts)
      .map((s) => {
        const row = s as unknown as Record<string, unknown>;
        const contact = row.contacts as { name: string; company: string } | null;
        const score = typeof row.total_score === 'number' ? row.total_score : 0;
        return contact ? `${contact.name} (${contact.company}) — ${Math.round(score)}%` : '';
      })
      .filter(Boolean);

    const systemPrompt = buildSystemPrompt({
      contactsCount: contactsCount || 0,
      eventsCount: eventsCount || 0,
      pendingCount: pendingContacts?.length || 0,
      recentActivity,
      upcomingEvents: upcomingEventNames,
      topExecutives,
    });

    const conversationHistory = buildConversationHistory(messagesRef.current);

    let executiveContextStr = '';
    let researchJustCompleted = false;
    if (existingContact) {
      // If research just ran, check if it succeeded by looking at the refreshed contact
      if (intent.type === 'research_executive' && !intent.isFollowUp && existingContact.persona_status === 'completed') {
        researchJustCompleted = true;
      }
      try {
        const brief = await buildMasterExecutiveBrief(existingContact.id);
        if (brief.missing.length < 4) {
          executiveContextStr = `\n\nExecutive intelligence context:\nName: ${existingContact.name}\nTitle: ${existingContact.title || 'Unknown'}\nCompany: ${existingContact.company}\n\n${toPromptContext(brief)}`;
        } else if (researchJustCompleted || hasExistingIntelligence) {
          // Use the refreshed contact fields after research completed
          executiveContextStr = `\n\nExecutive intelligence context:\nName: ${existingContact.name}\nTitle: ${existingContact.title || 'Unknown'}\nCompany: ${existingContact.company}\nPersona Status: ${existingContact.persona_status}\nPersona Type: ${existingContact.persona_type || 'Not generated'}\nConfidence: ${existingContact.persona_confidence_pct || 'N/A'}%\nExecutive Summary: ${existingContact.executive_summary || 'Not available'}\nDecision Style: ${existingContact.decision_style || 'Not available'}\nTech Readiness: ${existingContact.tech_readiness_level || 'Not available'}`;
        } else {
          executiveContextStr = `\n\nExecutive context:\nName: ${existingContact.name}\nTitle: ${existingContact.title || 'Unknown'}\nCompany: ${existingContact.company}\nPersona Status: ${existingContact.persona_status}\nNote: Intelligence has not yet been generated for this executive. The user has requested research. If research was just attempted but failed, acknowledge the failure. Do not claim intelligence exists if it does not.`;
        }
      } catch (err) {
        console.error('[DEL AI] Failed to load master executive brief:', err);
        executiveContextStr = `\n\nExecutive context:\nName: ${existingContact.name}\nTitle: ${existingContact.title || 'Unknown'}\nCompany: ${existingContact.company}\nPersona Status: ${existingContact.persona_status}\nPersona Type: ${existingContact.persona_type || 'Not generated'}\nConfidence: ${existingContact.persona_confidence_pct || 'N/A'}%\nExecutive Summary: ${existingContact.executive_summary || 'Not available'}\nDecision Style: ${existingContact.decision_style || 'Not available'}\nTech Readiness: ${existingContact.tech_readiness_level || 'Not available'}`;
      }
    }

    let researchNote = '';
    if (intent.type === 'research_executive' && existingContact) {
      if (researchJustCompleted) {
        let planBNote = '';
        try {
          const { data: latestRun } = await supabase
            .from('analysis_runs')
            .select('metadata')
            .eq('contact_id', existingContact.id)
            .eq('status', 'completed')
            .order('completed_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          const meta = latestRun?.metadata as Record<string, unknown> | null;
          if (meta?.plan_b_used === true) {
            planBNote = `\n\nEVIDENCE SUFFICIENCY: Live research produced limited evidence (trust score ${meta.live_trust_score}). DEL supplemented it with curated executive evidence from the evidence library (library v${meta.curated_library_version}), improving the trust score to ${meta.final_trust_score}. ${meta.curated_source_count} curated sources and ${meta.curated_fact_count} curated facts were merged with the live evidence. Briefly mention that live research was supplemented with curated evidence.`;
          } else {
            planBNote = `\n\nEVIDENCE SUFFICIENCY: Live research produced sufficient evidence. Plan B (curated evidence fallback) was not needed.`;
          }
        } catch { /* best-effort */ }
        researchNote = `\n\nRESEARCH COMPLETED: The intelligence pipeline has finished processing ${existingContact.name}. Report the actual findings from the executive intelligence context above. Do NOT say the persona is pending. Do NOT tell the user to navigate elsewhere.${planBNote}`;
      } else if (intent.isFollowUp && hasExistingIntelligence) {
        researchNote = `\n\nThe user is asking a follow-up question about ${existingContact.name}, who has already been researched. Answer using the executive intelligence context provided above. Do NOT tell the user to navigate elsewhere.`;
      } else if (intent.isFollowUp && !hasExistingIntelligence) {
        researchNote = `\n\nThe user is asking a follow-up about ${existingContact.name}, but intelligence has not been successfully generated yet. Acknowledge this and offer to retry the research.`;
      }
    }

    const task: RouterTask = {
      taskType: intent.taskType,
      prompt: text + conversationHistory + executiveContextStr + researchNote,
      systemPrompt,
      context: {
        sessionId: sessionIdRef.current,
        intent: intent.type,
        executiveId: existingContact?.id,
        executiveName: existingContact?.name,
        contactsCount: contactsCount || 0,
        eventsCount: eventsCount || 0,
      },
      metadata: {
        sessionId: sessionIdRef.current,
        source: 'command-center',
        promptLength: text.length,
        messageCount: messagesRef.current.length,
        intent: intent.type,
      },
      temperature: 0.7,
      maxTokens: 2048,
    };

    const startTime = Date.now();
    let routerResponse;
    try {
      const router = getIntelligenceRouter();
      orchestrator.ensureProvidersRegistered();
      routerResponse = await router.execute(task);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Unknown error';
      console.error('[DEL AI] Router execution error:', errMsg);

      stages.forEach((s, i) => {
        if (s.status === 'pending') stages[i] = { ...s, status: 'skipped' };
      });
      const completeIdx = stages.findIndex((s) => s.key === 'complete');
      if (completeIdx >= 0) await advanceStage(stages, completeIdx);

      return {
        content: `I encountered an error while processing your request: ${errMsg}. Please try again or check the AI provider settings.`,
        actions: [{ label: 'Check Settings', href: '/settings' }],
      };
    }
    const duration = Date.now() - startTime;

    setActiveProvider(routerResponse.provider);
    setActiveModel(routerResponse.model);
    setActiveExecTime(routerResponse.executionTimeMs || duration);
    setActiveCacheHit(cacheHit);

    const citationsIdx = stages.findIndex((s) => s.key === 'citations');
    if (citationsIdx >= 0) await advanceStage(stages, citationsIdx);

    const savingIdx = stages.findIndex((s) => s.key === 'saving');
    if (savingIdx >= 0) await advanceStage(stages, savingIdx);

    const completeIdx = stages.findIndex((s) => s.key === 'complete');
    if (completeIdx >= 0) await advanceStage(stages, completeIdx);

    if (routerResponse.provider === 'router' && routerResponse.model === 'fallback') {
      const errors = routerResponse.errors || [];
      const allErrors = errors.join('; ');
      const hasConfigError = errors.some((e) => e.includes('not configured'));
      const hasAuthError = errors.some((e) => e.includes('401') || e.includes('403') || e.includes('auth'));
      const hasQuotaError = errors.some((e) => e.includes('429') || e.includes('quota'));
      const hasApiError = errors.some((e) => e.includes('API error') || e.includes('502') || e.includes('500'));

      let userMessage: string;
      if (hasQuotaError) {
        userMessage = `AI provider quota exhausted. Gemini returned a rate limit error (429 RESOURCE_EXHAUSTED). The free-tier daily quota has been reached. Please upgrade your Google AI plan or wait for the quota to reset, then try again.`;
      } else if (hasAuthError) {
        userMessage = `AI provider authentication failed. The API keys configured in Supabase Edge Function Secrets appear to be invalid or expired. Please verify your keys and try again.`;
      } else if (hasApiError) {
        const apiError = errors.find((e) => e.includes('API error') || e.includes('502') || e.includes('500')) || errors[0];
        userMessage = `AI provider request failed: ${apiError}. I tried OpenAI, Gemini, and Anthropic. Please check the Diagnostics panel in Settings for details.`;
      } else if (hasConfigError) {
        userMessage = `No AI provider is configured. I tried OpenAI, Gemini, and Anthropic — all returned configuration errors. Please add at least one API key (OPENAI_API_KEY, GEMINI_API_KEY, or ANTHROPIC_API_KEY) in your Supabase Edge Function Secrets, then try again.`;
      } else {
        userMessage = `All AI providers failed: ${allErrors}. I tried OpenAI, Gemini, and Anthropic. Please check the Diagnostics panel in Settings for details.`;
      }

      return {
        content: userMessage,
        actions: [{ label: 'Check Settings', href: '/settings' }],
      };
    }

    const parsed = parseAIResponse(routerResponse.content);
    const actions = buildActionsForIntent(intent);

    let citations: Citation[] | undefined;
    if (existingContact) {
      const ctx = await loadExecutiveContext(existingContact.id);
      if (ctx.sources.length > 0) {
        citations = ctx.sources.slice(0, 5).map((s) => ({
          title: s.title || s.source_name || s.url || 'Untitled',
          url: s.url || '#',
          source_tier: s.source_tier,
          snippet: s.snippet || undefined,
        }));
      }
    }

    // Update active executive context for follow-up messages
    if (existingContact) {
      activeExecutiveRef.current = { id: existingContact.id, name: existingContact.name };
    }

    return {
      content: parsed.content,
      provider: routerResponse.provider,
      model: routerResponse.model,
      isMock: routerResponse.isMock,
      citations,
      responseCard: parsed.sections ? { sections: parsed.sections } : undefined,
      actions,
      executiveId: existingContact?.id,
      executiveName: existingContact?.name,
    };
  }, [advanceStage, findExecutiveByName, loadExecutiveContext]);

  function buildActionsForIntent(intent: DetectedIntent): ConversationAction[] {
    const actions: ConversationAction[] = [];
    if (intent.type === 'research_executive' || intent.type === 'refresh_intelligence') {
      actions.push({ label: 'View Executives', href: '/executives' });
      actions.push({ label: 'View Intelligence', href: '/intelligence' });
    }
    if (intent.type === 'recommend_events') {
      actions.push({ label: 'View Events', href: '/events' });
    }
    if (intent.type === 'generate_invitation') {
      actions.push({ label: 'View Invitations', href: '/invites' });
    }
    if (intent.type === 'summarize_intelligence') {
      actions.push({ label: 'View Reports', href: '/reports' });
    }
    return actions;
  }

  const handleAction = (action: ConversationAction) => {
    if (action.href) {
      router.push(action.href);
    } else if (action.onClick) {
      action.onClick();
    }
  };

  const handleNavigate = useCallback((href: string) => {
    router.push(href);
  }, [router]);

  const hasConversation = messages.length > 0;

  // Build analysis data for the most recent assistant message
  const buildAnalysisData = (msg: ConversationMessage): AnalysisTabData | undefined => {
    if (msg.role !== 'assistant') return undefined;

    let execCtx: ExecutiveAccordionContext | undefined;
    if (executiveContext && msg.executiveId === executiveContext.contact.id) {
      execCtx = executiveContext;
    }

    return {
      thinkingStages: msg.thinkingStages,
      provider: msg.provider,
      model: msg.model,
      executionTimeMs: msg.executionTimeMs,
      cacheHit: msg.cacheHit,
      executiveContext: execCtx,
      citations: msg.citations,
    };
  };

  // For the latest assistant message, use live state (stages animate in real-time)
  const buildLiveAnalysisData = (msg: ConversationMessage): AnalysisTabData | undefined => {
    if (msg.role !== 'assistant') return undefined;
    if (msg.id !== lastAssistantId) return buildAnalysisData(msg);

    return {
      thinkingStages: activeThinkingStages,
      provider: activeProvider,
      model: activeModel,
      executionTimeMs: activeExecTime,
      cacheHit: activeCacheHit,
      executiveContext: executiveContext ?? undefined,
      citations: msg.citations,
    };
  };

  return (
    <div className="flex h-[calc(100vh-3.5rem)] overflow-hidden">
      {/* Full-width conversation area — no side panels */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Conversation area */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-thin">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            {!hasConversation && !messagesLoading ? (
              <div className="pt-12 pb-8">
                <div className="flex flex-col items-center text-center mb-8">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-4 transition-all hover:scale-105">
                    <Sparkles className="h-8 w-8" />
                  </div>
                  <h1 className="text-3xl font-bold tracking-tight text-foreground mb-3">DEL Intelligence</h1>
                  <p className="text-sm text-muted-foreground max-w-xl leading-relaxed">
                    Research executives, generate AI personas, recommend event attendees, analyze companies, and draft personalized invitations — all from one AI workspace.
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground/60 mb-4 text-center">
                    Suggested Prompts
                  </p>
                  <SuggestedPromptCard
                    prompts={SUGGESTED_PROMPTS}
                    onSelect={(prompt) => setInputValue(prompt)}
                  />
                </div>
              </div>
            ) : messagesLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-6 w-6 text-muted-foreground animate-spin" />
              </div>
            ) : (
              <div className="py-8 space-y-6">
                {messages.map((msg) => (
                  <ConversationBubble
                    key={msg.id}
                    message={msg}
                    onAction={handleAction}
                    analysisData={buildLiveAnalysisData(msg)}
                    onNavigate={handleNavigate}
                  />
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
              </div>
            )}
          </div>
        </div>

        {/* Command bar */}
        <div className="border-t border-border bg-card/80 backdrop-blur-sm px-4 sm:px-6 lg:px-8 py-4">
          <div className="max-w-3xl mx-auto">
            <AIPromptInput
              onSend={handleSend}
              disabled={processing}
              value={inputValue}
              onChange={setInputValue}
              placeholder="Ask DEL to research executives, analyze events, generate invitations, or create reports..."
            />
            <p className="text-[10px] text-muted-foreground/50 text-center mt-2">
              DEL AI assists with research and recommendations. You make the final decisions.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
