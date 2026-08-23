import type { MemoryProvider } from '../providers/memoryProvider';
import { CacheManager } from './CacheManager';
import { EmbeddingService } from './EmbeddingService';
import type { EvidencePackage } from '../research/EvidencePackage';
import type { SynthesizedPersona, ScoreResult, InvitationDraft } from '../providers/types';
import type { ResearchJob } from '../models/ResearchJob';

/*
 * KnowledgeStore — persistent storage for all generated intelligence.
 *
 * Stores:
 *   - Evidence Packages (from research runs)
 *   - Personas (from synthesis)
 *   - Invitations (from copywriter)
 *   - Recommendations (from scorer)
 *   - Research Jobs (execution history)
 *
 * Currently uses the MemoryProvider's in-memory cache. When pgvector is
 * connected, the KnowledgeStore migrates to Supabase tables + pgvector
 * for semantic search over stored intelligence.
 *
 * The MemoryAgent uses the KnowledgeStore to retrieve previous results
 * before deciding whether to run fresh research.
 */

export class KnowledgeStore {
  private cache: CacheManager;
  private embeddings: EmbeddingService;

  constructor(memoryProvider: MemoryProvider) {
    this.cache = new CacheManager(memoryProvider);
    this.embeddings = new EmbeddingService(memoryProvider);
  }

  // ── Evidence Packages ──────────────────────

  async storeEvidence(contactId: string, evidence: EvidencePackage): Promise<void> {
    await this.cache.set(`evidence:${contactId}`, evidence);
    await this.embeddings.embed(
      `evidence:${contactId}`,
      `${evidence.contact.name} ${evidence.contact.company} ${evidence.verifiedFacts.map((f) => f.claim).join(' ')}`,
      { contactId, type: 'evidence' },
    );
  }

  async getEvidence(contactId: string): Promise<EvidencePackage | null> {
    return this.cache.get<EvidencePackage>(`evidence:${contactId}`);
  }

  // ── Personas ───────────────────────────────

  async storePersona(contactId: string, persona: SynthesizedPersona): Promise<void> {
    await this.cache.set(`persona:${contactId}`, persona);
    await this.embeddings.embed(
      `persona:${contactId}`,
      persona.facts.map((f) => f.value).join(' '),
      { contactId, type: 'persona' },
    );
  }

  async getPersona(contactId: string): Promise<SynthesizedPersona | null> {
    return this.cache.get<SynthesizedPersona>(`persona:${contactId}`);
  }

  // ── Invitations ────────────────────────────

  async storeInvitation(contactId: string, eventId: string, draft: InvitationDraft): Promise<void> {
    await this.cache.set(`invitation:${contactId}:${eventId}`, draft);
  }

  async getInvitation(contactId: string, eventId: string): Promise<InvitationDraft | null> {
    return this.cache.get<InvitationDraft>(`invitation:${contactId}:${eventId}`);
  }

  // ── Recommendations ────────────────────────

  async storeRecommendation(contactId: string, eventId: string, result: ScoreResult): Promise<void> {
    await this.cache.set(`recommendation:${contactId}:${eventId}`, result);
  }

  async getRecommendation(contactId: string, eventId: string): Promise<ScoreResult | null> {
    return this.cache.get<ScoreResult>(`recommendation:${contactId}:${eventId}`);
  }

  // ── Research Jobs ──────────────────────────

  async storeJob(job: ResearchJob): Promise<void> {
    await this.cache.set(`job:${job.jobId}`, job);
  }

  async getJob(jobId: string): Promise<ResearchJob | null> {
    return this.cache.get<ResearchJob>(`job:${jobId}`);
  }

  // ── Semantic search ───────────────────────

  async searchSimilar(text: string, k = 5) {
    return this.embeddings.search(text, k);
  }
}
