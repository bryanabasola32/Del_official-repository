import { supabase } from '@/lib/supabase';
import type { Contact, EventItem, PersonaFact } from '@/lib/types';
import type {
  SynthesizedPersona,
  ScoreResult,
  InvitationDraft,
  ProviderInfo,
} from './providers/types';
import { createProviderRegistry, type ProviderRegistry } from './providers';
import { getProviderInfo } from './providers';
import {
  ResearcherAgent,
  VerifierAgent,
  SynthesizerAgent,
  ScorerAgent,
  CopywriterAgent,
} from './agents';

import { IntelligenceRouter, getIntelligenceRouter } from './router';
import type { RouterTask } from './router';
import { ResearchCoordinator } from './research';
import type { EvidencePackage } from './research';
import { EvidenceContextBuilder } from './research/EvidenceContextBuilder';
import { PromptBuilder } from './research/PromptBuilder';
import type { BuiltPrompt } from './research/PromptBuilder';
import { ConfidencePropagator } from './research/ConfidencePropagator';
import type { ConfidenceAssessment } from './research/ConfidencePropagator';
import { ExplainabilityLayer } from './research/ExplainabilityLayer';
import type { ExplainabilityReport } from './research/ExplainabilityLayer';
import { CitationMapper } from './research/CitationMapper';
import type { CitationMap } from './research/CitationMapper';
import { MemoryAgent } from './memory';
import {
  createResearchJob,
  addLog,
  recordAgentExecution,
  completeJob,
  failJob,
  type ResearchJob,
} from './models';
import { getExecutionLogger } from './logging';
import { runIntelligencePipeline } from './intelligencePipeline';
import { getPlanBEnricher } from './evidence';
import type { PlanBUsageInfo } from './evidence';

/*
 * Del Orchestrator
 * =================
 *
 * The single entry point for all AI operations in Del.
 * Frontend components call the Orchestrator — never providers or agents directly.
 *
 * The Orchestrator:
 *   1. Instantiates and owns the provider registry (dependency injection).
 *   2. Creates agent instances, injecting the providers they need.
 *   3. Coordinates multi-agent pipelines (Researcher → Verifier → Synthesizer → Scorer → Copywriter).
 *   4. Handles database persistence (Supabase) and activity logging.
 *   5. Provides the same public API as the old aiProvider.ts so call sites don't change.
 *
 * NEW (AI OS Upgrade):
 *   6. Owns the Intelligence Router — the only entry point for LLM execution.
 *   7. Owns the ResearchCoordinator — produces EvidencePackages before persona generation.
 *   8. Owns the MemoryAgent — caches evidence, personas, invitations, and jobs.
 *   9. Creates a ResearchJob for every pipeline run — DEL's execution history.
 *  10. Pushes structured execution logs for monitoring dashboards.
 *
 * To swap a provider (e.g. Mock → Tavily), change only the factory in
 * services/providers/index.ts. The Orchestrator and all frontend code remain untouched.
 *
 * To add a new AI model provider (Gemini, DeepSeek, etc.): register it in
 * services/providers/index.ts. The Intelligence Router discovers it automatically.
 *
 * Edge Function Compatibility:
 *   The Orchestrator and all providers use only Web APIs (fetch, crypto, etc.)
 *   and the Supabase JS client. No Node-specific modules. This makes the entire
 *   service layer compatible with Supabase Edge Functions (Deno runtime).
 */

export class DelOrchestrator {
  private registry: ProviderRegistry;
  private researcher: ResearcherAgent;
  private verifier: VerifierAgent;
  private synthesizer: SynthesizerAgent;
  private scorer: ScorerAgent;
  private copywriter: CopywriterAgent;
  private router: IntelligenceRouter;
  private researchCoordinator: ResearchCoordinator;
  private memoryAgent: MemoryAgent;
  private evidenceContextBuilder: EvidenceContextBuilder;
  private promptBuilder: PromptBuilder;
  private confidencePropagator: ConfidencePropagator;
  private explainabilityLayer: ExplainabilityLayer;
  private citationMapper: CitationMapper;
  private logger = getExecutionLogger();

  constructor(registry?: ProviderRegistry) {
    this.registry = registry ?? createProviderRegistry();
    this.researcher = new ResearcherAgent(this.registry);
    this.verifier = new VerifierAgent();
    this.synthesizer = new SynthesizerAgent(this.registry);
    this.scorer = new ScorerAgent();
    this.copywriter = new CopywriterAgent();

    // AI OS: Initialize the Intelligence Router and register model providers
    this.router = getIntelligenceRouter();
    for (const mp of this.registry.modelProviders) {
      this.router.registerProvider(mp);
    }

    // AI OS: Initialize the Research Coordinator (wraps Search + Reader agents)
    this.researchCoordinator = new ResearchCoordinator(
      this.registry.search,
      this.registry.reader,
      this.registry.crawl,
    );

    // AI OS: Initialize the Memory Agent (wraps MemoryProvider)
    this.memoryAgent = new MemoryAgent(this.registry.memory);

    // MP3 Part 3: Evidence Intelligence Integration Layer
    this.evidenceContextBuilder = new EvidenceContextBuilder();
    this.promptBuilder = new PromptBuilder();
    this.confidencePropagator = new ConfidencePropagator();
    this.explainabilityLayer = new ExplainabilityLayer();
    this.citationMapper = new CitationMapper();
  }

  /** Returns metadata about all active providers (for diagnostics / UI display). */
  getProviderInfo(): ProviderInfo[] {
    return getProviderInfo(this.registry);
  }

  /** Returns the Intelligence Router instance (for direct task execution). */
  getRouter(): IntelligenceRouter {
    return this.router;
  }

  /** Safety net: ensure all model providers are registered with the router. */
  ensureProvidersRegistered(): void {
    for (const mp of this.registry.modelProviders) {
      this.router.registerProvider(mp);
    }
  }

  /** Get count of registered model providers (for diagnostics). */
  getProviderCount(): number {
    return this.router.getProviders().length;
  }

  /** Get IDs of all registered model providers (for diagnostics). */
  getProviderIds(): string[] {
    return this.router.getProviders().map((p) => p.id);
  }

  /** Returns the Memory Agent instance (for cache inspection). */
  getMemoryAgent(): MemoryAgent {
    return this.memoryAgent;
  }

  /** Returns the Research Coordinator instance. */
  getResearchCoordinator(): ResearchCoordinator {
    return this.researchCoordinator;
  }

  /** Returns all registered model provider profiles. */
  getModelProviderProfiles() {
    return this.router.getProviderProfiles();
  }

  // ═════════════════════════════════════════════════
  // PUBLIC API — matches the old aiProvider.ts signatures
  // ═════════════════════════════════════════════════

  /**
   * Full intelligence pipeline for one contact.
   * Researcher → Verifier → Synthesizer → proactive Scorer (all upcoming events).
   * Writes persona_facts, sources, updates contact, logs activity.
   *
   * AI OS: Now creates a ResearchJob, uses the ResearchCoordinator for
   * evidence gathering, and checks the MemoryAgent cache before research.
   */
  async generateExecutiveIntelligence(contactId: string): Promise<SynthesizedPersona> {
    const { data: contact } = await supabase
      .from('contacts')
      .select('*')
      .eq('id', contactId)
      .maybeSingle();
    if (!contact) throw new Error('Contact not found');

    // Create ResearchJob — DEL's universal execution object
    const job = createResearchJob(contact);
    const stageId = this.logger.startStage('full_pipeline', {
      agentName: 'DelOrchestrator',
      metadata: { contactId, contactName: contact.name },
    });
    addLog(job, { stage: 'pipeline', level: 'info', message: `Starting intelligence pipeline for ${contact.name}` });

    // Update status
    await supabase.from('contacts').update({ persona_status: 'searching' }).eq('id', contactId);

    // Log analysis run start
    const { data: run } = await supabase
      .from('analysis_runs')
      .insert({
        contact_id: contactId,
        run_type: 'full_pipeline',
        status: 'running',
        llm_provider: this.registry.ai.name,
        search_provider: this.registry.search.name,
        prompt_version: 'v2.0',
      })
      .select()
      .maybeSingle();

    const startTime = Date.now();

    try {
      // ── AI OS: Check memory cache for existing EvidencePackage ──
      addLog(job, { stage: 'memory', level: 'info', message: 'Checking memory cache for existing evidence...' });
      const cachedEvidence = await this.memoryAgent.checkCache(contactId);
      let evidence: EvidencePackage | null = cachedEvidence;

      if (cachedEvidence) {
        addLog(job, { stage: 'memory', level: 'info', message: 'Cache hit — using cached EvidencePackage' });
        this.logger.info('memory', `Cache hit for ${contact.name}`, { metadata: { contactId } });
      } else {
        // ── AI OS: Run ResearchCoordinator to build fresh EvidencePackage ──
        job.status = 'researching';
        addLog(job, { stage: 'research', level: 'info', message: 'Running ResearchCoordinator...' });
        this.logger.info('research', `Starting research for ${contact.name}`, { metadata: { contactId } });

        const researchStageId = this.logger.startStage('research', { agentName: 'ResearchCoordinator' });
        evidence = await this.researchCoordinator.research(contact);
        this.logger.completeStage(researchStageId, true, { sources: evidence.sources.length });

        addLog(job, { stage: 'research', level: 'info', message: `Research complete: ${evidence.sources.length} sources, ${evidence.confidence}% confidence` });

        // Store the EvidencePackage in memory
        await this.memoryAgent.storeEvidencePackage(contactId, evidence);
        addLog(job, { stage: 'memory', level: 'info', message: 'EvidencePackage stored in memory' });
      }

      job.evidencePackage = evidence;

      if (!evidence) {
        throw new Error('Evidence package is null — research and memory cache both failed to produce evidence');
      }

      // ── Plan B: Curated Evidence Library Enrichment ──
      // Evaluate whether live evidence is sufficient. If not, merge with
      // curated evidence from the library, re-run TrustEngine, then build
      // the final EvidenceContext. Plan B is additive and fails safely.
      addLog(job, { stage: 'plan_b', level: 'info', message: 'Evaluating evidence sufficiency...' });
      let planBUsage: PlanBUsageInfo | null = null;
      let evidenceContext;
      try {
        const planBResult = await getPlanBEnricher().enrich(evidence, contactId);
        evidenceContext = planBResult.evidenceContext;
        planBUsage = planBResult.usageInfo;
        evidence = planBResult.finalEvidence;
        job.evidencePackage = evidence;

        if (planBUsage.used) {
          addLog(job, { stage: 'plan_b', level: 'info', message: `Plan B enrichment used: library v${planBUsage.libraryVersion}, trust ${planBUsage.liveTrustScore}→${planBUsage.finalTrustScore}, +${planBUsage.sourcesAdded} sources, +${planBUsage.factsAdded} facts` });

          // Log Plan B usage to activity_log
          await supabase.from('activity_log').insert({
            action_type: 'evidence_library_enrichment',
            related_contact_id: contactId,
            status: 'success',
            description: `Plan B enrichment used for ${contact.name} — library v${planBUsage.libraryVersion}, trust ${planBUsage.liveTrustScore}→${planBUsage.finalTrustScore}`,
          });
        } else {
          addLog(job, { stage: 'plan_b', level: 'info', message: 'Plan B not needed — live evidence sufficient' });
        }
      } catch (planBErr) {
        // Plan B failure must never break DEL — fall back to live evidence
        const planBErrMsg = planBErr instanceof Error ? planBErr.message : 'Unknown Plan B error';
        addLog(job, { stage: 'plan_b', level: 'warning', message: `Plan B failed, using live evidence: ${planBErrMsg}` });
        evidenceContext = this.evidenceContextBuilder.build(evidence);
      }

      // ── MP3 Part 3: Evidence Intelligence Integration Layer ──
      // Build EvidenceContext from the (possibly enriched) EvidencePackage.
      // This becomes the single source of truth for all AI reasoning.
      addLog(job, { stage: 'evidence_context', level: 'info', message: `EvidenceContext built: ${evidenceContext.allFacts.length} facts, trust score ${evidenceContext.trustScore}/100` });

      // Build AI prompt exclusively from the EvidenceContext
      const builtPrompt = this.promptBuilder.build(evidenceContext, 'persona_generation');
      addLog(job, { stage: 'prompt_builder', level: 'info', message: `Prompt built for persona generation — ${builtPrompt.citedFactIds.length} facts cited` });

      // Propagate confidence from evidence to the AI artifact
      const confidenceAssessment = this.confidencePropagator.assessContext(evidenceContext);
      addLog(job, { stage: 'confidence', level: 'info', message: `Confidence assessed: ${confidenceAssessment.confidence}/100 (${confidenceAssessment.level})${confidenceAssessment.capped ? ' [capped]' : ''}` });

      // Synthesize persona from the EvidenceContext (not raw findings)
      await supabase.from('contacts').update({ persona_status: 'synthesizing' }).eq('id', contactId);
      const persona = this.synthesizer.synthesizeFromContext(evidenceContext, confidenceAssessment);
      recordAgentExecution(job, 'SynthesizerAgent', 'persona_generation', new Date().toISOString(), true);
      addLog(job, { stage: 'synthesis', level: 'info', message: `Persona synthesized from evidence context: ${persona.confidenceLevel} confidence (${persona.confidencePct}%)` });

      // Build citation map from the evidence context (MP3 Part 6)
      const citationMap = this.citationMapper.mapFromContext(evidenceContext, confidenceAssessment);
      job.citationMap = citationMap;
      addLog(job, { stage: 'citation', level: 'info', message: `Citation map built: ${citationMap.citations.length} citations, ${citationMap.allReferencedFactIds.length} facts referenced` });

      // Generate explainability report from citations (MP3 Part 7)
      const explainabilityReport = this.explainabilityLayer.explainFromCitations(evidenceContext, confidenceAssessment, citationMap);
      job.explainabilityReport = explainabilityReport;
      addLog(job, { stage: 'explainability', level: 'info', message: `Explainability report generated: ${explainabilityReport.claimTraceability.length} claims traced, ${explainabilityReport.sourcesUsed.length} sources` });

      // Store persona in memory
      await this.memoryAgent.storePersona(contactId, persona);

      // Write persona facts to DB (overwrite existing)
      await supabase.from('persona_facts').delete().eq('contact_id', contactId);

      for (const fact of persona.facts) {
        const { data: insertedFact } = await supabase
          .from('persona_facts')
          .insert({
            contact_id: contactId,
            field_type: fact.fieldType,
            value: fact.value,
            confidence_level: fact.confidenceLevel,
            reasoning_note: fact.reasoningNote,
            timeframe: fact.timeframe,
          })
          .select()
          .maybeSingle();

        if (insertedFact && fact.sources.length > 0) {
          for (const src of fact.sources) {
            await supabase.from('sources').insert({
              persona_fact_id: insertedFact.id,
              url: src.url,
              title: src.title,
              source_tier: src.sourceTier,
              source_name: src.sourceName,
              snippet: src.snippet,
            });
          }
        }
      }

      // Update contact with confidence
      const newStatus = persona.confidenceLevel === 'low' ? 'low_confidence' : 'completed';
      await supabase
        .from('contacts')
        .update({
          persona_status: newStatus,
          persona_confidence_level: persona.confidenceLevel,
          persona_confidence_pct: persona.confidencePct,
          last_researched_date: new Date().toISOString(),
          decision_making_role: persona.decisionRole,
          updated_at: new Date().toISOString(),
        })
        .eq('id', contactId);

      // Log activity
      await supabase.from('activity_log').insert({
        action_type: 'generate_intelligence',
        related_contact_id: contactId,
        status: 'success',
        description: `Generated Executive Intelligence for ${contact.name} (${contact.company}) — ${persona.confidenceLevel} confidence (${persona.confidencePct}%)`,
      });

      // ── MP8: Intelligence Pipeline (MP4→MP5→MP6→MP7) ──
      // Runs the frozen intelligence modules on the same EvidenceContext produced by MP3.
      // Persists all four reports to the intelligence_reports table.
      const { data: pipelineEvents } = await supabase
        .from('events')
        .select('*')
        .in('status', ['upcoming', 'active']);
      if (pipelineEvents && pipelineEvents.length > 0) {
        try {
          const pipelineResult = await runIntelligencePipeline(contactId, evidenceContext, pipelineEvents as EventItem[]);
          addLog(job, { stage: 'intelligence_pipeline', level: 'info', message: `MP4-MP7 pipeline completed for ${pipelineEvents.length} event(s)` });
          if (pipelineResult.failures.length > 0) {
            for (const f of pipelineResult.failures) {
              addLog(job, { stage: 'intelligence_pipeline', level: 'warning', message: `Event "${f.eventName}" failed during ${f.stage}: ${f.error}` });
            }
            addLog(job, { stage: 'intelligence_pipeline', level: 'warning', message: `${pipelineResult.failures.length} of ${pipelineEvents.length} event(s) failed; ${pipelineResult.eventReports.length} succeeded.` });
          }
        } catch (pipelineErr) {
          const pipelineErrMsg = pipelineErr instanceof Error ? pipelineErr.message : 'Unknown pipeline error';
          addLog(job, { stage: 'intelligence_pipeline', level: 'error', message: `Pipeline error: ${pipelineErrMsg}` });
        }
      }

      // Proactive scoring: score against all upcoming events (legacy, parallelized)
      const { data: events } = await supabase
        .from('events')
        .select('*')
        .in('status', ['upcoming', 'active']);
      if (events) {
        const { data: freshFacts } = await supabase
          .from('persona_facts')
          .select('*')
          .eq('contact_id', contactId);

        const scoredContact = { ...contact, persona_confidence_level: persona.confidenceLevel, persona_confidence_pct: persona.confidencePct };
        const scoreSettled = await Promise.allSettled(
          events.map((evt) =>
            this.scorer.score(scoredContact, evt, freshFacts || []).then((scoreResult) =>
              this.upsertScore(contactId, evt.id, scoreResult).then(() =>
                this.memoryAgent.storeRecommendation(contactId, evt.id, scoreResult).then(() =>
                  ({ eventId: evt.id, result: scoreResult }),
                ),
              ),
            ),
          ),
        );

        let scoreFailures = 0;
        for (let i = 0; i < scoreSettled.length; i++) {
          const res = scoreSettled[i];
          if (res.status === 'fulfilled') {
            job.scores.push({ eventId: res.value.eventId, result: res.value.result });
          } else {
            scoreFailures++;
            const evt = events[i];
            const errMsg = res.reason instanceof Error ? res.reason.message : String(res.reason);
            addLog(job, { stage: 'scoring', level: 'warning', message: `Scoring failed for event ${evt.event_name} (${evt.id}): ${errMsg}` });
          }
        }
        recordAgentExecution(job, 'ScorerAgent', 'scoring', new Date().toISOString(), true);
        if (scoreFailures > 0) {
          addLog(job, { stage: 'scoring', level: 'warning', message: `${scoreFailures} of ${events.length} event(s) failed scoring; ${events.length - scoreFailures} succeeded.` });
        }
      }

      // Complete the ResearchJob
      job.persona = persona;
      completeJob(job, persona.confidencePct);
      await this.memoryAgent.storeJob(job);

      // Update analysis run
      if (run) {
        await supabase
          .from('analysis_runs')
          .update({
            status: 'completed',
            processing_time_ms: Date.now() - startTime,
            completed_at: new Date().toISOString(),
          })
          .eq('id', run.id);
      }

      // Store Plan B usage info in analysis run metadata (if Plan B ran)
      if (planBUsage && planBUsage.used && run) {
        try {
          await supabase
            .from('analysis_runs')
            .update({
              metadata: {
                plan_b_used: planBUsage.used,
                curated_library_version: planBUsage.libraryVersion,
                live_trust_score: planBUsage.liveTrustScore,
                final_trust_score: planBUsage.finalTrustScore,
                curated_source_count: planBUsage.curatedSourceCount,
                curated_fact_count: planBUsage.curatedFactCount,
              },
            })
            .eq('id', run.id);
        } catch {
          // metadata update is best-effort
        }
      }

      this.logger.completeStage(stageId, true, { confidence: persona.confidencePct });
      return persona;
    } catch (err) {
      await supabase.from('contacts').update({ persona_status: 'needs_review' }).eq('id', contactId);
      const errMsg = err instanceof Error ? err.message : 'Unknown error';
      failJob(job, errMsg);
      await this.memoryAgent.storeJob(job);
      this.logger.completeStage(stageId, false, { error: errMsg });

      if (run) {
        await supabase
          .from('analysis_runs')
          .update({
            status: 'failed',
            error_message: errMsg,
            completed_at: new Date().toISOString(),
          })
          .eq('id', run.id);
      }
      throw err;
    }
  }

  /**
   * Score a single contact-event pair and persist.
   */
  async generateRecommendation(contactId: string, eventId: string): Promise<ScoreResult> {
    // Check memory cache first
    const cached = await this.memoryAgent.getRecommendation(contactId, eventId);
    if (cached) {
      this.logger.info('scoring', `Cache hit for recommendation ${contactId}/${eventId}`);
      return cached;
    }

    const { data: contact } = await supabase
      .from('contacts')
      .select('*')
      .eq('id', contactId)
      .maybeSingle();
    const { data: event } = await supabase
      .from('events')
      .select('*')
      .eq('id', eventId)
      .maybeSingle();
    const { data: facts } = await supabase
      .from('persona_facts')
      .select('*')
      .eq('contact_id', contactId);

    if (!contact || !event) throw new Error('Contact or event not found');

    const score = await this.scorer.score(contact, event, facts || []);
    await this.upsertScore(contactId, eventId, score);

    // Store in memory
    await this.memoryAgent.storeRecommendation(contactId, eventId, score);

    await supabase.from('activity_log').insert({
      action_type: 'score',
      related_contact_id: contactId,
      related_event_id: eventId,
      status: 'success',
      description: `Scored ${contact.name} vs ${event.event_name}: ${score.totalScore}%${score.confidenceCapped ? ' (capped — low confidence)' : ''}`,
    });

    return score;
  }

  /**
   * Generate an invitation draft for a contact-event pair and persist.
   * Must reference at least one verified fact.
   */
  async generateInvitation(contactId: string, eventId: string): Promise<InvitationDraft> {
    // Check memory cache first
    const cached = await this.memoryAgent.getInvitation(contactId, eventId);
    if (cached) {
      this.logger.info('invitation', `Cache hit for invitation ${contactId}/${eventId}`);
      return cached;
    }

    const { data: contact } = await supabase
      .from('contacts')
      .select('*')
      .eq('id', contactId)
      .maybeSingle();
    const { data: event } = await supabase
      .from('events')
      .select('*')
      .eq('id', eventId)
      .maybeSingle();
    const { data: facts } = await supabase
      .from('persona_facts')
      .select('*')
      .eq('contact_id', contactId);
    const { data: scoreRow } = await supabase
      .from('event_scores')
      .select('*')
      .eq('contact_id', contactId)
      .eq('event_id', eventId)
      .maybeSingle();

    if (!contact || !event) throw new Error('Contact or event not found');

    const scoreResult: ScoreResult = scoreRow
      ? {
          roleScore: scoreRow.role_score,
          industryScore: scoreRow.industry_score,
          painpointScore: scoreRow.painpoint_score,
          techreadinessScore: scoreRow.techreadiness_score,
          totalScore: scoreRow.total_score,
          confidenceCapped: scoreRow.confidence_capped,
          reasoning: scoreRow.reasoning || '',
        }
      : { roleScore: 0, industryScore: 0, painpointScore: 0, techreadinessScore: 0, totalScore: 0, confidenceCapped: false, reasoning: '' };

    const draft = await this.copywriter.draft(contact, event, scoreResult, facts || []);

    await supabase.from('invite_drafts').insert({
      contact_id: contactId,
      event_id: eventId,
      subject: draft.subject,
      draft_text: draft.body,
      cited_fact_ids: draft.citedFactIds,
      delivery_channel: 'email',
      status: 'draft',
    });

    // Store in memory
    await this.memoryAgent.storeInvitation(contactId, eventId, draft);

    await supabase.from('activity_log').insert({
      action_type: 'generate_invite',
      related_contact_id: contactId,
      related_event_id: eventId,
      status: 'success',
      description: `Generated invitation draft for ${contact.name} — ${event.event_name}`,
    });

    return draft;
  }

  // ═════════════════════════════════════════════════
  // PRIVATE HELPERS
  // ═════════════════════════════════════════════════

  private async upsertScore(contactId: string, eventId: string, score: ScoreResult): Promise<void> {
    const { data: existing } = await supabase
      .from('event_scores')
      .select('id')
      .eq('contact_id', contactId)
      .eq('event_id', eventId)
      .maybeSingle();

    if (existing) {
      await supabase
        .from('event_scores')
        .update({
          role_score: score.roleScore,
          industry_score: score.industryScore,
          painpoint_score: score.painpointScore,
          techreadiness_score: score.techreadinessScore,
          total_score: score.totalScore,
          confidence_capped: score.confidenceCapped,
          reasoning: score.reasoning,
          scored_at: new Date().toISOString(),
        })
        .eq('id', existing.id);
    } else {
      await supabase.from('event_scores').insert({
        contact_id: contactId,
        event_id: eventId,
        role_score: score.roleScore,
        industry_score: score.industryScore,
        painpoint_score: score.painpointScore,
        techreadiness_score: score.techreadinessScore,
        total_score: score.totalScore,
        confidence_capped: score.confidenceCapped,
        reasoning: score.reasoning,
      });
    }
  }
}

// ═════════════════════════════════════════════════
// Singleton instance — the rest of the app imports from here.
// This preserves the old aiProvider.ts call pattern:
//   import { generateExecutiveIntelligence } from '@/services/aiProvider'
// becomes:
//   import { orchestrator } from '@/services/orchestrator'
// ═════════════════════════════════════════════════

let _orchestrator: DelOrchestrator | null = null;

export function getOrchestrator(): DelOrchestrator {
  if (!_orchestrator) {
    _orchestrator = new DelOrchestrator();
  }
  return _orchestrator;
}

export const orchestrator = getOrchestrator();

// Safety net: ensure providers are registered immediately after instantiation
orchestrator.ensureProvidersRegistered();

// Convenience exports matching the old public API (for minimal-diff migration)
export const generateExecutiveIntelligence = (contactId: string) =>
  orchestrator.generateExecutiveIntelligence(contactId);

export const generateRecommendation = (contactId: string, eventId: string) =>
  orchestrator.generateRecommendation(contactId, eventId);

export const generateInvitation = (contactId: string, eventId: string) =>
  orchestrator.generateInvitation(contactId, eventId);
