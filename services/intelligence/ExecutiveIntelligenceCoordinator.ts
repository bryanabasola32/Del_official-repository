import type { EvidenceContext } from '../research/EvidenceContextBuilder';
import type { ExecutiveIntelligenceReport, IntelligenceLogEntry } from './IntelligenceTypes';
import { ExecutivePersonaEngine } from './ExecutivePersonaEngine';
import { PersonaReasoningEngine } from './PersonaReasoningEngine';
import { ExecutiveArchetypeClassifier } from './ExecutiveArchetypeClassifier';
import { ExecutiveOpportunityEngine } from './ExecutiveOpportunityEngine';
import { ExecutiveRiskEngine } from './ExecutiveRiskEngine';
import { PersonaConfidenceEngine } from './PersonaConfidenceEngine';
import { ExecutiveTimelineBuilder } from './ExecutiveTimelineBuilder';
import { ExecutiveReportBuilder } from './ExecutiveReportBuilder';

/*
 * ExecutiveIntelligenceCoordinator — orchestrates the MP4 pipeline.
 *
 * Pipeline:
 *   EvidenceContext
 *     → ExecutivePersonaEngine (persona)
 *     → PersonaReasoningEngine (reasoning chains)
 *     → ExecutiveArchetypeClassifier (archetype)
 *     → ExecutiveOpportunityEngine (opportunities)
 *     → ExecutiveRiskEngine (risks)
 *     → PersonaConfidenceEngine (confidence)
 *     → ExecutiveTimelineBuilder (timeline)
 *     → ExecutiveReportBuilder (final report)
 *
 * The coordinator logs each module's execution time and metrics.
 * It does NOT modify any MP3 component — it only consumes EvidenceContext.
 */

export class ExecutiveIntelligenceCoordinator {
  private personaEngine: ExecutivePersonaEngine;
  private reasoningEngine: PersonaReasoningEngine;
  private archetypeClassifier: ExecutiveArchetypeClassifier;
  private opportunityEngine: ExecutiveOpportunityEngine;
  private riskEngine: ExecutiveRiskEngine;
  private confidenceEngine: PersonaConfidenceEngine;
  private timelineBuilder: ExecutiveTimelineBuilder;
  private reportBuilder: ExecutiveReportBuilder;

  private logs: IntelligenceLogEntry[] = [];

  constructor() {
    this.personaEngine = new ExecutivePersonaEngine();
    this.reasoningEngine = new PersonaReasoningEngine();
    this.archetypeClassifier = new ExecutiveArchetypeClassifier();
    this.opportunityEngine = new ExecutiveOpportunityEngine();
    this.riskEngine = new ExecutiveRiskEngine();
    this.confidenceEngine = new PersonaConfidenceEngine();
    this.timelineBuilder = new ExecutiveTimelineBuilder();
    this.reportBuilder = new ExecutiveReportBuilder();
  }

  generateReport(context: EvidenceContext): ExecutiveIntelligenceReport {
    const pipelineStart = Date.now();

    // ── Step 1: Executive Persona Engine ──
    const personaStart = Date.now();
    const persona = this.personaEngine.buildPersona(context);
    this.log('ExecutivePersonaEngine', personaStart, {
      confidence: this.averagePersonaConfidence(persona),
      reasoningCount: 0,
      inferenceCount: 12 + persona.strategicPriorities.length + persona.businessInterests.length,
      riskCount: 0,
      opportunityCount: 0,
    });

    // ── Step 2: Persona Reasoning Engine ──
    const reasoningStart = Date.now();
    const reasoning = this.reasoningEngine.buildReasoningChains(context, persona);
    this.log('PersonaReasoningEngine', reasoningStart, {
      confidence: 0,
      reasoningCount: reasoning.length,
      inferenceCount: 0,
      riskCount: 0,
      opportunityCount: 0,
    });

    // ── Step 3: Executive Archetype Classifier ──
    const archetypeStart = Date.now();
    const archetype = this.archetypeClassifier.classify(context);
    this.log('ExecutiveArchetypeClassifier', archetypeStart, {
      confidence: archetype.confidence,
      reasoningCount: 1,
      inferenceCount: 1,
      riskCount: 0,
      opportunityCount: 0,
    });

    // ── Step 4: Executive Opportunity Engine ──
    const opportunityStart = Date.now();
    const opportunities = this.opportunityEngine.identify(context);
    this.log('ExecutiveOpportunityEngine', opportunityStart, {
      confidence: opportunities.length > 0
        ? Math.round(opportunities.reduce((s, o) => s + o.confidence, 0) / opportunities.length)
        : 0,
      reasoningCount: 0,
      inferenceCount: opportunities.length,
      riskCount: 0,
      opportunityCount: opportunities.length,
    });

    // ── Step 5: Executive Risk Engine ──
    const riskStart = Date.now();
    const risks = this.riskEngine.assess(context);
    this.log('ExecutiveRiskEngine', riskStart, {
      confidence: 0,
      reasoningCount: 0,
      inferenceCount: 0,
      riskCount: risks.length,
      opportunityCount: 0,
    });

    // ── Step 6: Persona Confidence Engine ──
    const confidenceStart = Date.now();
    const confidence = this.confidenceEngine.compute(context, persona);
    this.log('PersonaConfidenceEngine', confidenceStart, {
      confidence: confidence.overall,
      reasoningCount: 0,
      inferenceCount: 0,
      riskCount: 0,
      opportunityCount: 0,
    });

    // ── Step 7: Executive Timeline Builder ──
    const timelineStart = Date.now();
    const timeline = this.timelineBuilder.build(context);
    this.log('ExecutiveTimelineBuilder', timelineStart, {
      confidence: 0,
      reasoningCount: 0,
      inferenceCount: timeline.length,
      riskCount: 0,
      opportunityCount: 0,
    });

    // ── Step 8: Executive Report Builder ──
    const reportStart = Date.now();
    const pipelineDurationMs = Date.now() - pipelineStart;
    const report = this.reportBuilder.build(
      context,
      persona,
      reasoning,
      archetype,
      opportunities,
      risks,
      confidence,
      timeline,
      pipelineDurationMs,
    );
    this.log('ExecutiveReportBuilder', reportStart, {
      confidence: confidence.overall,
      reasoningCount: reasoning.length,
      inferenceCount: report.metadata.inferenceCount,
      riskCount: risks.length,
      opportunityCount: opportunities.length,
    });

    return report;
  }

  getLogs(): IntelligenceLogEntry[] {
    return [...this.logs];
  }

  private log(
    module: string,
    start: number,
    metrics: {
      confidence: number;
      reasoningCount: number;
      inferenceCount: number;
      riskCount: number;
      opportunityCount: number;
    },
  ): void {
    this.logs.push({
      module,
      latencyMs: Date.now() - start,
      confidence: metrics.confidence,
      reasoningCount: metrics.reasoningCount,
      inferenceCount: metrics.inferenceCount,
      riskCount: metrics.riskCount,
      opportunityCount: metrics.opportunityCount,
      timestamp: new Date().toISOString(),
    });
  }

  private averagePersonaConfidence(persona: { leadershipStyle: { confidence: number }; communicationStyle: { confidence: number }; decisionStyle: { confidence: number }; riskAppetite: { confidence: number }; innovationOrientation: { confidence: number }; technologyInterest: { confidence: number }; industryFocus: { confidence: number }; influenceLevel: { confidence: number }; networkingStyle: { confidence: number }; negotiationStyle: { confidence: number } }): number {
    const confidences = [
      persona.leadershipStyle.confidence,
      persona.communicationStyle.confidence,
      persona.decisionStyle.confidence,
      persona.riskAppetite.confidence,
      persona.innovationOrientation.confidence,
      persona.technologyInterest.confidence,
      persona.industryFocus.confidence,
      persona.influenceLevel.confidence,
      persona.networkingStyle.confidence,
      persona.negotiationStyle.confidence,
    ];
    return Math.round(confidences.reduce((s, c) => s + c, 0) / confidences.length);
  }
}

// ── Singleton ────────────────────────────────────────

let _coordinator: ExecutiveIntelligenceCoordinator | null = null;

export function getExecutiveIntelligenceCoordinator(): ExecutiveIntelligenceCoordinator {
  if (!_coordinator) {
    _coordinator = new ExecutiveIntelligenceCoordinator();
  }
  return _coordinator;
}

export function generateExecutiveIntelligenceReport(
  context: EvidenceContext,
): ExecutiveIntelligenceReport {
  return getExecutiveIntelligenceCoordinator().generateReport(context);
}
