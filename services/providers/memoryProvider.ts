import type { EmbeddingRecord, SimilarityResult } from './types';

/*
 * MemoryProvider — vector storage and semantic similarity search.
 *
 * Implementations:
 *   - MockMemoryProvider    (in-memory placeholder, no persistence)
 *   - PgvectorMemoryProvider (future: pgvector in Supabase Postgres)
 *
 * Used to store embeddings of past research so semantically similar queries
 * can be reused instead of re-fetched. Also provides simple key-value caching.
 *
 * NOTE: In edge functions, module-level state is NOT shared across instances.
 * The real implementation must use pgvector tables in Supabase, not in-memory maps.
 */

export interface MemoryProvider {
  readonly name: string;
  readonly isMock: boolean;

  /** Store an embedding for later similarity search. */
  storeEmbedding(key: string, text: string, metadata?: Record<string, unknown>): Promise<void>;

  /** Find semantically similar stored records. */
  searchSimilar(text: string, k?: number): Promise<SimilarityResult[]>;

  /** Simple key-value cache get. */
  getCached<T>(key: string): Promise<T | null>;

  /** Simple key-value cache set. */
  setCached<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;

  isConfigured(): boolean;
}

// ── Mock Implementation ──────────────────────────

export class MockMemoryProvider implements MemoryProvider {
  readonly name = 'mock-memory';
  readonly isMock = true;

  private embeddings: EmbeddingRecord[] = [];
  private cache: Map<string, { value: unknown; expires?: number }> = new Map();

  isConfigured(): boolean {
    return true;
  }

  async storeEmbedding(key: string, text: string, metadata: Record<string, unknown> = {}): Promise<void> {
    // Mock embedding: simple hash-based vector
    const embedding = this.mockEmbed(text);
    this.embeddings.push({ id: key, key, text, embedding, metadata });
  }

  async searchSimilar(text: string, k = 5): Promise<SimilarityResult[]> {
    const queryEmbedding = this.mockEmbed(text);
    return this.embeddings
      .map((rec) => ({
        id: rec.id,
        key: rec.key,
        text: rec.text,
        score: this.cosineSimilarity(queryEmbedding, rec.embedding),
        metadata: rec.metadata,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, k);
  }

  async getCached<T>(key: string): Promise<T | null> {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (entry.expires && entry.expires < Date.now()) {
      this.cache.delete(key);
      return null;
    }
    return entry.value as T;
  }

  async setCached<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    this.cache.set(key, {
      value,
      expires: ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined,
    });
  }

  private mockEmbed(text: string): number[] {
    // Deterministic 384-dim pseudo-embedding for mock similarity
    const vec: number[] = [];
    for (let i = 0; i < 384; i++) {
      vec.push((text.charCodeAt(i % text.length) * (i + 1)) % 100 / 100);
    }
    return vec;
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    let dot = 0, magA = 0, magB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      magA += a[i] * a[i];
      magB += b[i] * b[i];
    }
    return magA && magB ? dot / (Math.sqrt(magA) * Math.sqrt(magB)) : 0;
  }
}

// ── Factory ──────────────────────────────────────

export function createMemoryProvider(): MemoryProvider {
  return new MockMemoryProvider();
}
