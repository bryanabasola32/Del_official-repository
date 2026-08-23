import type { EvidencePackage } from '../research/EvidencePackage';
import { TrustEngine } from '../research/TrustEngine';
import type { EvidenceContext } from '../research/EvidenceContextBuilder';
import { EvidenceContextBuilder } from '../research/EvidenceContextBuilder';
import { getCuratedEvidenceLibrary } from './CuratedEvidenceLibrary';
import { getFallbackPolicy } from './CuratedEvidenceFallbackPolicy';
import type { FallbackDecision, PlanBUsageInfo } from './CuratedEvidenceTypes';
import { getExecutionLogger } from '../logging';

/*
 * PlanBEnricher — the single integration point between the curated evidence
 * library and the live research pipeline.
 *
 * Flow:
 *   Live EvidencePackage (already through TrustEngine)
 *     → FallbackPolicy.evaluate()
 *       → if shouldEnrich: load curated package → merge → TrustEngine again
 *       → if not: return live evidence as-is
 *     → EvidenceContextBuilder.build()
 *     → return EvidenceContext + PlanBUsageInfo
 *
 * Every failure path falls back to live evidence. Plan B never breaks DEL.
 */

export interface PlanBResult {
  evidenceContext: EvidenceContext;
  finalEvidence: EvidencePackage;
  fallbackDecision: FallbackDecision;
  usageInfo: PlanBUsageInfo;
}

const NO_USAGE: PlanBUsageInfo = {
  used: false,
  libraryVersion: null,
  liveTrustScore: 0,
  finalTrustScore: 0,
  curatedSourceCount: 0,
  curatedFactCount: 0,
  sourcesAdded: 0,
  factsAdded: 0,
};

export class PlanBEnricher {
  private trustEngine: TrustEngine;
  private contextBuilder: EvidenceContextBuilder;
  private logger = getExecutionLogger();

  constructor(trustEngine?: TrustEngine, contextBuilder?: EvidenceContextBuilder) {
    this.trustEngine = trustEngine ?? new TrustEngine();
    this.contextBuilder = contextBuilder ?? new EvidenceContextBuilder();
  }

  /**
   * Evaluate live evidence, optionally enrich with curated evidence, then
   * build the final EvidenceContext. This is the single entry point called
   * by the orchestrator.
   */
  async enrich(
    liveEvidence: EvidencePackage,
    contactId: string,
  ): Promise<PlanBResult> {
    const policy = getFallbackPolicy();
    const decision = policy.evaluate(liveEvidence);
    const logger = this.logger;

    if (!decision.shouldEnrich) {
      logger.info('plan_b', `Plan B not needed for contact ${contactId}: live evidence sufficient (trust=${decision.liveTrustScore})`);
      const context = this.contextBuilder.build(liveEvidence);
      return {
        evidenceContext: context,
        finalEvidence: liveEvidence,
        fallbackDecision: decision,
        usageInfo: {
          ...NO_USAGE,
          liveTrustScore: decision.liveTrustScore,
          finalTrustScore: decision.liveTrustScore,
        },
      };
    }

    // Plan B is needed — try to load curated evidence
    const library = getCuratedEvidenceLibrary();
    let curatedEvidence: EvidencePackage | null = null;
    let libraryVersion = 0;

    try {
      const meta = await library.getActivePackageMeta(contactId);
      if (meta) {
        libraryVersion = meta.version;
        curatedEvidence = await library.getActivePackage(contactId);
      }
    } catch (err) {
      logger.warning('plan_b', `Failed to load curated package for contact ${contactId}: ${err instanceof Error ? err.message : 'unknown'}`);
    }

    if (!curatedEvidence) {
      logger.info('plan_b', `No curated package found for contact ${contactId} — using live evidence`);
      const context = this.contextBuilder.build(liveEvidence);
      return {
        evidenceContext: context,
        finalEvidence: liveEvidence,
        fallbackDecision: decision,
        usageInfo: {
          ...NO_USAGE,
          liveTrustScore: decision.liveTrustScore,
          finalTrustScore: decision.liveTrustScore,
        },
      };
    }

    // Merge live + curated evidence
    let mergedEvidence: EvidencePackage;
    const liveSourceCount = liveEvidence.sources.length;
    const liveFactCount = liveEvidence.facts.length;

    try {
      const { CuratedEvidenceAdapter } = await import('./CuratedEvidenceAdapter');
      const adapter = new CuratedEvidenceAdapter();
      mergedEvidence = adapter.merge(liveEvidence, curatedEvidence);
      logger.info('plan_b', `Merged evidence for contact ${contactId}: ${mergedEvidence.sources.length} sources, ${mergedEvidence.facts.length} facts`);
    } catch (err) {
      logger.warning('plan_b', `Merge failed for contact ${contactId}: ${err instanceof Error ? err.message : 'unknown'} — using live evidence`);
      const context = this.contextBuilder.build(liveEvidence);
      return {
        evidenceContext: context,
        finalEvidence: liveEvidence,
        fallbackDecision: decision,
        usageInfo: {
          ...NO_USAGE,
          liveTrustScore: decision.liveTrustScore,
          finalTrustScore: decision.liveTrustScore,
        },
      };
    }

    // Re-run TrustEngine on merged evidence
    let finalEvidence: EvidencePackage;
    try {
      finalEvidence = this.trustEngine.evaluate(mergedEvidence);
      logger.info('plan_b', `TrustEngine recalculated for contact ${contactId}: trust=${finalEvidence.trustScore} (was ${decision.liveTrustScore})`);
    } catch (err) {
      logger.warning('plan_b', `TrustEngine recalculation failed for contact ${contactId}: ${err instanceof Error ? err.message : 'unknown'} — using pre-merge evidence`);
      const context = this.contextBuilder.build(mergedEvidence);
      return {
        evidenceContext: context,
        finalEvidence: mergedEvidence,
        fallbackDecision: decision,
        usageInfo: {
          used: true,
          libraryVersion,
          liveTrustScore: decision.liveTrustScore,
          finalTrustScore: mergedEvidence.trustScore,
          curatedSourceCount: curatedEvidence.sources.length,
          curatedFactCount: curatedEvidence.facts.length,
          sourcesAdded: mergedEvidence.sources.length - liveSourceCount,
          factsAdded: mergedEvidence.facts.length - liveFactCount,
        },
      };
    }

    // Build the final EvidenceContext from the re-trusted merged evidence
    const context = this.contextBuilder.build(finalEvidence);

    const usageInfo: PlanBUsageInfo = {
      used: true,
      libraryVersion,
      liveTrustScore: decision.liveTrustScore,
      finalTrustScore: finalEvidence.trustScore,
      curatedSourceCount: curatedEvidence.sources.length,
      curatedFactCount: curatedEvidence.facts.length,
      sourcesAdded: finalEvidence.sources.length - liveSourceCount,
      factsAdded: finalEvidence.facts.length - liveFactCount,
    };

    return {
      evidenceContext: context,
      finalEvidence,
      fallbackDecision: decision,
      usageInfo,
    };
  }

  /** Check if a newer curated package version exists (for cache invalidation). */
  async hasNewerCuratedVersion(contactId: string, knownVersion: number): Promise<boolean> {
    try {
      const library = getCuratedEvidenceLibrary();
      return await library.hasNewerVersion(contactId, knownVersion);
    } catch {
      return false;
    }
  }
}

// ── Singleton ────────────────────────────────────────

let _enricher: PlanBEnricher | null = null;

export function getPlanBEnricher(): PlanBEnricher {
  if (!_enricher) {
    _enricher = new PlanBEnricher();
  }
  return _enricher;
}
