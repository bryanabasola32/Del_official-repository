'use client';

import { useState } from 'react';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { ScoreRing } from '@/components/Badges';
import { ExternalLink, Info, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Source } from '@/lib/types';

export interface ScoreBreakdownDimension {
  label: string;
  score: number;
  reasoning?: string;
}

export interface ScoreBreakdownData {
  title: string;
  score: number;
  maxScore?: number;
  confidence?: number;
  formula?: string;
  dimensions: ScoreBreakdownDimension[];
  reasoning?: string;
  whyItMatters?: string;
  factIds?: string[];
  sourceIds?: string[];
  sources?: Source[];
}

export function ScoreExplainerDrawer({
  open, onOpenChange, data,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: ScoreBreakdownData | null;
}) {
  if (!data) return null;
  const max = data.maxScore ?? 100;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{data.title}</SheetTitle>
          <SheetDescription>How DEL calculated this</SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-5">
          {/* Score summary */}
          <div className="flex items-center gap-4 rounded-xl border border-border p-4">
            <ScoreRing score={data.score} size={64} />
            <div>
              <div className="text-2xl font-bold">{data.score} <span className="text-sm text-muted-foreground">/ {max}</span></div>
              {data.confidence != null && (
                <Badge variant="outline" className="mt-1 text-[10px]">{data.confidence}% confidence</Badge>
              )}
            </div>
          </div>

          {/* Formula */}
          {data.formula && (
            <div className="rounded-lg bg-muted/40 border border-border p-3">
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Formula</div>
              <p className="text-xs font-mono leading-relaxed text-muted-foreground">{data.formula}</p>
            </div>
          )}

          {/* Dimension breakdown */}
          {data.dimensions.length > 0 && (
            <div>
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Component Breakdown</div>
              <div className="space-y-3">
                {data.dimensions.map((dim, i) => (
                  <div key={i} className="rounded-lg border border-border p-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-medium">{dim.label}</span>
                      <span className="text-sm font-bold">{dim.score}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden mb-1.5">
                      <div
                        className={cn('h-full rounded-full', dim.score >= 75 ? 'bg-emerald-500' : dim.score >= 50 ? 'bg-amber-500' : 'bg-rose-500')}
                        style={{ width: `${dim.score}%` }}
                      />
                    </div>
                    {dim.reasoning && <p className="text-xs text-muted-foreground">{dim.reasoning}</p>}
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between pt-3 border-t border-border mt-3">
                <span className="text-sm font-semibold">Final {data.title}</span>
                <span className="text-lg font-bold">{data.score} / {max}</span>
              </div>
            </div>
          )}

          {/* Why it matters */}
          {data.whyItMatters && (
            <div className="rounded-lg bg-primary/5 border border-primary/10 p-3">
              <div className="flex items-center gap-1.5 text-xs font-medium text-primary uppercase tracking-wider mb-1">
                <Info className="h-3.5 w-3.5" />
                Why this matters
              </div>
              <p className="text-sm leading-relaxed">{data.whyItMatters}</p>
            </div>
          )}

          {/* Reasoning */}
          {data.reasoning && (
            <div>
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Reasoning</div>
              <p className="text-sm leading-relaxed">{data.reasoning}</p>
            </div>
          )}

          {/* Supporting sources */}
          {data.sources && data.sources.length > 0 && (
            <div>
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                Supporting Evidence
              </div>
              <div className="space-y-2">
                {data.sources.slice(0, 8).map((src) => (
                  <div key={src.id} className="flex items-center gap-2 rounded-lg border border-border p-2.5">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{src.source_name || src.title || 'Untitled'}</div>
                      {src.snippet && <div className="text-xs text-muted-foreground truncate">{src.snippet}</div>}
                    </div>
                    {src.url && (
                      <a href={src.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline shrink-0">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Missing evidence */}
          {data.factIds && data.factIds.length === 0 && data.sourceIds && data.sourceIds.length === 0 && (
            <div className="flex items-center gap-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-3">
              <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
              <p className="text-xs text-muted-foreground">No direct evidence cited for this score. It may be inferred from indirect signals.</p>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function useScoreExplainer() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<ScoreBreakdownData | null>(null);

  const show = (d: ScoreBreakdownData) => {
    setData(d);
    setOpen(true);
  };

  return { open, setOpen, data, show };
}
