import type { AIProvider } from './aiProvider';
import type { SearchProvider } from './searchProvider';
import type { ReaderProvider } from './readerProvider';
import type { CrawlProvider } from './crawlProvider';
import type { NewsProvider } from './newsProvider';
import type { EnrichmentProvider } from './enrichmentProvider';
import type { MemoryProvider } from './memoryProvider';
import type { ProviderInfo } from './types';
import type { ModelProvider } from '../models/ModelProvider';

import { createAIProvider } from './aiProvider';
import { createSearchProvider } from './searchProvider';
import { createReaderProvider } from './readerProvider';
import { createCrawlProvider } from './crawlProvider';
import { createNewsProvider } from './newsProvider';
import { createEnrichmentProvider } from './enrichmentProvider';
import { createMemoryProvider } from './memoryProvider';

import { OpenAIProvider } from './openai/OpenAIProvider';
import { GeminiProvider } from './gemini/GeminiProvider';
import { AnthropicProvider } from './anthropic/AnthropicProvider';
import { OpenRouterProvider } from './openrouter/OpenRouterProvider';
import { GroqProvider } from './groq/GroqProvider';
import { getProviderConfig } from '../models/ProviderConfig';
import { getAIHealthManager } from '../router/AIHealthManager';
import { getResearchHealthManager } from '../router/ResearchHealthManager';

/*
 * Provider Registry — single place where all providers are instantiated.
 *
 * To swap a provider (e.g. Mock → Tavily), change only its factory here.
 * The orchestrator and all frontend code remain untouched.
 *
 * The registry now supports multiple AI model providers via the
 * Intelligence Router. The legacy `ai` field is preserved for backwards
 * compatibility — existing agents that call `registry.ai.complete()`
 * continue to work. New code should use the Intelligence Router instead.
 *
 * To add a new model provider (DeepSeek, Mistral, Grok, Llama):
 *   1. Create a class implementing ModelProvider in services/providers/<name>/
 *   2. Register it in createProviderRegistry() below.
 *   3. Add its config to ProviderConfig.ts
 *   4. The Intelligence Router discovers it automatically. No router changes.
 */

export interface ProviderRegistry {
  // Legacy single-AI field (backwards compatibility)
  ai: AIProvider;
  search: SearchProvider;
  reader: ReaderProvider;
  crawl: CrawlProvider;
  news: NewsProvider;
  enrichment: EnrichmentProvider;
  memory: MemoryProvider;
  // Multi-model providers for the Intelligence Router
  modelProviders: ModelProvider[];
}

export function createProviderRegistry(): ProviderRegistry {
  const healthManager = getAIHealthManager();

  const modelProviders: ModelProvider[] = [
    new OpenAIProvider(),
    new GeminiProvider(),
    new AnthropicProvider(),
    new OpenRouterProvider(),
    new GroqProvider(),
  ];

  // Register all model providers with the Health Manager
  for (const provider of modelProviders) {
    const config = getProviderConfig(provider.id);
    const initialState = config?.enabled ? 'ACTIVE' : 'INACTIVE';
    healthManager.registerProvider(provider.id, initialState);
  }

  return {
    ai: createAIProvider(),
    search: createSearchProvider(),
    reader: createReaderProvider(),
    crawl: createCrawlProvider(),
    news: createNewsProvider(),
    enrichment: createEnrichmentProvider(),
    memory: createMemoryProvider(),
    modelProviders,
  };
}

export function getProviderInfo(registry: ProviderRegistry): ProviderInfo[] {
  const researchHealthManager = getResearchHealthManager();
  const infos: ProviderInfo[] = [
    { name: 'ai', implementation: registry.ai.name, isMock: registry.ai.isMock },
    { name: 'search', implementation: registry.search.name, isMock: registry.search.isMock },
    { name: 'reader', implementation: registry.reader.name, isMock: registry.reader.isMock },
    { name: 'crawl', implementation: registry.crawl.name, isMock: registry.crawl.isMock },
    { name: 'news', implementation: registry.news.name, isMock: registry.news.isMock },
    { name: 'enrichment', implementation: registry.enrichment.name, isMock: registry.enrichment.isMock },
    { name: 'memory', implementation: registry.memory.name, isMock: registry.memory.isMock },
  ];

  // Include research provider health states
  const researchHealth = researchHealthManager.getAllHealth();
  for (const record of researchHealth) {
    infos.push({
      name: 'ai' as ProviderInfo['name'],
      implementation: `${record.providerId} [${record.state}]`,
      isMock: record.state !== 'ACTIVE',
    });
  }

  for (const mp of registry.modelProviders) {
    infos.push({
      name: 'ai' as ProviderInfo['name'],
      implementation: mp.name,
      isMock: mp.isMock,
    });
  }

  return infos;
}

// Re-export all interfaces and types for convenience
export type { AIProvider } from './aiProvider';
export type { SearchProvider } from './searchProvider';
export type { ReaderProvider } from './readerProvider';
export type { CrawlProvider } from './crawlProvider';
export type { NewsProvider } from './newsProvider';
export type { EnrichmentProvider } from './enrichmentProvider';
export type { MemoryProvider } from './memoryProvider';
export type { ProviderRegistry as Registry } from './index';
export type * from './types';
