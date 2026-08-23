'use client';

import { cn } from '@/lib/utils';
import { CheckCircle2, Loader2, Circle, AlertCircle } from 'lucide-react';

export interface ProcessingStageData {
  label: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
}

interface AIProcessingPanelProps {
  stages: ProcessingStageData[];
  className?: string;
}

export function AIProcessingPanel({ stages, className }: AIProcessingPanelProps) {
  return (
    <div className={cn('rounded-lg bg-muted/50 p-3 space-y-2', className)}>
      {stages.map((stage, i) => (
        <div key={i} className="flex items-center gap-2.5 text-xs">
          <StageIcon status={stage.status} />
          <span className={cn(
            'flex-1',
            stage.status === 'completed' && 'text-muted-foreground',
            stage.status === 'running' && 'text-foreground font-medium',
            stage.status === 'pending' && 'text-muted-foreground/50',
            stage.status === 'failed' && 'text-destructive',
          )}>
            {stage.label}
          </span>
          <span className={cn(
            'text-[10px] uppercase tracking-wide font-medium',
            stage.status === 'completed' && 'text-emerald-600',
            stage.status === 'running' && 'text-primary',
            stage.status === 'pending' && 'text-muted-foreground/40',
            stage.status === 'failed' && 'text-destructive',
          )}>
            {stage.status === 'completed' && 'Completed'}
            {stage.status === 'running' && 'Running...'}
            {stage.status === 'pending' && 'Pending'}
            {stage.status === 'failed' && 'Failed'}
          </span>
        </div>
      ))}
    </div>
  );
}

function StageIcon({ status }: { status: ProcessingStageData['status'] }) {
  if (status === 'completed') return <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />;
  if (status === 'running') return <Loader2 className="h-4 w-4 text-primary animate-spin shrink-0" />;
  if (status === 'failed') return <AlertCircle className="h-4 w-4 text-destructive shrink-0" />;
  return <Circle className="h-4 w-4 text-muted-foreground/30 shrink-0" />;
}
