import type { EventItem } from './types';
import type { EventContext } from '@/services/decision/DecisionTypes';

export function mapEventItemToEventContext(
  event: EventItem,
  eventGoals: string[] = [],
): EventContext {
  return {
    id: event.id,
    eventName: event.event_name,
    theme: event.theme ?? null,
    primaryTheme: event.primary_theme ?? null,
    description: event.description ?? null,
    targetIndustries: event.target_industries ?? [],
    targetAudience: event.target_audience ?? null,
    eventGoals,
    date: event.date ? String(event.date).split('T')[0] : null,
    venue: event.venue ?? null,
  };
}
