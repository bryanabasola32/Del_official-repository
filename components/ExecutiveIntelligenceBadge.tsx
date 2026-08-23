'use client';

import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { CircleDashed, Loader2, AlertCircle, CheckCircle2, CalendarCheck, Mail } from 'lucide-react';
import type { Contact } from '@/lib/types';

export type IntelligenceState =
  | 'not_started'
  | 'processing'
  | 'needs_review'
  | 'ready'
  | 'assigned'
  | 'drafted';

interface StateConfig {
  label: string;
  icon: React.ElementType;
  iconClass: string;
  cls: string;
}

const STATE_CONFIG: Record<IntelligenceState, StateConfig> = {
  not_started: {
    label: 'Not Started',
    icon: CircleDashed,
    iconClass: 'text-slate-500 dark:text-slate-400',
    cls: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800/50 dark:text-slate-400 dark:border-slate-700',
  },
  processing: {
    label: 'Processing',
    icon: Loader2,
    iconClass: 'text-amber-600 dark:text-amber-400',
    cls: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800',
  },
  needs_review: {
    label: 'Needs Review',
    icon: AlertCircle,
    iconClass: 'text-violet-600 dark:text-violet-400',
    cls: 'bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-900/30 dark:text-violet-400 dark:border-violet-800',
  },
  ready: {
    label: 'Ready',
    icon: CheckCircle2,
    iconClass: 'text-emerald-600 dark:text-emerald-400',
    cls: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800',
  },
  assigned: {
    label: 'Assigned',
    icon: CalendarCheck,
    iconClass: 'text-blue-600 dark:text-blue-400',
    cls: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800',
  },
  drafted: {
    label: 'Invitation Drafted',
    icon: Mail,
    iconClass: 'text-indigo-600 dark:text-indigo-400',
    cls: 'bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-400 dark:border-indigo-800',
  },
};

export function getIntelligenceState(
  contact: Pick<Contact, 'persona_status' | 'recommendation_status'>,
): IntelligenceState {
  const ps = contact.persona_status;
  const rs = contact.recommendation_status;

  // Precedence: assigned > drafted > needs_review > processing > ready > not_started
  if (rs === 'assigned') return 'assigned';
  if (rs === 'approved') return 'drafted';
  if (ps === 'needs_review') return 'needs_review';
  if (ps === 'searching' || ps === 'retrieved' || ps === 'synthesizing') return 'processing';
  if (ps === 'completed' || ps === 'low_confidence') return 'ready';
  return 'not_started';
}

export function IntelligenceStatusBadge({
  state,
  className,
}: {
  state: IntelligenceState;
  className?: string;
}) {
  const c = STATE_CONFIG[state];
  const Icon = c.icon;
  const isProcessing = state === 'processing';
  return (
    <Badge className={cn(c.cls, className)}>
      <Icon className={cn('h-3 w-3 mr-1.5 shrink-0', c.iconClass, isProcessing && 'animate-spin')} />
      {c.label}
    </Badge>
  );
}

export function ScoreBadge({ score }: { score: number }) {
  let cls = 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800';
  if (score >= 95) cls = 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800';
  else if (score >= 80) cls = 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800';
  else if (score >= 65) cls = 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800';

  return (
    <Badge className={cls}>
      {score}%
    </Badge>
  );
}

export function scoreLabel(score: number): { text: string; cls: string } {
  if (score >= 95) return { text: 'Excellent Match', cls: 'text-emerald-600 dark:text-emerald-400' };
  if (score >= 80) return { text: 'Good Match', cls: 'text-amber-600 dark:text-amber-400' };
  if (score >= 65) return { text: 'Moderate Match', cls: 'text-orange-600 dark:text-orange-400' };
  return { text: 'Low Match', cls: 'text-red-600 dark:text-red-400' };
}
