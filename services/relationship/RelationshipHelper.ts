import type { ExecutiveIntelligenceReport } from '../intelligence/IntelligenceTypes';
import type { RelationshipCitation } from './RelationshipTypes';

/*
 * RelationshipHelper — shared utilities for querying ExecutiveIntelligenceReport.
 *
 * All MP5 engines use these helpers to extract data from the MP4 report.
 * This ensures consistent lookups and avoids duplicating logic.
 */

export class RelationshipHelper {
  /** Get all inference fact IDs from the report. */
  static collectAllFactIds(report: ExecutiveIntelligenceReport): string[] {
    const ids = new Set<string>();
    const persona = report.persona;
    const allInferences = [
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
    for (const inf of allInferences) {
      for (const fid of inf.factIds) ids.add(fid);
    }
    for (const rec of report.recommendations) {
      for (const fid of rec.factIds) ids.add(fid);
    }
    return Array.from(ids);
  }

  /** Get all inference source IDs from the report. */
  static collectAllSourceIds(report: ExecutiveIntelligenceReport): string[] {
    const ids = new Set<string>();
    const persona = report.persona;
    const allInferences = [
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
    for (const inf of allInferences) {
      for (const sid of inf.sourceIds) ids.add(sid);
    }
    return Array.from(ids);
  }

  /** Get strategic priorities as string values. */
  static strategicPriorityValues(report: ExecutiveIntelligenceReport): string[] {
    return report.persona.strategicPriorities.map((p) => p.value);
  }

  /** Get business interests as string values. */
  static businessInterestValues(report: ExecutiveIntelligenceReport): string[] {
    return report.persona.businessInterests.map((b) => b.value);
  }

  /** Get all opportunity suggested event themes. */
  static allEventThemes(report: ExecutiveIntelligenceReport): string[] {
    const themes = new Set<string>();
    for (const opp of report.opportunities) {
      for (const theme of opp.suggestedEventThemes) themes.add(theme);
    }
    return Array.from(themes);
  }

  /** Get all opportunity values as strings. */
  static opportunityValues(report: ExecutiveIntelligenceReport): string[] {
    return report.opportunities.map((o) => o.value);
  }

  /** Get the persona's networking style value. */
  static networkingStyle(report: ExecutiveIntelligenceReport): string {
    return report.persona.networkingStyle.value;
  }

  /** Get the persona's communication style value. */
  static communicationStyle(report: ExecutiveIntelligenceReport): string {
    return report.persona.communicationStyle.value;
  }

  /** Get the persona's influence level value. */
  static influenceLevel(report: ExecutiveIntelligenceReport): string {
    return report.persona.influenceLevel.value;
  }

  /** Get the persona's innovation orientation value. */
  static innovationOrientation(report: ExecutiveIntelligenceReport): string {
    return report.persona.innovationOrientation.value;
  }

  /** Get the persona's risk appetite value. */
  static riskAppetite(report: ExecutiveIntelligenceReport): string {
    return report.persona.riskAppetite.value;
  }

  /** Get the persona's leadership style value. */
  static leadershipStyle(report: ExecutiveIntelligenceReport): string {
    return report.persona.leadershipStyle.value;
  }

  /** Get the archetype value. */
  static archetype(report: ExecutiveIntelligenceReport): string {
    return report.archetypeClassification.archetype;
  }

  /** Get the overall confidence from the source report. */
  static overallConfidence(report: ExecutiveIntelligenceReport): number {
    return report.confidenceSummary.overall;
  }

  /** Get the trust score from the source report. */
  static trustScore(report: ExecutiveIntelligenceReport): number {
    return report.evidenceSummary.trustScore;
  }

  /** Get the evidence completeness from the source report. */
  static completeness(report: ExecutiveIntelligenceReport): number {
    return report.evidenceSummary.completeness;
  }

  /** Get the total number of facts from the source report. */
  static totalFacts(report: ExecutiveIntelligenceReport): number {
    return report.evidenceSummary.totalFacts;
  }

  /** Get the total number of sources from the source report. */
  static totalSources(report: ExecutiveIntelligenceReport): number {
    return report.evidenceSummary.totalSources;
  }

  /** Get the count of risks from the source report. */
  static sourceRiskCount(report: ExecutiveIntelligenceReport): number {
    return report.risks.length;
  }

  /** Get the count of opportunities from the source report. */
  static sourceOpportunityCount(report: ExecutiveIntelligenceReport): number {
    return report.opportunities.length;
  }

  /** Check if the persona has a known networking style. */
  static hasKnownNetworkingStyle(report: ExecutiveIntelligenceReport): boolean {
    return report.persona.networkingStyle.value !== 'Unknown';
  }

  /** Check if the persona has a known communication style. */
  static hasKnownCommunicationStyle(report: ExecutiveIntelligenceReport): boolean {
    return report.persona.communicationStyle.value !== 'Unknown';
  }

  /** Check if the persona has a known influence level. */
  static hasKnownInfluenceLevel(report: ExecutiveIntelligenceReport): boolean {
    return report.persona.influenceLevel.value !== 'Unknown';
  }

  /** Check if the persona has known strategic priorities. */
  static hasStrategicPriorities(report: ExecutiveIntelligenceReport): boolean {
    return report.persona.strategicPriorities.length > 0;
  }

  /** Check if the persona has known business interests. */
  static hasBusinessInterests(report: ExecutiveIntelligenceReport): boolean {
    return report.persona.businessInterests.length > 0;
  }

  /** Check if the report has opportunities. */
  static hasOpportunities(report: ExecutiveIntelligenceReport): boolean {
    return report.opportunities.length > 0;
  }

  /** Check if the report has timeline entries. */
  static hasTimeline(report: ExecutiveIntelligenceReport): boolean {
    return report.timeline.length > 0;
  }

  /** Build an empty citation object. */
  static emptyCitation(): RelationshipCitation {
    return { factIds: [], sourceIds: [] };
  }

  /** Merge multiple citation objects into one. */
  static mergeCitations(citations: RelationshipCitation[]): RelationshipCitation {
    const factIds = new Set<string>();
    const sourceIds = new Set<string>();
    for (const c of citations) {
      for (const fid of c.factIds) factIds.add(fid);
      for (const sid of c.sourceIds) sourceIds.add(sid);
    }
    return { factIds: Array.from(factIds), sourceIds: Array.from(sourceIds) };
  }

  /** Create a citation from fact IDs and source IDs arrays. */
  static citation(factIds: string[], sourceIds: string[]): RelationshipCitation {
    return { factIds: [...factIds], sourceIds: [...sourceIds] };
  }

  /** Collect fact IDs and source IDs from an array of inference-like objects. */
  static collectFromInferences(
    inferences: { factIds: string[]; sourceIds: string[] }[],
  ): RelationshipCitation {
    const factIds = new Set<string>();
    const sourceIds = new Set<string>();
    for (const inf of inferences) {
      for (const fid of inf.factIds) factIds.add(fid);
      for (const sid of inf.sourceIds) sourceIds.add(sid);
    }
    return { factIds: Array.from(factIds), sourceIds: Array.from(sourceIds) };
  }

  /** Count how many inference-like objects have non-empty factIds. */
  static countGrounded(inferences: { factIds: string[] }[]): number {
    return inferences.filter((inf) => inf.factIds.length > 0).length;
  }

  /** Compute the grounding rate as a percentage. */
  static groundingRate(total: number, grounded: number): number {
    if (total === 0) return 0;
    return Math.round((grounded / total) * 100);
  }

  /** Average confidence from an array of inference-like objects. */
  static averageConfidence(inferences: { confidence: number }[]): number {
    if (inferences.length === 0) return 0;
    return Math.round(
      inferences.reduce((sum, inf) => sum + inf.confidence, 0) / inferences.length,
    );
  }

  /** Check if two strings share any common tokens (case-insensitive word match). */
  static sharesTokens(a: string, b: string): boolean {
    const tokensA = a.toLowerCase().split(/[\s,;&/|-]+/).filter((t) => t.length > 2);
    const tokensB = b.toLowerCase().split(/[\s,;&/|-]+/).filter((t) => t.length > 2);
    const setB = new Set(tokensB);
    return tokensA.some((t) => setB.has(t));
  }

  /** Count token overlaps between two strings. */
  static tokenOverlapCount(a: string, b: string): number {
    const tokensA = a.toLowerCase().split(/[\s,;&/|-]+/).filter((t) => t.length > 2);
    const tokensB = b.toLowerCase().split(/[\s,;&/|-]+/).filter((t) => t.length > 2);
    const setB = new Set(tokensB);
    return tokensA.filter((t) => setB.has(t)).length;
  }
}
