import type { ExecutiveIntelligenceReport } from '../intelligence/IntelligenceTypes';
import type { RelationshipIntelligenceReport, RelationshipLogEntry } from './RelationshipTypes';
import { RelationshipProfileEngine } from './RelationshipProfileEngine';
import { EngagementStrategyEngine } from './EngagementStrategyEngine';
import { ConversationStarterEngine } from './ConversationStarterEngine';
import { RapportEngine } from './RapportEngine';
import { InterestAlignmentEngine } from './InterestAlignmentEngine';
import { RelationshipRiskEngine } from './RelationshipRiskEngine';
import { FollowUpEngine } from './FollowUpEngine';
import { RelationshipScoringEngine } from './RelationshipScoringEngine';
import { RelationshipReportBuilder } from './RelationshipReportBuilder';

/*
 * RelationshipCoordinator — orchestrates the MP5 pipeline.
 *
 * Pipeline:
 *   ExecutiveIntelligenceReport
 *     → RelationshipProfileEngine (profile)
 *     → EngagementStrategyEngine (strategies)
 *     → ConversationStarterEngine (starters)
 *     → RapportEngine (rapport)
 *     → InterestAlignmentEngine (alignments)
 *     → RelationshipRiskEngine (risks)
 *     → FollowUpEngine (follow-ups)
 *     → RelationshipScoringEngine (scores)
 *     → RelationshipReportBuilder (final report)
 *
 * The coordinator logs each module's execution time and metrics.
 * It does NOT modify any MP1–MP4 component — it only consumes
 * ExecutiveIntelligenceReport.
 */

export class RelationshipCoordinator {
  private profileEngine: RelationshipProfileEngine;
  private strategyEngine: EngagementStrategyEngine;
  private conversationEngine: ConversationStarterEngine;
  private rapportEngine: RapportEngine;
  private alignmentEngine: InterestAlignmentEngine;
  private riskEngine: RelationshipRiskEngine;
  private followUpEngine: FollowUpEngine;
  private scoringEngine: RelationshipScoringEngine;
  private reportBuilder: RelationshipReportBuilder;

  private logs: RelationshipLogEntry[] = [];

  constructor() {
    this.profileEngine = new RelationshipProfileEngine();
    this.strategyEngine = new EngagementStrategyEngine();
    this.conversationEngine = new ConversationStarterEngine();
    this.rapportEngine = new RapportEngine();
    this.alignmentEngine = new InterestAlignmentEngine();
    this.riskEngine = new RelationshipRiskEngine();
    this.followUpEngine = new FollowUpEngine();
    this.scoringEngine = new RelationshipScoringEngine();
    this.reportBuilder = new RelationshipReportBuilder();
  }

  generateReport(report: ExecutiveIntelligenceReport): RelationshipIntelligenceReport {
    const pipelineStart = Date.now();

    // ── Step 1: Relationship Profile Engine ──
    const profileStart = Date.now();
    const profile = this.profileEngine.buildProfile(report);
    this.log('RelationshipProfileEngine', profileStart, {
      confidence: Math.round(
        (profile.stageConfidence + profile.readinessConfidence + profile.depthConfidence + profile.networkingConfidence) / 4,
      ),
      recommendationCount: 1,
      warnings: profile.stage === 'Unknown' ? ['Relationship stage is Unknown — insufficient evidence'] : [],
    });

    // ── Step 2: Engagement Strategy Engine ──
    const strategyStart = Date.now();
    const strategies = this.strategyEngine.generateStrategies(report);
    this.log('EngagementStrategyEngine', strategyStart, {
      confidence: strategies.length > 0
        ? Math.round(strategies.reduce((s, st) => s + st.confidence, 0) / strategies.length)
        : 0,
      recommendationCount: strategies.length,
      warnings: strategies.length === 0 ? ['No engagement strategies generated — insufficient evidence'] : [],
    });

    // ── Step 3: Conversation Starter Engine ──
    const conversationStart = Date.now();
    const starters = this.conversationEngine.generateStarters(report);
    this.log('ConversationStarterEngine', conversationStart, {
      confidence: starters.length > 0
        ? Math.round(starters.reduce((s, st) => s + st.confidence, 0) / starters.length)
        : 0,
      recommendationCount: starters.length,
      warnings: starters.some((s) => s.topic === 'Unknown') ? ['Some conversation starters are Unknown — evidence gaps'] : [],
    });

    // ── Step 4: Rapport Engine ──
    const rapportStart = Date.now();
    const rapport = this.rapportEngine.assess(report);
    this.log('RapportEngine', rapportStart, {
      confidence: rapport.overallRapportScore,
      recommendationCount: 1,
      warnings: rapport.communicationCompatibility === 'Unknown' ? ['Rapport assessment has Unknown components'] : [],
    });

    // ── Step 5: Interest Alignment Engine ──
    const alignmentStart = Date.now();
    const alignments = this.alignmentEngine.analyze(report);
    this.log('InterestAlignmentEngine', alignmentStart, {
      confidence: alignments.length > 0
        ? Math.round(alignments.reduce((s, a) => s + a.alignmentScore, 0) / alignments.length)
        : 0,
      recommendationCount: alignments.length,
      warnings: alignments.length === 0 ? ['No alignment objects generated — insufficient evidence'] : [],
    });

    // ── Step 6: Relationship Risk Engine ──
    const riskStart = Date.now();
    const risks = this.riskEngine.assess(report);
    this.log('RelationshipRiskEngine', riskStart, {
      confidence: 100,
      recommendationCount: risks.length,
      warnings: risks.filter((r) => r.severity === 'high').map((r) => r.description),
    });

    // ── Step 7: Follow-up Engine ──
    const followUpStart = Date.now();
    const followUps = this.followUpEngine.generate(report);
    this.log('FollowUpEngine', followUpStart, {
      confidence: followUps.length > 0
        ? Math.round(followUps.reduce((s, f) => s + f.confidence, 0) / followUps.length)
        : 0,
      recommendationCount: followUps.length,
      warnings: followUps.some((f) => f.action === 'Unknown') ? ['Some follow-up phases have Unknown recommendations — evidence gaps'] : [],
    });

    // ── Step 8: Relationship Scoring Engine ──
    const scoringStart = Date.now();
    const scores = this.scoringEngine.compute(
      report,
      {
        stageConfidence: profile.stageConfidence,
        readinessConfidence: profile.readinessConfidence,
        networkingConfidence: profile.networkingConfidence,
        depthConfidence: profile.depthConfidence,
      },
      strategies,
      starters,
      rapport,
      alignments,
      followUps,
    );
    this.log('RelationshipScoringEngine', scoringStart, {
      confidence: scores.overallScore,
      recommendationCount: 1,
      warnings: scores.overallScore < 40 ? ['Overall relationship score is below 40 — additional research recommended'] : [],
    });

    // ── Step 9: Relationship Report Builder ──
    const reportStart = Date.now();
    const pipelineDurationMs = Date.now() - pipelineStart;
    const finalReport = this.reportBuilder.build(
      report,
      profile,
      strategies,
      starters,
      rapport,
      alignments,
      risks,
      followUps,
      scores,
      pipelineDurationMs,
    );
    this.log('RelationshipReportBuilder', reportStart, {
      confidence: finalReport.confidenceSummary.overallConfidence,
      recommendationCount: finalReport.recommendations.length,
      warnings: [],
    });

    return finalReport;
  }

  getLogs(): RelationshipLogEntry[] {
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

let _coordinator: RelationshipCoordinator | null = null;

export function getRelationshipCoordinator(): RelationshipCoordinator {
  if (!_coordinator) {
    _coordinator = new RelationshipCoordinator();
  }
  return _coordinator;
}

export function generateRelationshipIntelligenceReport(
  report: ExecutiveIntelligenceReport,
): RelationshipIntelligenceReport {
  return getRelationshipCoordinator().generateReport(report);
}
