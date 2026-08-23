import type { MemoryProvider } from '../providers/memoryProvider';

/*
 * EmbeddingService — abstracts embedding generation and similarity search.
 *
 * Wraps the MemoryProvider's vector operations. When pgvector is connected,
 * only this service needs to change — all callers (MemoryAgent, CacheManager)
 * continue using the same interface.
 *
 * Currently uses the MockMemoryProvider's deterministic pseudo-embeddings.
 * Future: swap to real embedding model (e.g. text-embedding-3-small) via
 * edge function, with pgvector storage in Supabase.
 */

export class EmbeddingService {
  constructor(private memoryProvider: MemoryProvider) {}

  /** Generate and store an embedding for a text blob. */
  async embed(key: string, text: string, metadata?: Record<string, unknown>): Promise<void> {
    await this.memoryProvider.storeEmbedding(key, text, metadata);
  }

  /** Find semantically similar stored records. */
  async search(text: string, k = 5): Promise<{ id: string; key: string; text: string; score: number; metadata: Record<string, unknown> }[]> {
    return this.memoryProvider.searchSimilar(text, k);
  }
}
