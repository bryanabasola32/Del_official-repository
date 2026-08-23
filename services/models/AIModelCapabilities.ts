/*
 * AIModelCapabilities — Central registry of provider capabilities.
 *
 * Each model provider declares a set of capabilities (strings) it supports.
 * The Intelligence Router matches task requirements against these capabilities
 * to select the best provider — no hardcoded model names in routing logic.
 *
 * To add a new capability: add it to the CAPABILITY_LABELS map for documentation.
 * Providers declare capabilities in their registration; the router scores them.
 */

export type Capability =
  | 'structured_json'
  | 'persona_generation'
  | 'invitation_writing'
  | 'tool_calling'
  | 'long_context'
  | 'multi_document_analysis'
  | 'research_reasoning'
  | 'source_comparison'
  | 'fast_inference'
  | 'cost_efficient'
  | 'high_reasoning'
  | 'evidence_verification'
  | 'company_analysis'
  | 'tech_readiness_analysis'
  | 'strategic_reasoning'
  | 'large_context_summarization'
  | 'document_consolidation'
  | 'large_dataset_analysis';

export const CAPABILITY_LABELS: Record<Capability, string> = {
  structured_json: 'Structured JSON Output',
  persona_generation: 'Persona Generation',
  invitation_writing: 'Invitation Writing',
  tool_calling: 'Tool Calling',
  long_context: 'Long Context Window',
  multi_document_analysis: 'Multi-Document Analysis',
  research_reasoning: 'Research Reasoning',
  source_comparison: 'Source Comparison',
  fast_inference: 'Fast Inference',
  cost_efficient: 'Cost Efficient',
  high_reasoning: 'High Reasoning Depth',
  evidence_verification: 'Evidence Verification',
  company_analysis: 'Company Analysis',
  tech_readiness_analysis: 'Technology Readiness Analysis',
  strategic_reasoning: 'Strategic Reasoning',
  large_context_summarization: 'Large Context Summarization',
  document_consolidation: 'Document Consolidation',
  large_dataset_analysis: 'Large Dataset Analysis',
};

export interface ModelProviderProfile {
  /** Unique provider ID (e.g. 'openai', 'anthropic') */
  id: string;
  /** Human-readable name */
  name: string;
  /** Mock flag — true until real API keys are connected */
  isMock: boolean;
  /** Declared capabilities */
  capabilities: Capability[];
  /** Relative cost score 0-1 (0 = free, 1 = expensive) */
  costScore: number;
  /** Relative speed score 0-1 (0 = slow, 1 = fast) */
  speedScore: number;
  /** Relative quality score 0-1 (0 = low, 1 = high) */
  qualityScore: number;
  /** Max context window in tokens */
  maxContextTokens: number;
}
