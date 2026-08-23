import { createAIProvider } from '../../services/providers/aiProvider';
import type { DashboardSummary, ExecutiveReportRow, RecommendationReportRow, EventReportRow } from './reportMetrics';
import type { EventIntelligence } from '../eventIntelligence';

export type NarrativeMode = 'concise' | 'executive_brief' | 'detailed';

export interface NarrativeResult {
  text: string;
  isMock: boolean;
  error?: string;
}

const MODE_CONFIG: Record<NarrativeMode, { maxTokens: number; label: string }> = {
  concise: { maxTokens: 300, label: 'Concise' },
  executive_brief: { maxTokens: 1200, label: 'Executive Brief' },
  detailed: { maxTokens: 2400, label: 'Detailed Report' },
};

const SYSTEM_PROMPT = `You are DEL, an executive intelligence reporting assistant. You generate narrative reports based ONLY on the supplied DEL intelligence data.

STRICT RULES:
- Use ONLY the supplied DEL data. Do NOT invent information.
- Do NOT introduce external research or facts.
- Do NOT modify numerical values, scores, or confidence levels.
- Do NOT create new scores, rankings, or personas.
- Do NOT claim delivery unless the supplied data confirms delivery.
- Do NOT claim attendance unless the supplied data confirms attendance.
- Preserve uncertainty. If confidence is "medium" or "low", state that clearly.
- Clearly distinguish observed facts from interpretation.
- If information is missing, state that it is unavailable rather than guessing.
- Use professional, executive-grade language.
- Structure the narrative with clear sections: Executive Summary, Key Findings, Analysis, and Recommendations (if applicable).
- Do NOT use bullet points. Use flowing paragraphs.`;

export async function generateDashboardNarrative(
  summary: DashboardSummary,
  mode: NarrativeMode,
): Promise<NarrativeResult> {
  const dataContext = buildDashboardContext(summary);
  return generateNarrative(dataContext, mode, 'Dashboard Summary Report');
}

export async function generateExecutiveNarrative(
  rows: ExecutiveReportRow[],
  mode: NarrativeMode,
): Promise<NarrativeResult> {
  const dataContext = buildExecutiveContext(rows);
  return generateNarrative(dataContext, mode, 'Executive Intelligence Report');
}

export async function generateRecommendationNarrative(
  rows: RecommendationReportRow[],
  mode: NarrativeMode,
): Promise<NarrativeResult> {
  const dataContext = buildRecommendationContext(rows);
  return generateNarrative(dataContext, mode, 'Recommendation Analysis Report');
}

export async function generateEventNarrative(
  eventName: string,
  intel: EventIntelligence,
  recommendations: RecommendationReportRow[],
  mode: NarrativeMode,
): Promise<NarrativeResult> {
  const dataContext = buildEventContext(eventName, intel, recommendations);
  return generateNarrative(dataContext, mode, `Event Intelligence Report: ${eventName}`);
}

async function generateNarrative(dataContext: string, mode: NarrativeMode, reportTitle: string): Promise<NarrativeResult> {
  const config = MODE_CONFIG[mode];
  const prompt = `Generate a ${config.label} narrative report titled "${reportTitle}" using ONLY the following DEL intelligence data.

DEL DATA:
${dataContext}

Generate the narrative now. Remember: use only the data above, preserve all numerical values exactly, preserve confidence levels, and do not invent any information.`;

  try {
    const provider = createAIProvider();
    const response = await provider.complete({
      prompt,
      systemPrompt: SYSTEM_PROMPT,
      temperature: 0.3,
      maxTokens: config.maxTokens,
    });

    if (response.isMock || provider.isMock) {
      return {
        text: buildFallbackNarrative(reportTitle, dataContext),
        isMock: true,
      };
    }

    return {
      text: response.content,
      isMock: false,
    };
  } catch {
    return {
      text: buildFallbackNarrative(reportTitle, dataContext),
      isMock: true,
      error: 'AI narrative generation failed. Showing structured summary instead.',
    };
  }
}

function buildDashboardContext(summary: DashboardSummary): string {
  const lines: string[] = [];
  lines.push('KPIs:');
  lines.push(`- Executives Analyzed: ${summary.kpis.executivesAnalyzed}`);
  lines.push(`- High-Fit Matches: ${summary.kpis.highFitMatches}`);
  lines.push(`- Approved Attendees: ${summary.kpis.approvedAttendees}`);
  lines.push(`- Invitation Drafts: ${summary.kpis.invitationDrafts}`);
  lines.push(`- Industries Represented: ${summary.industriesRepresented}`);
  lines.push(`- Total Events: ${summary.totalEvents}`);
  lines.push(`- Active Events: ${summary.activeEvents}`);
  lines.push(`- Average Match Score: ${summary.averageMatchScore !== null ? summary.averageMatchScore + '/100' : 'N/A'}`);

  if (summary.personaDistribution.length > 0) {
    lines.push('Persona Distribution:');
    for (const p of summary.personaDistribution) {
      lines.push(`- ${p.persona_type}: ${p.count}`);
    }
  }

  if (summary.confidenceDistribution.length > 0) {
    lines.push('Confidence Distribution:');
    for (const c of summary.confidenceDistribution) {
      lines.push(`- ${c.level}: ${c.count}`);
    }
  }

  return lines.join('\n');
}

function buildExecutiveContext(rows: ExecutiveReportRow[]): string {
  const lines: string[] = [];
  lines.push(`Total Executives: ${rows.length}`);

  const highConf = rows.filter((r) => r.persona_confidence_level === 'high').length;
  const medConf = rows.filter((r) => r.persona_confidence_level === 'medium').length;
  const lowConf = rows.filter((r) => r.persona_confidence_level === 'low').length;
  lines.push(`Confidence Distribution: High=${highConf}, Medium=${medConf}, Low=${lowConf}`);

  const industries = new Map<string, number>();
  for (const r of rows) {
    if (r.industry) industries.set(r.industry, (industries.get(r.industry) || 0) + 1);
  }
  if (industries.size > 0) {
    lines.push('Industries:');
    for (const [ind, count] of industries) {
      lines.push(`- ${ind}: ${count}`);
    }
  }

  lines.push('Executive Details (first 20):');
  for (const r of rows.slice(0, 20)) {
    lines.push(`- ${r.name} (${r.company}): Persona=${r.persona_type || 'N/A'}, Confidence=${r.persona_confidence_level || 'N/A'}, Tech Readiness=${r.tech_readiness_level || 'N/A'}, Sources=${r.sources_verified_count || 0}`);
  }

  return lines.join('\n');
}

function buildRecommendationContext(rows: RecommendationReportRow[]): string {
  const lines: string[] = [];
  lines.push(`Total Matches: ${rows.length}`);

  const highFit = rows.filter((r) => r.match_tier === 'High');
  const approved = rows.filter((r) => r.is_final_attendee);
  const avgScore = rows.length > 0 ? Math.round(rows.reduce((sum, r) => sum + r.total_score, 0) / rows.length) : null;

  lines.push(`High-Fit Matches: ${highFit.length}`);
  lines.push(`Approved Attendees: ${approved.length}`);
  lines.push(`Average Match Score: ${avgScore !== null ? avgScore + '/100' : 'N/A'}`);

  const eventMap = new Map<string, number>();
  for (const r of rows) {
    eventMap.set(r.event_name, (eventMap.get(r.event_name) || 0) + 1);
  }
  if (eventMap.size > 0) {
    lines.push('Matches by Event:');
    for (const [event, count] of eventMap) {
      lines.push(`- ${event}: ${count}`);
    }
  }

  lines.push('Top Matches (first 20):');
  for (const r of rows.slice(0, 20)) {
    lines.push(`- ${r.contact_name} (${r.company}) → ${r.event_name}: Score=${r.total_score}, Tier=${r.match_tier}, Status=${r.recommendation_status}`);
  }

  return lines.join('\n');
}

function buildEventContext(eventName: string, intel: EventIntelligence, recommendations: RecommendationReportRow[]): string {
  const lines: string[] = [];
  lines.push(`Event: ${eventName}`);
  lines.push(`Executives Analyzed: ${intel.totalAnalyzed}`);
  lines.push(`High-Fit: ${intel.highFit}`);
  lines.push(`Medium-Fit: ${intel.mediumFit}`);
  lines.push(`Low-Fit: ${intel.lowFit}`);
  lines.push(`Average Match Score: ${intel.averageScore !== null ? intel.averageScore + '/100' : 'N/A'}`);
  lines.push(`Approved: ${intel.approvedCount}`);
  lines.push(`Pending Review: ${intel.pendingReview}`);
  lines.push(`Rejected: ${intel.rejectedCount}`);
  lines.push(`Invitation Drafts: ${intel.invitationCount}`);

  if (recommendations.length > 0) {
    lines.push('Recommendations (first 20):');
    for (const r of recommendations.slice(0, 20)) {
      lines.push(`- ${r.contact_name} (${r.company}): Score=${r.total_score}, Tier=${r.match_tier}, Status=${r.recommendation_status}, Approved=${r.is_final_attendee}`);
    }
  }

  return lines.join('\n');
}

function buildFallbackNarrative(title: string, dataContext: string): string {
  return `${title}

AI narrative generation is currently unavailable. The structured intelligence data below remains available for review.

${dataContext}`;
}
