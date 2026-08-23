import type { SearchProvider } from '../providers/searchProvider';
import type { ReaderProvider } from '../providers/readerProvider';
import type { CrawlProvider } from '../providers/crawlProvider';
import type { Contact } from '@/lib/types';
import type { EvidencePackage } from './EvidencePackage';
import { createEvidencePackage } from './EvidencePackage';
import { SearchAgent } from './SearchAgent';
import { ReaderAgent } from './ReaderAgent';
import { ResearchPlanner } from './ResearchPlanner';
import { EvidenceCollector } from './EvidenceCollector';
import { FactExtractor } from './FactExtractor';
import { ConflictDetector } from './ConflictDetector';
import { TrustEngine } from './TrustEngine';
import { SourceAuthorityEngine } from './SourceAuthorityEngine';
import type { ResearchPlan } from './ResearchPlan';
import type { Fact } from './Fact';
import { VerifierAgent } from '../agents/verifier';

/*
 * ResearchCoordinator — orchestrates the full research + verification pipeline.
 *
 * Upgraded workflow (MP3 Part 2):
 *   Research Planner → Search Agent → Reader Agent → Evidence Collector
 *   → Fact Extractor → Verifier Agent → Conflict Detector → Trust Engine
 *   → Verified Evidence Package
 *
 * MP3.5B: Now accepts an optional CrawlProvider for Firecrawl integration.
 * The crawl provider is used to crawl company newsrooms and press pages
 * for additional evidence beyond what search and reader provide.
 *
 * The coordinator ONLY coordinates — it calls agents in sequence and passes
 * data between them. Business logic belongs inside agents.
 *
 * The DEL Orchestrator requests an EvidencePackage from the coordinator
 * before persona generation. The EvidencePackage (now verified) becomes the
 * single source of truth for AI reasoning.
 *
 * Backward compatibility: the `research()` method signature is preserved.
 * It now internally runs the full verification pipeline.
 */

export class ResearchCoordinator {
  private searchAgent: SearchAgent;
  private readerAgent: ReaderAgent;
  private planner: ResearchPlanner;
  private collector: EvidenceCollector;
  private factExtractor: FactExtractor;
  private verifierAgent: VerifierAgent;
  private conflictDetector: ConflictDetector;
  private trustEngine: TrustEngine;
  private authorityEngine: SourceAuthorityEngine;
  private crawlProvider?: CrawlProvider;

  constructor(searchProvider: SearchProvider, readerProvider: ReaderProvider, crawlProvider?: CrawlProvider) {
    this.searchAgent = new SearchAgent(searchProvider);
    this.readerAgent = new ReaderAgent(readerProvider);
    this.planner = new ResearchPlanner();
    this.collector = new EvidenceCollector();
    this.factExtractor = new FactExtractor();
    this.verifierAgent = new VerifierAgent();
    this.conflictDetector = new ConflictDetector();
    this.authorityEngine = new SourceAuthorityEngine();
    this.trustEngine = new TrustEngine(this.authorityEngine);
    this.crawlProvider = crawlProvider;
  }

  /**
   * Run the full research + verification pipeline for a contact.
   * Returns a Verified EvidencePackage ready for AI consumption.
   */
  async research(
    contact: Pick<
      Contact,
      'id' | 'name' | 'title' | 'company' | 'industry' | 'linkedin' | 'persona_provided' | 'notes'
    >,
  ): Promise<EvidencePackage> {
    // ── Phase 1: Evidence Collection (MP3 Part 1) ──

    // Step 1: Plan research
    const plan = this.planner.plan(contact);
    plan.status = 'searching';

    // Step 2: Create evidence package
    let evidence = createEvidencePackage(contact);
    evidence.metadata.planId = plan.planId;

    // Step 3: Execute searches based on the plan
    plan.status = 'searching';
    evidence = await this.searchAgent.searchFromPlan(plan, evidence);

    // Step 4: Read full page content from top search results
    plan.status = 'reading';
    evidence = await this.readerAgent.read(evidence);

    // Step 4b: Crawl company newsroom/website for additional evidence (Firecrawl)
    if (this.crawlProvider && evidence.company?.website) {
      plan.status = 'crawling';
      try {
        const crawledPages = await this.crawlProvider.crawl(evidence.company.website, {
          maxPages: 5,
          followLinks: true,
        });
        for (const page of crawledPages) {
          // Add crawled pages as additional documents
          if (!evidence.documents.some((d) => d.url === page.url)) {
            evidence.documents.push({
              url: page.url,
              title: page.title,
              text: page.text,
              publishedDate: page.crawledAt,
            });
          }
          // Add crawled pages as sources if not already present
          if (!evidence.sources.some((s) => s.url === page.url)) {
            evidence.sources.push({
              id: `src-crawl-${evidence.sources.length}`,
              url: page.url,
              title: page.title,
              sourceName: page.url,
              sourceTier: 2,
              snippet: page.text.slice(0, 500),
              publishedDate: page.crawledAt,
              retrievedAt: page.crawledAt,
              sourceType: 'company_website',
            });
          }
        }
        evidence.metadata.agentsRun.push('CrawlAgent');
      } catch {
        // Crawl failures are non-fatal — pipeline continues with search + reader evidence
      }
    }

    // Step 5: Collect and organize evidence into structured sections
    plan.status = 'collecting';
    evidence = this.collector.collect(evidence, plan);

    // ── Phase 2: Evidence Verification (MP3 Part 2) ──

    // Step 6: Extract structured facts from collected evidence
    plan.status = 'collecting';
    const facts = this.factExtractor.extract(evidence);
    evidence.facts = facts;
    evidence.metadata.agentsRun.push('FactExtractor');

    // Step 7: Detect conflicts among extracted facts
    const { facts: conflictCheckedFacts, conflicts } = this.conflictDetector.detect(facts, evidence.sources);
    evidence.facts = conflictCheckedFacts;
    evidence.conflicts = conflicts;
    evidence.metadata.agentsRun.push('ConflictDetector');

    // Step 8: Verify facts (cross-check, corroboration, freshness, authority)
    const authorityAssessments = this.authorityEngine.assessAll(evidence.sources);
    const authorityScores = new Map<string, number>();
    for (const [id, assessment] of Array.from(authorityAssessments.entries())) {
      authorityScores.set(id, assessment.score);
    }

    const verifiedFacts = this.verifierAgent.verifyFacts(conflictCheckedFacts, {
      sources: evidence.sources,
      authorityScores,
    });
    evidence.facts = verifiedFacts;
    evidence.metadata.agentsRun.push('VerifierAgent');

    // Step 9: Run the Trust Engine to compute trust scores and confidence
    evidence = this.trustEngine.evaluate(evidence);

    // ── Finalize ──

    plan.status = 'completed';
    plan.metadata.completedAt = new Date().toISOString();
    plan.metadata.documentsRead = evidence.documents.length;

    evidence.metadata.agentsRun.push('ResearchCoordinator');
    evidence.metadata.updatedAt = new Date().toISOString();

    return evidence;
  }

  /** Get the Research Planner instance. */
  getPlanner(): ResearchPlanner {
    return this.planner;
  }

  /** Get the Evidence Collector instance. */
  getCollector(): EvidenceCollector {
    return this.collector;
  }

  /** Get the Fact Extractor instance. */
  getFactExtractor(): FactExtractor {
    return this.factExtractor;
  }

  /** Get the Conflict Detector instance. */
  getConflictDetector(): ConflictDetector {
    return this.conflictDetector;
  }

  /** Get the Trust Engine instance. */
  getTrustEngine(): TrustEngine {
    return this.trustEngine;
  }

  /** Get the Source Authority Engine instance. */
  getAuthorityEngine(): SourceAuthorityEngine {
    return this.authorityEngine;
  }

  /** Get the Verifier Agent instance. */
  getVerifierAgent(): VerifierAgent {
    return this.verifierAgent;
  }
}
