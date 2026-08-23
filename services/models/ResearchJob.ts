import type { Contact } from '@/lib/types';
import type { SynthesizedPersona, ScoreResult, InvitationDraft } from '../providers/types';
import type { EvidencePackage } from '../research/EvidencePackage';
import type { ExplainabilityReport } from '../research/ExplainabilityLayer';
import type { CitationMap } from '../research/CitationMapper';
import type { TaskType, Priority } from './TaskTypes';

/*
 * ResearchJob — DEL's universal execution object.
 *
 * Every intelligence pipeline run creates a ResearchJob. Each agent that
 * participates updates the same job object. This becomes DEL's execution
 * history and will later power monitoring dashboards.
 *
 * The job is NOT a database table — it's an in-memory execution context
 * that the orchestrator manages. Persistence (if needed) goes through the
 * existing analysis_runs table.
 */

export type ResearchJobStatus =
  | 'queued'
  | 'researching'
  | 'reading'
  | 'verifying'
  | 'synthesizing'
  | 'scoring'
  | 'completed'
  | 'failed';

export interface SelectedModelRecord {
  taskType: TaskType;
  providerId: string;
  providerName: string;
  reason: string;
}

export interface ExecutedAgentRecord {
  agentName: string;
  taskType: TaskType;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  success: boolean;
}

export interface ResearchJobLog {
  timestamp: string;
  stage: string;
  level: 'info' | 'warning' | 'error';
  message: string;
  providerId?: string;
  agentName?: string;
  metadata?: Record<string, unknown>;
}

export interface ResearchJob {
  jobId: string;
  status: ResearchJobStatus;
  contact: Pick<Contact, 'id' | 'name' | 'title' | 'company'>;
  selectedModels: SelectedModelRecord[];
  executedAgents: ExecutedAgentRecord[];
  evidencePackage: EvidencePackage | null;
  citationMap: CitationMap | null;
  explainabilityReport: ExplainabilityReport | null;
  persona: SynthesizedPersona | null;
  scores: { eventId: string; result: ScoreResult }[];
  invitation: InvitationDraft | null;
  confidence: number | null;
  logs: ResearchJobLog[];
  errors: string[];
  startedAt: string;
  completedAt: string | null;
}

export function createResearchJob(contact: Pick<Contact, 'id' | 'name' | 'title' | 'company'>): ResearchJob {
  return {
    jobId: `job-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    status: 'queued',
    contact,
    selectedModels: [],
    executedAgents: [],
    evidencePackage: null,
    citationMap: null,
    explainabilityReport: null,
    persona: null,
    scores: [],
    invitation: null,
    confidence: null,
    logs: [],
    errors: [],
    startedAt: new Date().toISOString(),
    completedAt: null,
  };
}

export function addLog(job: ResearchJob, log: Omit<ResearchJobLog, 'timestamp'>): void {
  job.logs.push({ ...log, timestamp: new Date().toISOString() });
}

export function recordAgentExecution(
  job: ResearchJob,
  agentName: string,
  taskType: TaskType,
  startedAt: string,
  success: boolean,
): void {
  const completedAt = new Date().toISOString();
  job.executedAgents.push({
    agentName,
    taskType,
    startedAt,
    completedAt,
    durationMs: Date.now() - new Date(startedAt).getTime(),
    success,
  });
}

export function completeJob(job: ResearchJob, confidence: number | null): void {
  job.status = 'completed';
  job.confidence = confidence;
  job.completedAt = new Date().toISOString();
}

export function failJob(job: ResearchJob, error: string): void {
  job.status = 'failed';
  job.errors.push(error);
  job.completedAt = new Date().toISOString();
}
