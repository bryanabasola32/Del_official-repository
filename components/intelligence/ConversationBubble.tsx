'use client';

import { Sparkles, ChevronRight, ExternalLink, Cpu } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ThinkingStage } from '@/services/intentDetector';
import { ResponseAnalysisAccordion, type AnalysisTabData, type ExecutiveAccordionContext } from './ResponseAnalysisAccordion';

export interface ConversationAction {
  label: string;
  href?: string;
  onClick?: () => void;
}

export interface Citation {
  title: string;
  url: string;
  source_tier?: number;
  snippet?: string;
}

export interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  actions?: ConversationAction[];
  timestamp: string;
  responseCard?: AIResponseData;
  processingStages?: ProcessingStage[];
  thinkingStages?: ThinkingStage[];
  executiveId?: string;
  executiveName?: string;
  provider?: string;
  model?: string;
  isMock?: boolean;
  citations?: Citation[];
  executionTimeMs?: number;
  cacheHit?: boolean;
}

export interface ProcessingStage {
  label: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
}

export interface AIResponseSection {
  type: 'summary' | 'key_findings' | 'recommendations' | 'reliability' | 'evidence';
  title: string;
  items: string[];
}

export interface AIResponseData {
  sections: AIResponseSection[];
}

interface ConversationBubbleProps {
  message: ConversationMessage;
  onAction?: (action: ConversationAction) => void;
  analysisData?: AnalysisTabData;
  onNavigate?: (href: string) => void;
}

export function ConversationBubble({ message, onAction, analysisData, onNavigate }: ConversationBubbleProps) {
  const isAssistant = message.role === 'assistant';

  return (
    <div className={cn('flex gap-3 animate-slide-up', !isAssistant && 'flex-row-reverse')}>
      <div className={cn(
        'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
        isAssistant ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'
      )}>
        {isAssistant ? <Sparkles className="h-4 w-4" /> : <span className="text-xs font-semibold">EM</span>}
      </div>
      <div className={cn('flex-1 min-w-0', !isAssistant && 'flex justify-end')}>
        <div className={cn(
          'inline-block rounded-2xl px-4 py-3 text-sm leading-relaxed max-w-[85%]',
          isAssistant
            ? 'bg-card border border-border text-foreground rounded-tl-sm'
            : 'bg-primary text-primary-foreground rounded-tr-sm'
        )}>
          <p className="whitespace-pre-wrap">{message.content}</p>

          {message.processingStages && message.processingStages.length > 0 && (
            <div className="mt-3 space-y-1.5 rounded-lg bg-muted/50 p-3">
              {message.processingStages.map((stage, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <StageIcon status={stage.status} />
                  <span className={cn(
                    'flex-1',
                    stage.status === 'completed' && 'text-muted-foreground line-through',
                    stage.status === 'running' && 'text-foreground font-medium',
                    stage.status === 'pending' && 'text-muted-foreground/50',
                    stage.status === 'failed' && 'text-destructive',
                  )}>
                    {stage.label}
                  </span>
                </div>
              ))}
            </div>
          )}

          {message.responseCard && <AIResponseCard data={message.responseCard} />}

          {message.citations && message.citations.length > 0 && (
            <div className="mt-3 space-y-1.5">
              <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Sources</div>
              {message.citations.map((cite, i) => (
                <a
                  key={i}
                  href={cite.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-1.5 text-xs text-primary hover:underline"
                >
                  <ExternalLink className="h-3 w-3 mt-0.5 shrink-0" />
                  <span className="truncate">{cite.title}</span>
                </a>
              ))}
            </div>
          )}

          {message.provider && (
            <div className="mt-2 flex items-center gap-1 text-[10px] text-muted-foreground/50">
              <Cpu className="h-3 w-3" />
              {message.provider}{message.model ? ` · ${message.model}` : ''}
              {message.isMock && <span className="text-amber-500"> · mock</span>}
            </div>
          )}

          {message.actions && message.actions.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {message.actions.map((action, i) => (
                <button
                  key={i}
                  onClick={() => onAction?.(action)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-primary/20 bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/10 transition-colors"
                >
                  {action.label}
                  <ChevronRight className="h-3 w-3" />
                </button>
              ))}
            </div>
          )}

          {isAssistant && analysisData && (
            <ResponseAnalysisAccordion data={analysisData} onNavigate={onNavigate} />
          )}
        </div>
      </div>
    </div>
  );
}

function StageIcon({ status }: { status: ProcessingStage['status'] }) {
  if (status === 'completed') return <span className="text-emerald-500 text-xs">✓</span>;
  if (status === 'running') return <span className="h-3 w-3 rounded-full border-2 border-primary border-t-transparent animate-spin" />;
  if (status === 'failed') return <span className="text-destructive text-xs">✕</span>;
  return <span className="h-3 w-3 rounded-full border-2 border-muted-foreground/30" />;
}

function AIResponseCard({ data }: { data: AIResponseData }) {
  return (
    <div className="mt-3 space-y-2">
      {data.sections.map((section, i) => (
        <div key={i} className="rounded-lg border border-border bg-background/50 p-3">
          <div className="flex items-center gap-1.5 mb-2">
            <SectionIcon type={section.type} />
            <span className="text-xs font-semibold uppercase tracking-wide text-foreground">{section.title}</span>
          </div>
          <ul className="space-y-1">
            {section.items.map((item, j) => (
              <li key={j} className="text-xs text-muted-foreground flex items-start gap-1.5">
                <span className="text-primary mt-0.5">•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function SectionIcon({ type }: { type: AIResponseSection['type'] }) {
  const colors: Record<string, string> = {
    summary: 'text-primary',
    key_findings: 'text-amber-500',
    recommendations: 'text-emerald-500',
    reliability: 'text-blue-500',
    evidence: 'text-purple-500',
  };
  return <span className={cn('h-2 w-2 rounded-full', colors[type] || 'text-muted-foreground')} />;
}
