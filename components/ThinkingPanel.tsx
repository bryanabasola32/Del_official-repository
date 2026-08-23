'use client';

import {
  Brain, Database, CheckCircle2, Search, Globe, FileText, Shield,
  Award, Code, Cpu, Sparkles, Link2, Save, CheckCircle, Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ThinkingStage } from '@/services/intentDetector';

const ICON_MAP: Record<string, React.ElementType> = {
  brain: Brain,
  database: Database,
  check: CheckCircle2,
  search: Search,
  globe: Globe,
  'file-text': FileText,
  shield: Shield,
  award: Award,
  code: Code,
  cpu: Cpu,
  sparkles: Sparkles,
  link: Link2,
  save: Save,
  'check-circle': CheckCircle,
};

interface ThinkingPanelProps {
  stages: ThinkingStage[];
  provider?: string;
  model?: string;
  executionTimeMs?: number;
  cacheHit?: boolean;
}

export function ThinkingPanel({ stages, provider, model, executionTimeMs, cacheHit }: ThinkingPanelProps) {
  const completedCount = stages.filter((s) => s.status === 'completed').length;
  const totalCount = stages.length;
  const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-border">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Brain className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">Thinking</h3>
          </div>
          <span className="text-[10px] text-muted-foreground">
            {completedCount}/{totalCount} steps
          </span>
        </div>
        <div className="h-1 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1">
        {stages.map((stage, index) => {
          const Icon = ICON_MAP[stage.key === 'complete' ? 'check-circle' :
            Object.entries(THINKING_STAGE_ICONS).find(([k]) => k === stage.key)?.[1] || 'brain'] || Brain;
          return (
            <div
              key={stage.key}
              className={cn(
                'flex items-start gap-2.5 py-1.5 transition-opacity duration-300',
                stage.status === 'pending' && 'opacity-40',
                stage.status === 'skipped' && 'opacity-30',
              )}
              style={{ transitionDelay: `${index * 50}ms` }}
            >
              <div className="mt-0.5 shrink-0">
                {stage.status === 'completed' ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                ) : stage.status === 'running' ? (
                  <Loader2 className="h-4 w-4 text-primary animate-spin" />
                ) : stage.status === 'skipped' ? (
                  <CheckCircle2 className="h-4 w-4 text-muted-foreground/30" />
                ) : (
                  <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/20" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <span className={cn(
                  'text-xs',
                  stage.status === 'completed' ? 'text-foreground' : 'text-muted-foreground',
                )}>
                  {stage.label}
                </span>
                {stage.detail && (
                  <p className="text-[10px] text-muted-foreground/70 mt-0.5">{stage.detail}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {(provider || model || executionTimeMs !== undefined) && (
        <div className="px-4 py-3 border-t border-border space-y-1">
          {provider && (
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-muted-foreground">Provider</span>
              <span className="font-medium text-foreground">{provider}</span>
            </div>
          )}
          {model && (
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-muted-foreground">Model</span>
              <span className="font-medium text-foreground">{model}</span>
            </div>
          )}
          {executionTimeMs !== undefined && (
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-muted-foreground">Duration</span>
              <span className="font-medium text-foreground">{executionTimeMs < 1000 ? `${executionTimeMs}ms` : `${(executionTimeMs / 1000).toFixed(1)}s`}</span>
            </div>
          )}
          {cacheHit !== undefined && (
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-muted-foreground">Cache</span>
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

const THINKING_STAGE_ICONS: Record<string, string> = {
  understanding: 'brain',
  memoryCheck: 'database',
  cached: 'check',
  research: 'search',
  search: 'globe',
  reading: 'file-text',
  evidence: 'shield',
  trust: 'award',
  prompt: 'code',
  routing: 'cpu',
  generating: 'sparkles',
  citations: 'link',
  saving: 'save',
  complete: 'check-circle',
};
