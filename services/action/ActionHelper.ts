import type { ExecutiveIntelligenceReport } from '../intelligence/IntelligenceTypes';
import type { RelationshipIntelligenceReport } from '../relationship/RelationshipTypes';
import type { StrategicDecisionReport } from '../decision/DecisionTypes';
import type { ActionCitation } from './ActionTypes';

/*
 * ActionHelper — shared utilities for MP7 engines.
 *
 * Consumes only MP4, MP5, and MP6 public interfaces.
 * No business logic — pure data extraction and utility functions.
 */

type ConfidenceObject = { confidence: number };
type CitationHolder = { factIds: string[]; sourceIds: string[] };

export class ActionHelper {
  // ── Confidence helpers ──────────────────────────

  static clampConfidence(value: number): number {
    return Math.max(0, Math.min(100, Math.round(value)));
  }

  static mergeConfidence(items: ConfidenceObject[]): number {
    if (items.length === 0) return 0;
    return Math.round(items.reduce((s, i) => s + i.confidence, 0) / items.length);
  }

  static maxConfidence(items: ConfidenceObject[]): number {
    if (items.length === 0) return 0;
    return Math.max(...items.map((i) => i.confidence));
  }

  static weightedConfidence(items: { confidence: number; weight: number }[]): number {
    const totalWeight = items.reduce((s, i) => s + i.weight, 0);
    if (totalWeight === 0) return 0;
    const weighted = items.reduce((s, i) => s + i.confidence * i.weight, 0);
    return ActionHelper.clampConfidence(weighted / totalWeight);
  }

  // ── Fact / Source collection ────────────────────

  static collectFactIds(report: ExecutiveIntelligenceReport): string[] {
    const ids = new Set<string>();
    const persona = report.persona;
    const all: { factIds: string[] }[] = [
      persona.leadershipStyle,
      persona.communicationStyle,
      persona.decisionStyle,
      persona.riskAppetite,
      persona.innovationOrientation,
      persona.technologyInterest,
      persona.industryFocus,
      persona.influenceLevel,
      persona.networkingStyle,
      persona.negotiationStyle,
      ...persona.strategicPriorities,
      ...persona.businessInterests,
      ...report.opportunities,
      ...report.recommendations,
    ];
    for (const item of all) {
      for (const fid of item.factIds) ids.add(fid);
    }
    return Array.from(ids);
  }

  static collectSourceIds(report: ExecutiveIntelligenceReport): string[] {
    const ids = new Set<string>();
    const persona = report.persona;
    const all: { sourceIds: string[] }[] = [
      persona.leadershipStyle,
      persona.communicationStyle,
      persona.decisionStyle,
      persona.riskAppetite,
      persona.innovationOrientation,
      persona.technologyInterest,
      persona.industryFocus,
      persona.influenceLevel,
      persona.networkingStyle,
      persona.negotiationStyle,
      ...persona.strategicPriorities,
      ...persona.businessInterests,
      ...report.opportunities,
    ];
    for (const item of all) {
      for (const sid of item.sourceIds) ids.add(sid);
    }
    return Array.from(ids);
  }

  static collectRelationshipFactIds(report: RelationshipIntelligenceReport): string[] {
    const ids = new Set<string>();
    const all: { citations: { factIds: string[] } }[] = [
      ...report.engagementStrategies,
      ...report.conversationStarters,
      ...report.followUpPlan,
      ...report.alignmentAnalysis,
      ...report.risks,
    ];
    for (const item of all) {
      for (const fid of item.citations.factIds) ids.add(fid);
    }
    return Array.from(ids);
  }

  static collectRelationshipSourceIds(report: RelationshipIntelligenceReport): string[] {
    const ids = new Set<string>();
    const all: { citations: { sourceIds: string[] } }[] = [
      ...report.engagementStrategies,
      ...report.conversationStarters,
      ...report.followUpPlan,
      ...report.alignmentAnalysis,
      ...report.risks,
    ];
    for (const item of all) {
      for (const sid of item.citations.sourceIds) ids.add(sid);
    }
    return Array.from(ids);
  }

  static collectDecisionFactIds(report: StrategicDecisionReport): string[] {
    const ids = new Set<string>();
    const direct: { factIds: string[] }[] = [
      report.inviteRecommendation,
      report.priorityRanking,
      ...report.eventFit.dimensions,
      ...report.opportunityAnalysis,
      ...report.strategicBenefits,
      ...report.decisionRisks,
      ...report.recommendations,
    ];
    for (const item of direct) {
      for (const fid of item.factIds) ids.add(fid);
    }
    for (const fid of report.eventFit.citations.factIds) ids.add(fid);
    return Array.from(ids);
  }

  static collectDecisionSourceIds(report: StrategicDecisionReport): string[] {
    const ids = new Set<string>();
    const direct: { sourceIds: string[] }[] = [
      report.inviteRecommendation,
      report.priorityRanking,
      ...report.eventFit.dimensions,
      ...report.opportunityAnalysis,
      ...report.strategicBenefits,
      ...report.decisionRisks,
      ...report.recommendations,
    ];
    for (const item of direct) {
      for (const sid of item.sourceIds) ids.add(sid);
    }
    for (const sid of report.eventFit.citations.sourceIds) ids.add(sid);
    return Array.from(ids);
  }

  // ── Citation helpers ────────────────────────────

  static emptyCitation(): ActionCitation {
    return { factIds: [], sourceIds: [] };
  }

  static citation(factIds: string[], sourceIds: string[]): ActionCitation {
    return { factIds: [...factIds], sourceIds: [...sourceIds] };
  }

  static mergeCitations(items: CitationHolder[]): ActionCitation {
    const factIds = new Set<string>();
    const sourceIds = new Set<string>();
    for (const item of items) {
      for (const fid of item.factIds) factIds.add(fid);
      for (const sid of item.sourceIds) sourceIds.add(sid);
    }
    return { factIds: Array.from(factIds), sourceIds: Array.from(sourceIds) };
  }

  static aggregateCitations(
    execReport: ExecutiveIntelligenceReport,
    relReport: RelationshipIntelligenceReport,
    decisionReport: StrategicDecisionReport,
  ): ActionCitation {
    const factIds = new Set<string>();
    const sourceIds = new Set<string>();

    for (const fid of ActionHelper.collectFactIds(execReport)) factIds.add(fid);
    for (const sid of ActionHelper.collectSourceIds(execReport)) sourceIds.add(sid);
    for (const fid of ActionHelper.collectRelationshipFactIds(relReport)) factIds.add(fid);
    for (const sid of ActionHelper.collectRelationshipSourceIds(relReport)) sourceIds.add(sid);
    for (const fid of ActionHelper.collectDecisionFactIds(decisionReport)) factIds.add(fid);
    for (const sid of ActionHelper.collectDecisionSourceIds(decisionReport)) sourceIds.add(sid);

    // Also include the pre-aggregated citation arrays from each report
    for (const fid of execReport.citations.factIds) factIds.add(fid);
    for (const sid of execReport.citations.sourceIds) sourceIds.add(sid);
    for (const fid of relReport.citations.factIds) factIds.add(fid);
    for (const sid of relReport.citations.sourceIds) sourceIds.add(sid);
    for (const fid of decisionReport.citations.factIds) factIds.add(fid);
    for (const sid of decisionReport.citations.sourceIds) sourceIds.add(sid);

    return { factIds: Array.from(factIds), sourceIds: Array.from(sourceIds) };
  }

  // ── Token matching ──────────────────────────────

  static tokenMatch(a: string, b: string): boolean {
    const tokensA = a.toLowerCase().split(/[\s,;&/|-]+/).filter((t) => t.length > 2);
    const tokensB = b.toLowerCase().split(/[\s,;&/|-]+/).filter((t) => t.length > 2);
    const setB = new Set(tokensB);
    return tokensA.some((t) => setB.has(t));
  }

  static tokenOverlap(a: string, b: string): number {
    const tokensA = a.toLowerCase().split(/[\s,;&/|-]+/).filter((t) => t.length > 2);
    const tokensB = b.toLowerCase().split(/[\s,;&/|-]+/).filter((t) => t.length > 2);
    const setB = new Set(tokensB);
    return tokensA.filter((t) => setB.has(t)).length;
  }

  // ── Upstream confidence accessors ───────────────

  static executiveConfidence(report: ExecutiveIntelligenceReport): number {
    return report.confidenceSummary.overall;
  }

  static relationshipConfidence(report: RelationshipIntelligenceReport): number {
    return report.confidenceSummary.overallConfidence;
  }

  static decisionConfidence(report: StrategicDecisionReport): number {
    return report.confidenceSummary.overallConfidence;
  }

  static evidenceConfidence(report: ExecutiveIntelligenceReport): number {
    return report.evidenceSummary.trustScore;
  }

  static relationshipScore(report: RelationshipIntelligenceReport): number {
    return report.scores.overallScore;
  }

  // ── Upstream value accessors ────────────────────

  static inviteDecision(report: StrategicDecisionReport): string {
    return report.inviteRecommendation.decision;
  }

  static priorityTier(report: StrategicDecisionReport): string {
    return report.priorityRanking.tier;
  }

  static archetype(report: ExecutiveIntelligenceReport): string {
    return report.archetypeClassification.archetype;
  }

  static influenceLevel(report: ExecutiveIntelligenceReport): string {
    return report.persona.influenceLevel.value;
  }

  static industryFocus(report: ExecutiveIntelligenceReport): string {
    return report.persona.industryFocus.value;
  }

  static technologyInterest(report: ExecutiveIntelligenceReport): string {
    return report.persona.technologyInterest.value;
  }

  static communicationStyle(report: ExecutiveIntelligenceReport): string {
    return report.persona.communicationStyle.value;
  }

  static networkingStyle(report: ExecutiveIntelligenceReport): string {
    return report.persona.networkingStyle.value;
  }

  static leadershipStyle(report: ExecutiveIntelligenceReport): string {
    return report.persona.leadershipStyle.value;
  }

  static relationshipStage(report: RelationshipIntelligenceReport): string {
    return report.relationshipProfile.stage;
  }

  static engagementReadiness(report: RelationshipIntelligenceReport): string {
    return report.relationshipProfile.engagementReadiness;
  }

  static strategicPriorityValues(report: ExecutiveIntelligenceReport): string[] {
    return report.persona.strategicPriorities.map((p) => p.value);
  }

  static businessInterestValues(report: ExecutiveIntelligenceReport): string[] {
    return report.persona.businessInterests.map((b) => b.value);
  }

  static opportunityThemes(report: ExecutiveIntelligenceReport): string[] {
    const themes = new Set<string>();
    for (const opp of report.opportunities) {
      for (const t of opp.suggestedEventThemes) themes.add(t);
    }
    return Array.from(themes);
  }

  static topOpportunityRoles(report: StrategicDecisionReport): string[] {
    return report.opportunityAnalysis
      .filter((o) => o.matchScore >= 50)
      .sort((a, b) => b.matchScore - a.matchScore)
      .map((o) => o.role);
  }

  // ── Unknown detection ───────────────────────────

  static isUnknown(value: string): boolean {
    return value === 'Unknown' || value === 'unknown';
  }

  static isInsufficientEvidence(
    execReport: ExecutiveIntelligenceReport,
    relReport: RelationshipIntelligenceReport,
    decisionReport: StrategicDecisionReport,
  ): boolean {
    return (
      execReport.confidenceSummary.overall === 0 ||
      relReport.confidenceSummary.overallConfidence === 0 ||
      decisionReport.inviteRecommendation.decision === 'Unknown'
    );
  }

  static insufficientReasoning(): string {
    return 'Insufficient verified evidence.';
  }

  // ── Grounding helpers ───────────────────────────

  static countGrounded(items: { factIds: string[] }[]): number {
    return items.filter((i) => i.factIds.length > 0).length;
  }

  static groundingRate(total: number, grounded: number): number {
    if (total === 0) return 0;
    return Math.round((grounded / total) * 100);
  }

  // ── Source aggregation ──────────────────────────

  static aggregateSources(
    execReport: ExecutiveIntelligenceReport,
    relReport: RelationshipIntelligenceReport,
    decisionReport: StrategicDecisionReport,
  ): { sourceId: string; sourceName: string; url: string; authorityScore: number; tier: number }[] {
    const seen = new Set<string>();
    const sources: { sourceId: string; sourceName: string; url: string; authorityScore: number; tier: number }[] = [];

    for (const src of execReport.citations.sources) {
      if (!seen.has(src.sourceId)) {
        seen.add(src.sourceId);
        sources.push(src);
      }
    }
    for (const src of relReport.citations.sources) {
      if (!seen.has(src.sourceId)) {
        seen.add(src.sourceId);
        sources.push(src);
      }
    }
    for (const src of decisionReport.citations.sources) {
      if (!seen.has(src.sourceId)) {
        seen.add(src.sourceId);
        sources.push(src);
      }
    }

    return sources;
  }

  // ── ID generation (deterministic) ───────────────

  static actionId(timeframe: string, index: number): string {
    return `action-${timeframe}-${String(index + 1).padStart(2, '0')}`;
  }
}
