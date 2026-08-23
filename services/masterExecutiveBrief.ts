import { supabase } from '@/lib/supabase';
import { loadReport } from './intelligencePipeline';
import type { ExecutiveIntelligenceReport } from './intelligence';
import type { RelationshipIntelligenceReport } from './relationship';
import type { StrategicDecisionReport } from './decision';
import type { ActionExecutionReport } from './action';
import type { EventItem } from '@/lib/types';

export interface MasterExecutiveBrief {
  contactId: string;
  eventId: string | null;
  executive: ExecutiveIntelligenceReport | null;
  relationship: RelationshipIntelligenceReport | null;
  decision: StrategicDecisionReport | null;
  action: ActionExecutionReport | null;
  missing: string[];
}

async function resolveTargetEvent(contactId: string, eventId?: string | null): Promise<string | null> {
  if (eventId) return eventId;

  const { data: contact } = await supabase
    .from('contacts')
    .select('assigned_event_id')
    .eq('id', contactId)
    .maybeSingle();

  if (contact?.assigned_event_id) return contact.assigned_event_id as string;

  const { data: events } = await supabase
    .from('events')
    .select('id')
    .in('status', ['upcoming', 'active'])
    .order('date', { ascending: true })
    .limit(1);

  if (events && events.length > 0) return events[0].id as string;

  return null;
}

export async function buildMasterExecutiveBrief(
  contactId: string,
  eventId?: string | null,
): Promise<MasterExecutiveBrief> {
  const resolvedEventId = await resolveTargetEvent(contactId, eventId ?? undefined);

  const [executive, relationship, decision, action] = await Promise.all([
    loadReport<ExecutiveIntelligenceReport>(contactId, 'executive'),
    loadReport<RelationshipIntelligenceReport>(contactId, 'relationship'),
    loadReport<StrategicDecisionReport>(contactId, 'strategic_decision', resolvedEventId),
    loadReport<ActionExecutionReport>(contactId, 'action', resolvedEventId),
  ]);

  const missing: string[] = [];
  if (!executive) missing.push('executive');
  if (!relationship) missing.push('relationship');
  if (!decision) missing.push('strategic_decision');
  if (!action) missing.push('action');

  return {
    contactId,
    eventId: resolvedEventId,
    executive,
    relationship,
    decision,
    action,
    missing,
  };
}

export function toPromptContext(brief: MasterExecutiveBrief): string {
  const lines: string[] = [];

  // MP4 — Executive Intelligence
  if (brief.executive) {
    const ex = brief.executive;
    lines.push('EXECUTIVE INTELLIGENCE (MP4):');
    lines.push(`Summary: ${ex.executiveSummary.summary}`);
    lines.push(`Archetype: ${ex.executiveSummary.archetype}`);
    if (ex.opportunities.length > 0) {
      lines.push(`Top opportunities: ${ex.opportunities.slice(0, 2).map((o) => o.value).join('; ')}`);
    }
    if (ex.risks.length > 0) {
      lines.push(`Top risks: ${ex.risks.slice(0, 2).map((r) => r.value).join('; ')}`);
    }
  } else {
    lines.push('EXECUTIVE INTELLIGENCE (MP4): not yet generated');
  }

  // MP5 — Relationship Intelligence
  if (brief.relationship) {
    const rel = brief.relationship;
    lines.push('');
    lines.push('RELATIONSHIP INTELLIGENCE (MP5):');
    lines.push(`Summary: ${rel.executiveSummary.summary}`);
    lines.push(`Stage: ${rel.relationshipProfile.stage}`);
    if (rel.conversationStarters.length > 0) {
      lines.push(`Top conversation starters: ${rel.conversationStarters.slice(0, 2).map((cs) => cs.suggestedQuestion).join('; ')}`);
    }
  } else {
    lines.push('');
    lines.push('RELATIONSHIP INTELLIGENCE (MP5): not yet generated');
  }

  // MP6 — Strategic Decision
  if (brief.decision) {
    const dec = brief.decision;
    lines.push('');
    lines.push('STRATEGIC DECISION (MP6):');
    lines.push(`Recommendation: ${dec.inviteRecommendation.decision} (confidence ${dec.inviteRecommendation.confidence}%)`);
    lines.push(`Reasoning: ${dec.inviteRecommendation.reasoning}`);
    if (dec.eventFit) {
      lines.push(`Event fit: ${dec.eventFit.overallFitScore}% — ${dec.eventFit.reasoning}`);
    }
  } else {
    lines.push('');
    lines.push('STRATEGIC DECISION (MP6): not yet generated');
  }

  // MP7 — Action Execution
  if (brief.action) {
    const act = brief.action;
    lines.push('');
    lines.push('ACTION PLAN (MP7):');
    if (act.meetingStrategy) {
      lines.push(`Meeting strategy: ${act.meetingStrategy.objective} (${act.meetingStrategy.meetingType}, ${act.meetingStrategy.duration}min)`);
    }
    if (act.taskList && act.taskList.tasks.length > 0) {
      lines.push(`Top tasks: ${act.taskList.tasks.slice(0, 3).map((t) => t.title).join('; ')}`);
    }
  } else {
    lines.push('');
    lines.push('ACTION PLAN (MP7): not yet generated');
  }

  return lines.join('\n');
}

export function getEventName(brief: MasterExecutiveBrief, events: EventItem[]): string | null {
  if (!brief.eventId) return null;
  const evt = events.find((e) => e.id === brief.eventId);
  return evt?.event_name ?? null;
}
