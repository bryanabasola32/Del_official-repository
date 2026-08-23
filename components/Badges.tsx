'use client';

import { cn } from '@/lib/utils';
import type { ConfidenceLevel, PersonaConfidence } from '@/lib/types';
import { CONFIDENCE_LABELS, CONFIDENCE_COLORS, CONFIDENCE_DOT, PERSONA_CONFIDENCE_LABELS, PERSONA_CONFIDENCE_COLORS } from '@/lib/constants';

export function ConfidenceBadge({ level, className }: { level: ConfidenceLevel; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium', CONFIDENCE_COLORS[level], className)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', CONFIDENCE_DOT[level])} />
      {CONFIDENCE_LABELS[level]}
    </span>
  );
}

export function PersonaConfidenceBadge({ level, pct, className }: { level: PersonaConfidence; pct?: number | null; className?: string }) {
  if (!level) return null;
  const color = PERSONA_CONFIDENCE_COLORS[level];
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium', className)} style={{}}>
      <span className={cn('h-1.5 w-1.5 rounded-full', color)} />
      {PERSONA_CONFIDENCE_LABELS[level]}
      {pct != null && <span className="opacity-60">· {pct}%</span>}
    </span>
  );
}

export function ScoreRing({ score, size = 48, capped = false }: { score: number; size?: number; capped?: boolean }) {
  const radius = (size - 6) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = capped ? '#f43f5e' : score >= 85 ? '#10b981' : score >= 70 ? '#3b82f6' : score >= 50 ? '#f59e0b' : '#94a3b8';

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="currentColor" strokeWidth={3} className="text-muted/30" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={3}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-500"
        />
      </svg>
      <span className="absolute text-xs font-bold" style={{ color }}>
        {score}
      </span>
    </div>
  );
}
