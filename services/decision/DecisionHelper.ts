import type { ExecutiveIntelligenceReport } from '../intelligence/IntelligenceTypes';
import type { RelationshipIntelligenceReport } from '../relationship/RelationshipTypes';
import type { DecisionCitation } from './DecisionTypes';

/*
 * DecisionHelper — shared utilities for querying upstream reports.
 *
 * Consumes only ExecutiveIntelligenceReport (MP4) and
 * RelationshipIntelligenceReport (MP5).
 * No business logic — pure data extraction.
 */

type ConfidenceObject = { confidence: number };

export class DecisionHelper {
  // ── Confidence helpers ──────────────────────────

  static findHighestConfidence<T extends ConfidenceObject>(items: T[]): T | null {
    if (items.length === 0) return null;
    return items.reduce((best, cur) => (cur.confidence > best.confidence ? cur : best), items[0]);
  }

  static aggregateConfidence(items: ConfidenceObject[]): number {
    if (items.length === 0) return 0;
    return Math.round(items.reduce((s, i) => s + i.confidence, 0) / items.length);
  }

  static maxConfidence(items: ConfidenceObject[]): number {
    if (items.length === 0) return 0;
    return Math.max(...items.map((i) => i.confidence));
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

  // ── Executive report value accessors ────────────

  static executiveConfidence(report: ExecutiveIntelligenceReport): number {
    return report.confidenceSummary.overall;
  }

  static evidenceConfidence(report: ExecutiveIntelligenceReport): number {
    return report.evidenceSummary.trustScore;
  }

  static completeness(report: ExecutiveIntelligenceReport): number {
    return report.evidenceSummary.completeness;
  }

  static strategicPriorityValues(report: ExecutiveIntelligenceReport): string[] {
    return report.persona.strategicPriorities.map((p) => p.value);
  }

  static businessInterestValues(report: ExecutiveIntelligenceReport): string[] {
    return report.persona.businessInterests.map((b) => b.value);
  }

  static industryFocus(report: ExecutiveIntelligenceReport): string {
    return report.persona.industryFocus.value;
  }

  static influenceLevel(report: ExecutiveIntelligenceReport): string {
    return report.persona.influenceLevel.value;
  }

  static technologyInterest(report: ExecutiveIntelligenceReport): string {
    return report.persona.technologyInterest.value;
  }

  static archetype(report: ExecutiveIntelligenceReport): string {
    return report.archetypeClassification.archetype;
  }

  static opportunityThemes(report: ExecutiveIntelligenceReport): string[] {
    const themes = new Set<string>();
    for (const opp of report.opportunities) {
      for (const t of opp.suggestedEventThemes) themes.add(t);
    }
    return Array.from(themes);
  }

  // ── Relationship report value accessors ─────────

  static relationshipScore(report: RelationshipIntelligenceReport): number {
    return report.scores.overallScore;
  }

  static relationshipStage(report: RelationshipIntelligenceReport): string {
    return report.relationshipProfile.stage;
  }

  static relationshipConfidence(report: RelationshipIntelligenceReport): number {
    return report.confidenceSummary.overallConfidence;
  }

  static engagementReadiness(report: RelationshipIntelligenceReport): string {
    return report.relationshipProfile.engagementReadiness;
  }

  // ── Citation helpers ────────────────────────────

  static emptyCitation(): DecisionCitation {
    return { factIds: [], sourceIds: [] };
  }

  static mergeCitations(citations: DecisionCitation[]): DecisionCitation {
    const factIds = new Set<string>();
    const sourceIds = new Set<string>();
    for (const c of citations) {
      for (const fid of c.factIds) factIds.add(fid);
      for (const sid of c.sourceIds) sourceIds.add(sid);
    }
    return { factIds: Array.from(factIds), sourceIds: Array.from(sourceIds) };
  }

  static citation(factIds: string[], sourceIds: string[]): DecisionCitation {
    return { factIds: [...factIds], sourceIds: [...sourceIds] };
  }

  // ── Token matching ──────────────────────────────

  static sharesTokens(a: string, b: string): boolean {
    const tokensA = a.toLowerCase().split(/[\s,;&/|-]+/).filter((t) => t.length > 2);
    const tokensB = b.toLowerCase().split(/[\s,;&/|-]+/).filter((t) => t.length > 2);
    const setB = new Set(tokensB);
    return tokensA.some((t) => setB.has(t));
  }

  static tokenOverlapCount(a: string, b: string): number {
    const tokensA = a.toLowerCase().split(/[\s,;&/|-]+/).filter((t) => t.length > 2);
    const tokensB = b.toLowerCase().split(/[\s,;&/|-]+/).filter((t) => t.length > 2);
    const setB = new Set(tokensB);
    return tokensA.filter((t) => setB.has(t)).length;
  }

  // ── Grounding helpers ───────────────────────────

  static countGrounded(items: { factIds: string[] }[]): number {
    return items.filter((i) => i.factIds.length > 0).length;
  }

  static groundingRate(total: number, grounded: number): number {
    if (total === 0) return 0;
    return Math.round((grounded / total) * 100);
  }

  static clampScore(value: number): number {
    return Math.max(0, Math.min(100, Math.round(value)));
  }
}
