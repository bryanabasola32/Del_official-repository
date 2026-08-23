'use client';

import { useState, useRef, useEffect } from 'react';
import {
  Brain, User as UserIcon, Shield, FileText, ChevronDown,
  ExternalLink, Cpu, TrendingUp, Target, Award, Loader2, CheckCircle2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { ThinkingStage } from '@/services/intentDetector';
import type { Citation } from './ConversationBubble';
import type { Contact, PersonaFact, Source, EventItem, IntelligenceRecommendation } from '@/lib/types';
import type { ExecutiveIntelligenceReport } from '@/services/intelligence';

export interface ExecutiveAccordionContext {
  contact: Contact;
  facts: PersonaFact[];
  sources: Source[];
  recommendations: (IntelligenceRecommendation & { event: EventItem | null })[];
  report: ExecutiveIntelligenceReport | null;
}

export interface AnalysisTabData {
  thinkingStages?: ThinkingStage[];
  provider?: string;
  model?: string;
  executionTimeMs?: number;
  cacheHit?: boolean;
  executiveContext?: ExecutiveAccordionContext | null;
  citations?: Citation[];
}

type TabKey = 'thinking' | 'executive' | 'sources' | 'reports';

const TAB_CONFIG: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: 'thinking', label: 'Thinking', icon: Brain },
  { key: 'executive', label: 'Executive', icon: UserIcon },
  { key: 'sources', label: 'Sources', icon: Shield },
  { key: 'reports', label: 'Report', icon: FileText },
];

export function ResponseAnalysisAccordion({ data, onNavigate }: { data: AnalysisTabData; onNavigate?: (href: string) => void }) {
  const [openTab, setOpenTab] = useState<TabKey | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState<number | undefined>(undefined);

  const availableTabs = TAB_CONFIG.filter((tab) => {
    if (tab.key === 'thinking') return data.thinkingStages && data.thinkingStages.length > 0;
    if (tab.key === 'executive') return !!data.executiveContext;
    if (tab.key === 'sources') return (data.citations && data.citations.length > 0) || (data.executiveContext && data.executiveContext.sources.length > 0);
    if (tab.key === 'reports') return !!data.executiveContext;
    return false;
  });

  const handleToggle = (tab: TabKey) => {
    if (openTab === tab) {
      setIsAnimating(true);
      setContentHeight(0);
      setTimeout(() => {
        setOpenTab(null);
        setIsAnimating(false);
        setContentHeight(undefined);
      }, 200);
    } else {
      setIsAnimating(true);
      setOpenTab(tab);
      setTimeout(() => {
        if (contentRef.current) {
          setContentHeight(contentRef.current.scrollHeight);
        }
        setIsAnimating(false);
      }, 10);
    }
  };

  useEffect(() => {
    if (openTab && contentRef.current && !isAnimating) {
      setContentHeight(contentRef.current.scrollHeight);
    }
  }, [openTab, isAnimating]);

  if (availableTabs.length === 0) return null;

  return (
    <div className="mt-3 border-t border-border/50 pt-3">
      <div className="flex flex-wrap gap-1.5">
        {availableTabs.map((tab) => {
          const Icon = tab.icon;
          const isOpen = openTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => handleToggle(tab.key)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all',
                isOpen
                  ? 'bg-primary/10 text-primary border border-primary/20'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50 border border-transparent',
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
              <ChevronDown className={cn('h-3 w-3 transition-transform duration-200', isOpen && 'rotate-180')} />
            </button>
          );
        })}
      </div>

      <div
        className="overflow-hidden transition-all duration-200 ease-out"
        style={{ maxHeight: openTab ? (isAnimating ? (contentHeight !== undefined ? `${contentHeight}px` : '1000px') : `${contentHeight || 1000}px`) : '0px' }}
      >
        <div ref={contentRef} className="pt-3 pb-1">
          {openTab === 'thinking' && data.thinkingStages && (
            <ThinkingAccordionContent
              stages={data.thinkingStages}
              provider={data.provider}
              model={data.model}
              executionTimeMs={data.executionTimeMs}
              cacheHit={data.cacheHit}
            />
          )}
          {openTab === 'executive' && data.executiveContext && (
            <ExecutiveAccordionContent context={data.executiveContext} onNavigate={onNavigate} />
          )}
          {openTab === 'sources' && (
            <SourcesAccordionContent citations={data.citations} context={data.executiveContext} />
          )}
          {openTab === 'reports' && data.executiveContext && (
            <ReportsAccordionContent context={data.executiveContext} onNavigate={onNavigate} />
          )}
        </div>
      </div>
    </div>
  );
}

function ThinkingAccordionContent({
  stages, provider, model, executionTimeMs, cacheHit,
}: {
  stages: ThinkingStage[];
  provider?: string;
  model?: string;
  executionTimeMs?: number;
  cacheHit?: boolean;
}) {
  const completedCount = stages.filter((s) => s.status === 'completed').length;
  const totalCount = stages.length;
  const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  return (
    <div className="rounded-lg bg-muted/30 border border-border/50 p-3 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-semibold">Pipeline Progress</span>
        </div>
        <span className="text-[10px] text-muted-foreground tabular-nums">{completedCount}/{totalCount} steps</span>
      </div>
      <div className="h-1 bg-muted rounded-full overflow-hidden">
        <div className="h-full bg-primary transition-all duration-500 ease-out" style={{ width: `${progress}%` }} />
      </div>
      <div className="space-y-1">
        {stages.map((stage, index) => (
          <div
            key={stage.key}
            className={cn(
              'flex items-start gap-2 py-1 transition-opacity duration-300',
              stage.status === 'pending' && 'opacity-40',
              stage.status === 'skipped' && 'opacity-30',
            )}
            style={{ transitionDelay: `${index * 30}ms` }}
          >
            <div className="mt-0.5 shrink-0">
              {stage.status === 'completed' ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
              ) : stage.status === 'running' ? (
                <Loader2 className="h-3.5 w-3.5 text-primary animate-spin" />
              ) : stage.status === 'skipped' ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground/30" />
              ) : (
                <div className="h-3.5 w-3.5 rounded-full border-2 border-muted-foreground/20" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <span className={cn('text-xs', stage.status === 'completed' ? 'text-foreground' : 'text-muted-foreground')}>
                {stage.label}
              </span>
              {stage.detail && <p className="text-[10px] text-muted-foreground/70 mt-0.5">{stage.detail}</p>}
            </div>
          </div>
        ))}
      </div>
      {(provider || model || executionTimeMs !== undefined) && (
        <div className="flex flex-wrap gap-3 pt-2 border-t border-border/50 text-[10px]">
          {provider && (
            <div className="flex items-center gap-1">
              <Cpu className="h-3 w-3 text-muted-foreground" />
              <span className="text-muted-foreground">Provider:</span>
              <span className="font-medium text-foreground">{provider}</span>
            </div>
          )}
          {model && (
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground">Model:</span>
              <span className="font-medium text-foreground">{model}</span>
            </div>
          )}
          {executionTimeMs !== undefined && (
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground">Duration:</span>
              <span className="font-medium text-foreground tabular-nums">
                {executionTimeMs < 1000 ? `${executionTimeMs}ms` : `${(executionTimeMs / 1000).toFixed(1)}s`}
              </span>
            </div>
          )}
          {cacheHit !== undefined && (
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground">Cache:</span>
              <span className={cn('font-medium', cacheHit ? 'text-emerald-500' : 'text-amber-500')}>
                {cacheHit ? 'Hit' : 'Miss'}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ExecutiveAccordionContent({ context, onNavigate }: { context: ExecutiveAccordionContext; onNavigate?: (href: string) => void }) {
  const { contact, facts, recommendations, report } = context;
  const initials = contact.name.split(' ').map((n) => n[0]).slice(0, 2).join('');

  return (
    <div className="rounded-lg bg-muted/30 border border-border/50 p-3 space-y-3">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary text-sm font-semibold shrink-0">
          {initials}
        </div>
        <div className="min-w-0">
          <h4 className="text-sm font-bold truncate">{contact.name}</h4>
          <p className="text-xs text-muted-foreground truncate">{contact.title || 'No position'}</p>
          <p className="text-xs text-muted-foreground truncate">{contact.company}</p>
        </div>
      </div>

      {contact.persona_type && (
        <div>
          <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Persona Type</div>
          <Badge className="bg-primary/10 text-primary border-primary/20">{contact.persona_type}</Badge>
        </div>
      )}

      {contact.executive_summary && (
        <div>
          <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Executive Summary</div>
          <p className="text-xs leading-relaxed">{contact.executive_summary}</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Decision Style</div>
          <p className="text-xs">{contact.decision_style || '—'}</p>
        </div>
        <div>
          <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Tech Readiness</div>
          <p className="text-xs">{contact.tech_readiness_level || '—'}</p>
        </div>
        <div>
          <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Confidence</div>
          <p className="text-xs font-medium">{contact.persona_confidence_pct ? `${contact.persona_confidence_pct}%` : '—'}</p>
        </div>
        <div>
          <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Decision Role</div>
          <p className="text-xs capitalize">{contact.decision_making_role.replace(/-/g, ' ')}</p>
        </div>
      </div>

      {facts.length > 0 && (
        <div>
          <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">Extracted Facts</div>
          <div className="space-y-1.5">
            {facts.slice(0, 5).map((fact) => (
              <div key={fact.id} className="rounded-lg bg-muted/40 p-2">
                <Badge className="text-[9px] px-1.5 py-0 mb-1">{fact.field_type.replace(/_/g, ' ')}</Badge>
                <p className="text-xs leading-relaxed">{fact.value}</p>
              </div>
            ))}
            {facts.length > 5 && <p className="text-[10px] text-muted-foreground">+ {facts.length - 5} more</p>}
          </div>
        </div>
      )}

      {report?.opportunities && report.opportunities.length > 0 && (
        <div>
          <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
            <TrendingUp className="h-3 w-3" /> Opportunities
          </div>
          <div className="space-y-2">
            {report.opportunities.slice(0, 3).map((opp, i) => (
              <div key={i} className="rounded-lg border border-border p-2.5">
                <p className="text-xs">{opp.value}</p>
                <div className="flex items-center gap-1 mt-1">
                  <Badge variant="outline" className="text-[9px]">{opp.confidence}%</Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {recommendations.length > 0 && (
        <div>
          <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
            <Target className="h-3 w-3" /> Recommendations
          </div>
          <div className="space-y-2">
            {recommendations.slice(0, 3).map((rec) => (
              <div key={rec.id} className="rounded-lg border border-border p-2.5">
                <p className="text-xs font-medium truncate">{rec.event?.event_name || 'Unknown'}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Score: {rec.suitability_score}%</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {onNavigate && (
        <Button variant="outline" size="sm" className="w-full" onClick={() => onNavigate(`/executives/${contact.id}`)}>
          View Full Profile
        </Button>
      )}
    </div>
  );
}

function SourcesAccordionContent({ citations, context }: { citations?: Citation[]; context?: ExecutiveAccordionContext | null }) {
  const allSources: { title: string; url: string; source_tier?: number; snippet?: string }[] = [];

  if (citations && citations.length > 0) {
    allSources.push(...citations);
  }
  if (context && context.sources.length > 0) {
    for (const src of context.sources) {
      if (!allSources.find((s) => s.url === src.url)) {
        allSources.push({
          title: src.title || src.source_name || src.url || 'Untitled',
          url: src.url || '#',
          source_tier: src.source_tier,
          snippet: src.snippet || undefined,
        });
      }
    }
  }

  if (allSources.length === 0) {
    return (
      <div className="rounded-lg bg-muted/30 border border-border/50 p-4 text-center">
        <Shield className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
        <p className="text-xs text-muted-foreground">No sources available for this response</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg bg-muted/30 border border-border/50 p-3 space-y-2">
      <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1">
        <Award className="h-3 w-3" /> Research Sources ({allSources.length})
      </div>
      {allSources.map((src, i) => (
        <div key={i} className="rounded-lg border border-border p-2.5 hover:bg-muted/20 transition-colors">
          <div className="flex items-start gap-2">
            {src.source_tier !== undefined && (
              <span className={cn(
                'inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] font-medium shrink-0',
                src.source_tier === 1 ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800' :
                src.source_tier === 2 ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800' :
                'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800/50 dark:text-slate-400 dark:border-slate-700'
              )}>
                Tier {src.source_tier}
              </span>
            )}
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium truncate">{src.title}</div>
              {src.snippet && <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{src.snippet}</p>}
              {src.url && src.url !== '#' && (
                <a href={src.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-0.5 text-[10px] text-primary hover:underline mt-1">
                  <ExternalLink className="h-2.5 w-2.5" />
                  Source link
                </a>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ReportsAccordionContent({ context, onNavigate }: { context: ExecutiveAccordionContext; onNavigate?: (href: string) => void }) {
  const { contact, report, recommendations } = context;
  const reports: { title: string; type: string; date: string; status: 'ready' | 'pending' }[] = [];

  if (contact.executive_summary) {
    reports.push({ title: 'Executive Intelligence Report', type: 'executive', date: contact.last_researched_date || contact.updated_at, status: 'ready' });
  }
  if (report) {
    reports.push({ title: 'Strategic Analysis Report', type: 'strategic', date: contact.last_researched_date || contact.updated_at, status: 'ready' });
  }
  if (recommendations.length > 0) {
    reports.push({ title: 'Event Recommendations', type: 'recommendations', date: recommendations[0].created_at, status: 'ready' });
  }
  if (contact.persona_status !== 'completed') {
    reports.push({ title: 'Intelligence Generation', type: 'pending', date: contact.updated_at, status: 'pending' });
  }

  return (
    <div className="rounded-lg bg-muted/30 border border-border/50 p-3 space-y-2">
      <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">
        Intelligence Reports
      </div>
      {reports.map((r, i) => (
        <div
          key={i}
          className="rounded-lg border border-border p-2.5 hover:bg-muted/20 transition-colors cursor-pointer"
          onClick={() => onNavigate?.(`/intelligence/${contact.id}`)}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs font-medium truncate">{r.title}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{new Date(r.date).toLocaleDateString()}</p>
            </div>
            <Badge className={cn(
              'text-[9px] shrink-0',
              r.status === 'ready' ? 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800' :
              'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800'
            )}>
              {r.status}
            </Badge>
          </div>
        </div>
      ))}
      {onNavigate && (
        <Button variant="outline" size="sm" className="w-full mt-2" onClick={() => onNavigate(`/intelligence/${contact.id}`)}>
          View Full Intelligence
        </Button>
      )}
    </div>
  );
}
