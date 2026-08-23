import type { MemoryProvider } from '../providers/memoryProvider';
import { KnowledgeStore } from './KnowledgeStore';
import { CacheManager } from './CacheManager';
import { EmbeddingService } from './EmbeddingService';
import type { EvidencePackage } from '../research/EvidencePackage';
import type { SynthesizedPersona, ScoreResult, InvitationDraft } from '../providers/types';
import type { ResearchJob } from '../models/ResearchJob';

/*
 * MemoryAgent — the intelligence memory layer.
 *
 * Responsibilities:
 *   1. Check cache before any research — return cached EvidencePackage if exists.
 *   2. Retrieve previous personas, invitations, and recommendations.
 *   3. Store all generated intelligence after a pipeline run.
 *   4. Store ResearchJob history.
 *
 * Workflow (before any research):
 *   MemoryAgent → Cache exists? → YES → Return cached EvidencePackage
 *                                  NO  → Continue Research → Store completed EvidencePackage
 *
 * The MemoryAgent wraps the KnowledgeStore, CacheManager, and EmbeddingService
 * into a single agent interface that the orchestrator calls.
 *
 * Future: pgvector integration for semantic search over stored intelligence.
 * Only the EmbeddingService changes — the MemoryAgent interface stays the same.
 */

export class MemoryAgent {
  private store: KnowledgeStore;
  private cache: CacheManager;
  private embeddings: EmbeddingService;

  constructor(memoryProvider: MemoryProvider) {
    this.store = new KnowledgeStore(memoryProvider);
    this.cache = new CacheManager(memoryProvider);
    this.embeddings = new EmbeddingService(memoryProvider);
  }

  // ── Cache check before research ────────────

  /** Check if a cached EvidencePackage exists for this contact. */
  async checkCache(contactId: string): Promise<EvidencePackage | null> {
    return this.store.getEvidence(contactId);
  }

  /** Store a completed EvidencePackage. */
  async storeEvidencePackage(contactId: string, evidence: EvidencePackage): Promise<void> {
    await this.store.storeEvidence(contactId, evidence);
  }

  // ── Persona retrieval / storage ────────────

  async getPersona(contactId: string): Promise<SynthesizedPersona | null> {
    return this.store.getPersona(contactId);
  }

  async storePersona(contactId: string, persona: SynthesizedPersona): Promise<void> {
    await this.store.storePersona(contactId, persona);
  }

  // ── Invitation retrieval / storage ────────

  async getInvitation(contactId: string, eventId: string): Promise<InvitationDraft | null> {
    return this.store.getInvitation(contactId, eventId);
  }

  async storeInvitation(contactId: string, eventId: string, draft: InvitationDraft): Promise<void> {
    await this.store.storeInvitation(contactId, eventId, draft);
  }

  // ── Recommendation retrieval / storage ────

  async getRecommendation(contactId: string, eventId: string): Promise<ScoreResult | null> {
    return this.store.getRecommendation(contactId, eventId);
  }

  async storeRecommendation(contactId: string, eventId: string, result: ScoreResult): Promise<void> {
    await this.store.storeRecommendation(contactId, eventId, result);
  }

  // ── ResearchJob history ───────────────────

  async storeJob(job: ResearchJob): Promise<void> {
    await this.store.storeJob(job);
  }

  async getJob(jobId: string): Promise<ResearchJob | null> {
    return this.store.getJob(jobId);
  }

  // ── Semantic search ───────────────────────

  async searchSimilar(text: string, k = 5) {
    return this.store.searchSimilar(text, k);
  }

  // ── Generic cache (for ad-hoc use) ─────────

  async getCached<T>(key: string): Promise<T | null> {
    return this.cache.get<T>(key);
  }

  async setCached<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    await this.cache.set(key, value, ttlSeconds);
  }

  async getOrCompute<T>(key: string, compute: () => Promise<T>, ttlSeconds?: number): Promise<T> {
    return this.cache.getOrCompute(key, compute, ttlSeconds);
  }
}
