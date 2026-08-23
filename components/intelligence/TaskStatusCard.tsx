'use client';

import { cn } from '@/lib/utils';
import { Clock, Loader2, CheckCircle2, AlertCircle, Circle } from 'lucide-react';

export type TaskStatusType = 'pending' | 'running' | 'completed' | 'failed';

interface TaskStatusCardProps {
  title: string;
  status: TaskStatusType;
  description?: string;
  progress?: number;
  className?: string;
}

export function TaskStatusCard({ title, status, description, progress, className }: TaskStatusCardProps) {
  return (
    <div className={cn('rounded-xl border border-border bg-card p-4', className)}>
      <div className="flex items-start gap-3">
        <StatusIcon status={status} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium text-foreground truncate">{title}</span>
            <StatusBadge status={status} />
          </div>
          {description && (
            <p className="text-xs text-muted-foreground mt-1">{description}</p>
          )}
          {typeof progress === 'number' && status === 'running' && (
            <div className="mt-2">
              <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-300"
                  style={{ width: `${Math.min(progress, 100)}%` }}
                />
              </div>
              <span className="text-[10px] text-muted-foreground mt-1 tabular-nums">{progress}%</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusIcon({ status }: { status: TaskStatusType }) {
  const cls = 'h-5 w-5 shrink-0';
  if (status === 'completed') return <CheckCircle2 className={cn(cls, 'text-emerald-500')} />;
  if (status === 'running') return <Loader2 className={cn(cls, 'text-primary animate-spin')} />;
  if (status === 'failed') return <AlertCircle className={cn(cls, 'text-destructive')} />;
  return <Clock className={cn(cls, 'text-muted-foreground/50')} />;
}

function StatusBadge({ status }: { status: TaskStatusType }) {
  const styles: Record<TaskStatusType, string> = {
    pending: 'bg-muted text-muted-foreground',
    running: 'bg-primary/10 text-primary',
    completed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    failed: 'bg-destructive/10 text-destructive',
  };
  return (
    <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide', styles[status])}>
      {status}
    </span>
  );
}
