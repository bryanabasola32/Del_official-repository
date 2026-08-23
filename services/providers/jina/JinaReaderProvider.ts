import type { ReaderProvider } from '../readerProvider';
import type { PageContent } from '../types';
import { MockReaderProvider } from '../readerProvider';
import { getResearchProviderConfig } from '../../models/ResearchProviderConfig';
import { getResearchHealthManager } from '../../router/ResearchHealthManager';
import { getResearchQuotaManager } from '../../router/ResearchQuotaManager';
import { callResearchEdgeFunction } from '../researchEdgeCall';
import { getExecutionLogger } from '../../logging';

/*
 * JinaReaderProvider — production webpage extraction via Jina Reader API.
 *
 * Production mode: calls the `jina-reader` edge function which proxies
 * the Jina Reader API (https://r.jina.ai/), reads JINA_API_KEY from
 * Supabase secrets, and returns normalized PageContent.
 *
 * Mock fallback: if the edge function is unreachable, the API key is
 * missing, or quota is exhausted, falls back to MockReaderProvider.
 *
 * Returns DEL PageContent — no Jina response object escapes.
 */

interface JinaEdgeResponse {
  page: PageContent;
  mock?: boolean;
  warning?: string;
}

export class JinaReaderProvider implements ReaderProvider {
  readonly name = 'jina-reader';
  readonly isMock = false;

  private mock = new MockReaderProvider();
  private logger = getExecutionLogger();

  isConfigured(): boolean {
    const config = getResearchProviderConfig('jina');
    return !!config?.enabled;
  }

  async read(url: string): Promise<PageContent> {
    const config = getResearchProviderConfig('jina');
    const healthManager = getResearchHealthManager();
    const quotaManager = getResearchQuotaManager();

    if (!config) return this.mock.read(url);

    if (!healthManager.isAvailable('jina')) {
      this.logger.warning('reader', `Jina unavailable (${healthManager.getState('jina')}) — using mock fallback`);
      return this.mock.read(url);
    }

    const result = await callResearchEdgeFunction<JinaEdgeResponse>(
      config.edgeFunctionSlug,
      'jina',
      { url },
      { timeoutMs: config.timeoutMs, maxRetries: config.maxRetries },
    );

    if (result.ok && result.data?.page) {
      this.logger.logResearchExecution({
        stage: 'reader',
        provider: 'jina',
        providerCategory: 'reader',
        latencyMs: result.latencyMs,
        retries: result.retries,
        fallback: false,
        resultCount: 1,
        mock: result.data.mock ?? false,
        warning: result.data.warning,
      });
      return result.data.page;
    }

    quotaManager.handleProviderError('jina', result.error || 'Unknown error', result.status);
    this.logger.logResearchExecution({
      stage: 'reader',
      provider: 'jina',
      providerCategory: 'reader',
      latencyMs: result.latencyMs,
      retries: result.retries,
      fallback: true,
      resultCount: 0,
      mock: true,
      warning: `Jina failed: ${result.error}. Using mock fallback.`,
    });
    return this.mock.read(url);
  }
}
