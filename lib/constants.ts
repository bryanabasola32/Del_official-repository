import type { ConfidenceLevel, PersonaConfidence } from './types';

export const CONFIDENCE_LABELS: Record<ConfidenceLevel, string> = {
  verified: 'Verified',
  probable: 'Probable',
  unverified: 'Unverified',
  insufficient_data: 'Insufficient Data',
};

export const CONFIDENCE_COLORS: Record<ConfidenceLevel, string> = {
  verified: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  probable: 'bg-amber-100 text-amber-700 border-amber-200',
  unverified: 'bg-orange-100 text-orange-700 border-orange-200',
  insufficient_data: 'bg-slate-100 text-slate-500 border-slate-200',
};

export const CONFIDENCE_DOT: Record<ConfidenceLevel, string> = {
  verified: 'bg-emerald-500',
  probable: 'bg-amber-500',
  unverified: 'bg-orange-500',
  insufficient_data: 'bg-slate-400',
};

export const PERSONA_CONFIDENCE_LABELS: Record<NonNullable<PersonaConfidence>, string> = {
  high: 'High Confidence',
  medium: 'Medium Confidence',
  low: 'Low Confidence',
};

export const PERSONA_CONFIDENCE_COLORS: Record<NonNullable<PersonaConfidence>, string> = {
  high: 'bg-emerald-500',
  medium: 'bg-amber-500',
  low: 'bg-rose-500',
};

export const PERSONA_STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  searching: 'Searching',
  retrieved: 'Retrieved',
  synthesizing: 'Synthesizing',
  completed: 'Completed',
  needs_review: 'Needs Manual Review',
  low_confidence: 'Low Confidence',
};

export const TIER_LABELS: Record<number, string> = {
  1: 'Tier 1 — High Confidence',
  2: 'Tier 2 — Corroborate',
  3: 'Tier 3 — Context Only',
};

export const SCORING_RUBRIC = [
  { criterion: 'Role / Title Relevance', weight: 40, key: 'role_score' },
  { criterion: 'Industry Match', weight: 25, key: 'industry_score' },
  { criterion: 'Pain Point Alignment', weight: 25, key: 'painpoint_score' },
  { criterion: 'Tech Readiness Fit', weight: 10, key: 'techreadiness_score' },
];

export const FRESHNESS_THRESHOLDS = [
  { minDays: 90, threshold: 60 },
  { minDays: 30, threshold: 30 },
  { minDays: 0, threshold: 14 },
];

export const DEFAULT_FRESHNESS_THRESHOLD = 60;

export const MAX_CONCURRENT = 3;
export const BATCH_WARN_THRESHOLD = 50;

export const NAV_ITEMS = [
  { label: 'AI Command Center', href: '/command-center', icon: 'MessageSquare' },
  { label: 'Executive List', href: '/executives', icon: 'Users' },
  { label: 'Executive Intelligence', href: '/intelligence', icon: 'Brain' },
  { label: 'Event Manager', href: '/events', icon: 'CalendarDays' },
  { label: 'Invite Draft', href: '/invites', icon: 'Mail' },
  { label: 'Reports', href: '/reports', icon: 'BarChart3' },
] as const;
