/*
 * TaskTypes — Central registry of all AI task types in DEL.
 *
 * Each task type declares which capabilities are required to execute it.
 * The Intelligence Router uses these requirements to score and select
 * the best model provider dynamically — no hardcoded provider names.
 *
 * To add a new task type: add an entry here and declare the capabilities
 * it needs. The router picks up the new task automatically.
 */

export type TaskType =
  | 'persona_generation'
  | 'invitation_writing'
  | 'multi_document_analysis'
  | 'research_synthesis'
  | 'fact_extraction'
  | 'quality_review'
  | 'scoring'
  | 'summarization'
  | 'tool_calling'
  | 'structured_extraction'
  | 'executive_intelligence'
  | 'recommendation_generation'
  | 'executive_summary'
  | 'research_analysis'
  | 'long_context_analysis'
  | 'evidence_verification'
  | 'company_analysis'
  | 'tech_readiness_analysis'
  | 'strategic_reasoning'
  | 'large_context_summarization'
  | 'document_consolidation'
  | 'large_dataset_analysis';

export interface TaskTypeSpec {
  type: TaskType;
  label: string;
  /** Capabilities the provider MUST have (all required) */
  requiredCapabilities: string[];
  /** Capabilities that give a bonus score (preferred but not mandatory) */
  preferredCapabilities: string[];
  /** Default priority level for this task type */
  defaultPriority: Priority;
  /** Suggested temperature for generation tasks */
  suggestedTemperature?: number;
  /** Max tokens the response should target */
  suggestedMaxTokens?: number;
}

export type Priority = 'low' | 'normal' | 'high' | 'critical';

export const TASK_TYPE_REGISTRY: Record<TaskType, TaskTypeSpec> = {
  persona_generation: {
    type: 'persona_generation',
    label: 'Persona Generation',
    requiredCapabilities: ['structured_json', 'persona_generation'],
    preferredCapabilities: ['tool_calling'],
    defaultPriority: 'high',
    suggestedTemperature: 0.3,
    suggestedMaxTokens: 4096,
  },
  invitation_writing: {
    type: 'invitation_writing',
    label: 'Invitation Writing',
    requiredCapabilities: ['structured_json', 'invitation_writing'],
    preferredCapabilities: [],
    defaultPriority: 'normal',
    suggestedTemperature: 0.5,
    suggestedMaxTokens: 2048,
  },
  multi_document_analysis: {
    type: 'multi_document_analysis',
    label: 'Multi-Document Analysis',
    requiredCapabilities: ['long_context', 'multi_document_analysis'],
    preferredCapabilities: ['source_comparison'],
    defaultPriority: 'high',
    suggestedTemperature: 0.2,
    suggestedMaxTokens: 8192,
  },
  research_synthesis: {
    type: 'research_synthesis',
    label: 'Research Synthesis',
    requiredCapabilities: ['research_reasoning'],
    preferredCapabilities: ['source_comparison', 'long_context'],
    defaultPriority: 'high',
    suggestedTemperature: 0.2,
    suggestedMaxTokens: 6144,
  },
  fact_extraction: {
    type: 'fact_extraction',
    label: 'Fact Extraction',
    requiredCapabilities: ['structured_json'],
    preferredCapabilities: ['research_reasoning'],
    defaultPriority: 'high',
    suggestedTemperature: 0.1,
    suggestedMaxTokens: 4096,
  },
  quality_review: {
    type: 'quality_review',
    label: 'Quality Review',
    requiredCapabilities: ['research_reasoning'],
    preferredCapabilities: ['source_comparison'],
    defaultPriority: 'normal',
    suggestedTemperature: 0.1,
    suggestedMaxTokens: 2048,
  },
  scoring: {
    type: 'scoring',
    label: 'Event Scoring',
    requiredCapabilities: ['structured_json'],
    preferredCapabilities: [],
    defaultPriority: 'normal',
    suggestedTemperature: 0.1,
    suggestedMaxTokens: 1024,
  },
  summarization: {
    type: 'summarization',
    label: 'Summarization',
    requiredCapabilities: [],
    preferredCapabilities: ['long_context'],
    defaultPriority: 'low',
    suggestedTemperature: 0.3,
    suggestedMaxTokens: 1024,
  },
  tool_calling: {
    type: 'tool_calling',
    label: 'Tool Calling',
    requiredCapabilities: ['tool_calling'],
    preferredCapabilities: [],
    defaultPriority: 'normal',
    suggestedTemperature: 0.1,
    suggestedMaxTokens: 2048,
  },
  structured_extraction: {
    type: 'structured_extraction',
    label: 'Structured Extraction',
    requiredCapabilities: ['structured_json'],
    preferredCapabilities: [],
    defaultPriority: 'normal',
    suggestedTemperature: 0.1,
    suggestedMaxTokens: 2048,
  },
  executive_intelligence: {
    type: 'executive_intelligence',
    label: 'Executive Intelligence',
    requiredCapabilities: ['research_reasoning', 'structured_json'],
    preferredCapabilities: ['persona_generation', 'long_context'],
    defaultPriority: 'high',
    suggestedTemperature: 0.2,
    suggestedMaxTokens: 6144,
  },
  recommendation_generation: {
    type: 'recommendation_generation',
    label: 'Recommendation Generation',
    requiredCapabilities: ['structured_json'],
    preferredCapabilities: ['strategic_reasoning'],
    defaultPriority: 'high',
    suggestedTemperature: 0.3,
    suggestedMaxTokens: 2048,
  },
  executive_summary: {
    type: 'executive_summary',
    label: 'Executive Summary',
    requiredCapabilities: ['structured_json'],
    preferredCapabilities: ['fast_inference', 'cost_efficient'],
    defaultPriority: 'normal',
    suggestedTemperature: 0.3,
    suggestedMaxTokens: 2048,
  },
  research_analysis: {
    type: 'research_analysis',
    label: 'Research Analysis',
    requiredCapabilities: ['research_reasoning'],
    preferredCapabilities: ['source_comparison', 'high_reasoning'],
    defaultPriority: 'high',
    suggestedTemperature: 0.2,
    suggestedMaxTokens: 4096,
  },
  long_context_analysis: {
    type: 'long_context_analysis',
    label: 'Long Context Analysis',
    requiredCapabilities: ['long_context'],
    preferredCapabilities: ['multi_document_analysis', 'high_reasoning'],
    defaultPriority: 'high',
    suggestedTemperature: 0.2,
    suggestedMaxTokens: 8192,
  },
  evidence_verification: {
    type: 'evidence_verification',
    label: 'Evidence Verification',
    requiredCapabilities: ['evidence_verification', 'research_reasoning'],
    preferredCapabilities: ['source_comparison'],
    defaultPriority: 'high',
    suggestedTemperature: 0.1,
    suggestedMaxTokens: 4096,
  },
  company_analysis: {
    type: 'company_analysis',
    label: 'Company Analysis',
    requiredCapabilities: ['research_reasoning'],
    preferredCapabilities: ['company_analysis', 'structured_json'],
    defaultPriority: 'normal',
    suggestedTemperature: 0.2,
    suggestedMaxTokens: 4096,
  },
  tech_readiness_analysis: {
    type: 'tech_readiness_analysis',
    label: 'Technology Readiness Analysis',
    requiredCapabilities: ['tech_readiness_analysis'],
    preferredCapabilities: ['structured_json'],
    defaultPriority: 'normal',
    suggestedTemperature: 0.2,
    suggestedMaxTokens: 2048,
  },
  strategic_reasoning: {
    type: 'strategic_reasoning',
    label: 'Strategic Reasoning',
    requiredCapabilities: ['strategic_reasoning'],
    preferredCapabilities: ['high_reasoning'],
    defaultPriority: 'high',
    suggestedTemperature: 0.4,
    suggestedMaxTokens: 4096,
  },
  large_context_summarization: {
    type: 'large_context_summarization',
    label: 'Large Context Summarization',
    requiredCapabilities: ['large_context_summarization', 'long_context'],
    preferredCapabilities: ['document_consolidation'],
    defaultPriority: 'normal',
    suggestedTemperature: 0.3,
    suggestedMaxTokens: 4096,
  },
  document_consolidation: {
    type: 'document_consolidation',
    label: 'Document Consolidation',
    requiredCapabilities: ['document_consolidation'],
    preferredCapabilities: ['long_context'],
    defaultPriority: 'normal',
    suggestedTemperature: 0.2,
    suggestedMaxTokens: 4096,
  },
  large_dataset_analysis: {
    type: 'large_dataset_analysis',
    label: 'Large Dataset Analysis',
    requiredCapabilities: ['large_dataset_analysis', 'long_context'],
    preferredCapabilities: ['large_context_summarization'],
    defaultPriority: 'normal',
    suggestedTemperature: 0.2,
    suggestedMaxTokens: 8192,
  },
};

export function getTaskTypeSpec(type: TaskType): TaskTypeSpec {
  return TASK_TYPE_REGISTRY[type];
}

export function getAllTaskTypes(): TaskType[] {
  return Object.keys(TASK_TYPE_REGISTRY) as TaskType[];
}
