import type { ExecutiveIntelligenceReport } from '../intelligence/IntelligenceTypes';
import type { RelationshipIntelligenceReport } from '../relationship/RelationshipTypes';
import type { EventContext, OrganizationObjectives, StrategicDecisionReport, DecisionLogEntry } from './DecisionTypes';
import { EventFitEngine } from './EventFitEngine';
import { InviteRecommendationEngine } from './InviteRecommendationEngine';
import { PriorityRankingEngine } from './PriorityRankingEngine';
import { OpportunityMatchingEngine } from './OpportunityMatchingEngine';
import { DecisionRiskEngine } from './DecisionRiskEngine';
import { DecisionConfidenceEngine } from './DecisionConfidenceEngine';
import { DecisionReasoningEngine } from './DecisionReasoningEngine';
import { DecisionReportBuilder } from './DecisionReportBuilder';

/*
 * DecisionCoordinator — orchestrates the MP6 pipeline.
 *
 * Pipeline:
 *   ExecutiveIntelligenceReport + RelationshipIntelligenceReport + EventContext + OrganizationObjectives
 *     → EventFitEngine (event fit)
 *     → InviteRecommendationEngine (invite decision)
 *     → PriorityRankingEngine (tier & rank)
 *     → OpportunityMatchingEngine (opportunity matches + benefits)
 *     → DecisionRiskEngine (decision risks)
 *     → DecisionConfidenceEngine (confidence summary)
 *     → DecisionReasoningEngine (reasoning chain)
 *     → DecisionReportBuilder (final report)
 *
 * Logs each module's execution time and metrics.
 * Does NOT modify any MP1–MP5 component.
 */

export class DecisionCoordinator {
  private eventFitEngine: EventFitEngine;
  private inviteEngine: InviteRecommendationEngine;
  private priorityEngine: PriorityRankingEngine;
  private opportunityEngine: OpportunityMatchingEngine;
  private riskEngine: DecisionRiskEngine;
  private confidenceEngine: DecisionConfidenceEngine;
  private reasoningEngine: DecisionReasoningEngine;
  private reportBuilder: DecisionReportBuilder;

  private logs: DecisionLogEntry[] = [];

  constructor() {
    this.eventFitEngine = new EventFitEngine();
    this.inviteEngine = new InviteRecommendationEngine();
    this.priorityEngine = new PriorityRankingEngine();
    this.opportunityEngine = new OpportunityMatchingEngine();
    this.riskEngine = new DecisionRiskEngine();
    this.confidenceEngine = new DecisionConfidenceEngine();
    this.reasoningEngine = new DecisionReasoningEngine();
    this.reportBuilder = new DecisionReportBuilder();
  }

  generateReport(
    execReport: ExecutiveIntelligenceReport,
    relReport: RelationshipIntelligenceReport,
    event: EventContext,
    objectives: OrganizationObjectives,
  ): StrategicDecisionReport {
    const pipelineStart = Date.now();

    // ── Step 1: Event Fit Engine ──
    const s1 = Date.now();
    const eventFit = this.eventFitEngine.analyze(execReport, relReport, event, objectives);
    this.log('EventFitEngine', s1, {
      confidence: eventFit.confidence,
      recommendationCount: eventFit.dimensions.length,
      warnings: eventFit.confidence === 0 ? ['Event fit confidence is 0 — insufficient evidence'] : [],
    });

    // ── Step 2: Invite Recommendation Engine ──
    const s2 = Date.now();
    const invite = this.inviteEngine.recommend(execReport, relReport, event, objectives, eventFit);
    this.log('InviteRecommendationEngine', s2, {
      confidence: invite.confidence,
      recommendationCount: 1,
      warnings: invite.decision === 'Unknown' ? ['Invite decision is Unknown — insufficient evidence'] : [],
    });

    // ── Step 3: Priority Ranking Engine ──
    const s3 = Date.now();
    const priority = this.priorityEngine.rank(execReport, relReport, eventFit);
    this.log('PriorityRankingEngine', s3, {
      confidence: priority.confidence,
      recommendationCount: 1,
      warnings: priority.tier === 'Tier 3' ? ['Executive is Tier 3 — low priority'] : [],
    });

    // ── Step 4: Opportunity Matching Engine ──
    const s4 = Date.now();
    const { matches: opportunities, benefits } = this.opportunityEngine.match(execReport, relReport, event, objectives);
    this.log('OpportunityMatchingEngine', s4, {
      confidence: opportunities.length > 0
        ? Math.round(opportunities.reduce((s, o) => s + o.confidence, 0) / opportunities.length)
        : 0,
      recommendationCount: opportunities.length,
      warnings: opportunities.length === 0 ? ['No opportunity matches generated'] : [],
    });

    // ── Step 5: Decision Risk Engine ──
    const s5 = Date.now();
    const risks = this.riskEngine.assess(execReport, relReport, event, objectives, eventFit, invite);
    this.log('DecisionRiskEngine', s5, {
      confidence: 100,
      recommendationCount: risks.length,
      warnings: risks.filter((r) => r.severity === 'high').map((r) => r.description),
    });

    // ── Step 6: Decision Confidence Engine ──
    const s6 = Date.now();
    const confidence = this.confidenceEngine.compute(execReport, relReport, eventFit, opportunities, risks);
    this.log('DecisionConfidenceEngine', s6, {
      confidence: confidence.overallConfidence,
      recommendationCount: 1,
      warnings: confidence.level === 'low' ? ['Overall decision confidence is low'] : [],
    });

    // ── Step 7: Decision Reasoning Engine ──
    const s7 = Date.now();
    const reasoning = this.reasoningEngine.build(
      execReport, relReport, event, objectives,
      eventFit, invite, priority, opportunities, benefits, risks, confidence,
    );
    this.log('DecisionReasoningEngine', s7, {
      confidence: reasoning.confidence,
      recommendationCount: reasoning.chain.length,
      warnings: [],
    });

    // ── Step 8: Decision Report Builder ──
    const s8 = Date.now();
    const pipelineDurationMs = Date.now() - pipelineStart;
    const finalReport = this.reportBuilder.build(
      execReport, relReport, event, objectives,
      eventFit, invite, priority, opportunities, benefits, risks, confidence, reasoning,
      pipelineDurationMs,
    );
    this.log('DecisionReportBuilder', s8, {
      confidence: finalReport.confidenceSummary.overallConfidence,
      recommendationCount: finalReport.recommendations.length,
      warnings: [],
    });

    return finalReport;
  }

  getLogs(): DecisionLogEntry[] {
    return [...this.logs];
  }

  private log(
    module: string,
    start: number,
    metrics: {
      confidence: number;
      recommendationCount: number;
      warnings: string[];
    },
  ): void {
    this.logs.push({
      module,
      latencyMs: Date.now() - start,
      confidence: metrics.confidence,
      recommendationCount: metrics.recommendationCount,
      warnings: metrics.warnings,
      timestamp: new Date().toISOString(),
    });
  }
}

// ── Singleton ────────────────────────────────────────

let _coordinator: DecisionCoordinator | null = null;

export function getDecisionCoordinator(): DecisionCoordinator {
  if (!_coordinator) {
    _coordinator = new DecisionCoordinator();
  }
  return _coordinator;
}

export function generateStrategicDecisionReport(
  execReport: ExecutiveIntelligenceReport,
  relReport: RelationshipIntelligenceReport,
  event: EventContext,
  objectives: OrganizationObjectives,
): StrategicDecisionReport {
  return getDecisionCoordinator().generateReport(execReport, relReport, event, objectives);
}
