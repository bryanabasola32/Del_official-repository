/*
 * aiProvider.ts — backwards-compatible re-export shim.
 *
 * This file previously contained all AI logic directly. It has been refactored
 * into a modular provider-based architecture:
 *
 *   services/providers/    — external API abstractions (AI, Search, Reader, etc.)
 *   services/agents/       — business logic (Researcher, Verifier, Synthesizer, etc.)
 *   services/orchestrator.ts — coordinates providers + agents, handles DB persistence
 *   services/router/        — Intelligence Router (multi-model LLM execution)
 *   services/models/       — Task Types, Capabilities, ResearchJob
 *   services/research/     — Research Coordinator, EvidencePackage, Search/Reader Agents
 *   services/memory/       — Memory Agent, Knowledge Store, Cache Manager, Embedding Service
 *   services/logging/      — Structured Execution Logger
 *
 * Existing imports from '@/services/aiProvider' continue to work unchanged.
 * New code should import from '@/services/orchestrator' directly.
 */

export {
  generateExecutiveIntelligence,
  generateRecommendation,
  generateInvitation,
  orchestrator,
  getOrchestrator,
  DelOrchestrator,
} from './orchestrator';

export type {
  SynthesizedPersona,
  ScoreResult,
  InvitationDraft,
  RawFinding,
  VerifiedFinding,
  SynthesizedFact,
  ProviderInfo,
} from './providers/types';

export type { AIProvider as AIProviderInterface } from './providers/aiProvider';
export type { SearchProvider as SearchProviderInterface } from './providers/searchProvider';
export type { ReaderProvider as ReaderProviderInterface } from './providers/readerProvider';
export type { CrawlProvider as CrawlProviderInterface } from './providers/crawlProvider';
export type { NewsProvider as NewsProviderInterface } from './providers/newsProvider';
export type { EnrichmentProvider as EnrichmentProviderInterface } from './providers/enrichmentProvider';
export type { MemoryProvider as MemoryProviderInterface } from './providers/memoryProvider';

// AI OS re-exports
export type { ModelProvider } from './models/ModelProvider';
export type { ModelProviderProfile, Capability } from './models/AIModelCapabilities';
export type { TaskType, TaskTypeSpec, Priority } from './models/TaskTypes';
export type { ResearchJob, ResearchJobStatus } from './models/ResearchJob';
export type { EvidencePackage } from './research/EvidencePackage';
export type { RouterTask } from './router/IntelligenceRouter';
export type { MemoryAgent } from './memory/MemoryAgent';
