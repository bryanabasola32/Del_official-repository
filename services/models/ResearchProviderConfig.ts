/*
 * ResearchProviderConfig — centralized configuration for research providers.
 *
 * Mirrors the AI ProviderConfig pattern. Each research provider has its
 * own entry with edge function slug, timeout, retry count, and enabled flag.
 *
 * To add a new research provider:
 *   1. Add an entry to RESEARCH_PROVIDER_CONFIGS below.
 *   2. Create the provider class implementing the relevant interface.
 *   3. Register it in the factory function in the provider file.
 * No architecture changes required.
 */

export type ResearchProviderLifecycleState =
  | 'ACTIVE'
  | 'INITIALIZING'
  | 'QUOTA_EXHAUSTED'
  | 'OFFLINE'
  | 'DISABLED';

export interface ResearchProviderConfig {
  id: string;
  name: string;
  enabled: boolean;
  edgeFunctionSlug: string;
  timeoutMs: number;
  maxRetries: number;
  /** Environment variable name for the API key (read by the edge function) */
  apiKeyEnvVar: string;
  /** Max results to request per call */
  maxResults: number;
}

export const RESEARCH_PROVIDER_CONFIGS: Record<string, ResearchProviderConfig> = {
  tavily: {
    id: 'tavily',
    name: 'Tavily Search',
    enabled: true,
    edgeFunctionSlug: 'tavily-search',
    timeoutMs: 20000,
    maxRetries: 2,
    apiKeyEnvVar: 'TAVILY_API_KEY',
    maxResults: 5,
  },
  jina: {
    id: 'jina',
    name: 'Jina Reader',
    enabled: true,
    edgeFunctionSlug: 'jina-reader',
    timeoutMs: 20000,
    maxRetries: 2,
    apiKeyEnvVar: 'JINA_API_KEY',
    maxResults: 1,
  },
  firecrawl: {
    id: 'firecrawl',
    name: 'Firecrawl',
    enabled: true,
    edgeFunctionSlug: 'firecrawl',
    timeoutMs: 30000,
    maxRetries: 2,
    apiKeyEnvVar: 'FIRECRAWL_API_KEY',
    maxResults: 10,
  },
  marketaux: {
    id: 'marketaux',
    name: 'Marketaux News',
    enabled: true,
    edgeFunctionSlug: 'news-provider',
    timeoutMs: 20000,
    maxRetries: 2,
    apiKeyEnvVar: 'MARKETAUX_API_KEY',
    maxResults: 10,
  },
};

export function getResearchProviderConfig(id: string): ResearchProviderConfig | undefined {
  return RESEARCH_PROVIDER_CONFIGS[id];
}

export function getEnabledResearchProviderConfigs(): ResearchProviderConfig[] {
  return Object.values(RESEARCH_PROVIDER_CONFIGS).filter((c) => c.enabled);
}
