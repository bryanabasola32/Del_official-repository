import { supabase } from '@/lib/supabase';
import { mapEventItemToEventContext } from '@/lib/eventContextAdapter';
import { getOrganizationObjectives } from '@/lib/organizationObjectives';
import { generateExecutiveIntelligenceReport } from '@/services/intelligence';
import { generateRelationshipIntelligenceReport } from '@/services/relationship';
import { generateStrategicDecisionReport } from '@/services/decision';
import { generateActionExecutionReport } from '@/services/action';
import type { ExecutiveIntelligenceReport } from '@/services/intelligence';
import type { RelationshipIntelligenceReport } from '@/services/relationship';
import type { StrategicDecisionReport } from '@/services/decision';
import type { ActionExecutionReport } from '@/services/action';
import type { EvidenceContext } from '@/services/research/EvidenceContextBuilder';
import type { EventItem } from '@/lib/types';

type ReportType = 'executive' | 'relationship' | 'strategic_decision' | 'action';

async function persistReport(
  contactId: string,
  eventId: string | null,
  reportType: ReportType,
  report: Record<string, unknown>,
  overallConfidence: number | null,
): Promise<void> {
  const { error } = await supabase
    .from('intelligence_reports')
    .upsert(
      {
        contact_id: contactId,
        event_id: eventId,
        report_type: reportType,
        report,
        overall_confidence: overallConfidence,
        status: 'completed',
        generated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'contact_id,event_id,report_type' },
    );
  if (error) {
    console.error(`[IntelligencePipeline] Failed to persist ${reportType} report for contact ${contactId}:`, error.message);
  }
}

async function markStale(contactId: string): Promise<void> {
  await supabase
    .from('intelligence_reports')
    .update({ status: 'stale', updated_at: new Date().toISOString() })
    .eq('contact_id', contactId);
}

export interface PipelineResult {
  executiveReport: ExecutiveIntelligenceReport;
  relationshipReport: RelationshipIntelligenceReport;
  eventReports: {
    eventId: string;
    eventName: string;
    decisionReport: StrategicDecisionReport;
    actionReport: ActionExecutionReport;
  }[];
  failures: { eventId: string; eventName: string; stage: string; error: string }[];
}

export async function runIntelligencePipeline(
  contactId: string,
  evidenceContext: EvidenceContext,
  events: EventItem[],
): Promise<PipelineResult> {
  await markStale(contactId);

  const execReport = generateExecutiveIntelligenceReport(evidenceContext);
  await persistReport(contactId, null, 'executive', execReport as unknown as Record<string, unknown>, execReport.confidenceSummary?.overall ?? null);

  const relReport = generateRelationshipIntelligenceReport(execReport);
  await persistReport(contactId, null, 'relationship', relReport as unknown as Record<string, unknown>, relReport.confidenceSummary?.overallConfidence ?? null);

  const objectives = getOrganizationObjectives();
  const eventReports: PipelineResult['eventReports'] = [];
  const failures: PipelineResult['failures'] = [];

  const settled = await Promise.allSettled(
    events.map(async (event) => {
      const eventContext = mapEventItemToEventContext(event, objectives.eventGoals);
      const decisionReport = generateStrategicDecisionReport(execReport, relReport, eventContext, objectives);
      await persistReport(contactId, event.id, 'strategic_decision', decisionReport as unknown as Record<string, unknown>, decisionReport.confidenceSummary?.overallConfidence ?? null);

      const actionReport = generateActionExecutionReport(execReport, relReport, decisionReport);
      await persistReport(contactId, event.id, 'action', actionReport as unknown as Record<string, unknown>, actionReport.confidenceSummary?.overallConfidence ?? null);

      return { eventId: event.id, eventName: event.event_name, decisionReport, actionReport };
    }),
  );

  for (let i = 0; i < settled.length; i++) {
    const result = settled[i];
    if (result.status === 'fulfilled') {
      eventReports.push(result.value);
    } else {
      const evt = events[i];
      const errMsg = result.reason instanceof Error ? result.reason.message : String(result.reason);
      failures.push({ eventId: evt.id, eventName: evt.event_name, stage: 'event_pipeline', error: errMsg });
      console.error(`[IntelligencePipeline] Event ${evt.event_name} (${evt.id}) failed:`, result.reason);
    }
  }

  return { executiveReport: execReport, relationshipReport: relReport, eventReports, failures };
}

export async function loadReport<T>(
  contactId: string,
  reportType: ReportType,
  eventId: string | null = null,
): Promise<T | null> {
  let query = supabase.from('intelligence_reports').select('report').eq('contact_id', contactId).eq('report_type', reportType);
  if (eventId) {
    query = query.eq('event_id', eventId);
  } else {
    query = query.is('event_id', null);
  }
  const { data, error } = await query.maybeSingle();
  if (error || !data) return null;
  return data.report as T;
}
