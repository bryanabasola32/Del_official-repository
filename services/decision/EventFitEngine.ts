import type { ExecutiveIntelligenceReport } from '../intelligence/IntelligenceTypes';
import type { RelationshipIntelligenceReport } from '../relationship/RelationshipTypes';
import type { EventContext, OrganizationObjectives, EventFitAnalysis, EventFitDimension, DecisionCitation } from './DecisionTypes';
import { DecisionHelper } from './DecisionHelper';

/*
 * EventFitEngine — determines how well an executive fits a specific event.
 *
 * Evaluates 6 dimensions:
 *   1. Industry alignment
 *   2. Technology alignment
 *   3. Strategic priorities alignment
 *   4. Executive interests alignment
 *   5. Relationship strength
 *   6. Event themes & organizational objectives alignment
 *
 * Every dimension score includes confidence, reasoning, factIds, sourceIds.
 * No randomness. No network calls. No AI providers.
 */

export class EventFitEngine {
  analyze(
    execReport: ExecutiveIntelligenceReport,
    relReport: RelationshipIntelligenceReport,
    event: EventContext,
    objectives: OrganizationObjectives,
  ): EventFitAnalysis {
    const dimensions: EventFitDimension[] = [];

    // ── 1. Industry alignment ──
    dimensions.push(this.scoreIndustryAlignment(execReport, event, objectives));

    // ── 2. Technology alignment ──
    dimensions.push(this.scoreTechnologyAlignment(execReport, event));

    // ── 3. Strategic priorities alignment ──
    dimensions.push(this.scoreStrategicPriorities(execReport, event, objectives));

    // ── 4. Executive interests alignment ──
    dimensions.push(this.scoreInterestsAlignment(execReport, event));

    // ── 5. Relationship strength ──
    dimensions.push(this.scoreRelationshipStrength(relReport));

    // ── 6. Event themes & objectives alignment ──
    dimensions.push(this.scoreEventThemes(execReport, event, objectives));

    // ── Aggregate ──
    const weights = [0.20, 0.15, 0.20, 0.10, 0.20, 0.15];
    let weightedScore = 0;
    let weightedConfidence = 0;
    const allFactIds = new Set<string>();
    const allSourceIds = new Set<string>();

    for (let i = 0; i < dimensions.length; i++) {
      const dim = dimensions[i];
      const w = weights[i];
      weightedScore += dim.score * w;
      weightedConfidence += dim.confidence * w;
      for (const fid of dim.factIds) allFactIds.add(fid);
      for (const sid of dim.sourceIds) allSourceIds.add(sid);
    }

    const overallFitScore = DecisionHelper.clampScore(weightedScore);
    const confidence = DecisionHelper.clampScore(weightedConfidence);
    const citations: DecisionCitation = {
      factIds: Array.from(allFactIds),
      sourceIds: Array.from(allSourceIds),
    };

    const formula = 'overallFit = industry×0.20 + tech×0.15 + priorities×0.20 + interests×0.10 + relationship×0.20 + themes×0.15';

    const reasoning = `Event fit score computed as weighted sum of 6 dimensions: ${dimensions.map((d) => `${d.dimension}=${d.score}`).join(', ')}. Overall: ${overallFitScore}/100 at ${confidence}% confidence.`;

    return { overallFitScore, confidence, reasoning, formula, dimensions, citations };
  }

  // ── Dimension scorers ────────────────────────────

  private scoreIndustryAlignment(
    report: ExecutiveIntelligenceReport,
    event: EventContext,
    objectives: OrganizationObjectives,
  ): EventFitDimension {
    const execIndustry = DecisionHelper.industryFocus(report);
    const eventIndustries = event.targetIndustries;
    const orgIndustries = objectives.targetIndustries;

    let score = 0;
    const factIds: string[] = [];
    const sourceIds: string[] = [];

    if (execIndustry === 'Unknown' || execIndustry === '') {
      return {
        dimension: 'Industry Alignment',
        score: 0,
        confidence: 0,
        reasoning: 'Executive industry focus is Unknown — cannot assess industry alignment.',
        factIds: [],
        sourceIds: [],
      };
    }

    const matchesEvent = eventIndustries.some((ind) => DecisionHelper.sharesTokens(execIndustry, ind));
    const matchesOrg = orgIndustries.some((ind) => DecisionHelper.sharesTokens(execIndustry, ind));

    if (matchesEvent) score += 50;
    if (matchesOrg) score += 30;
    if (matchesEvent && matchesOrg) score += 20;

    const inf = report.persona.industryFocus;
    factIds.push(...inf.factIds);
    sourceIds.push(...inf.sourceIds);

    const confidence = inf.confidence;
    const reasoning = `Executive industry focus "${execIndustry}" ${matchesEvent ? 'matches' : 'does not match'} event target industries [${eventIndustries.join(', ')}] and ${matchesOrg ? 'matches' : 'does not match'} org target industries [${orgIndustries.join(', ')}]. Score: ${score}/100.`;

    return { dimension: 'Industry Alignment', score, confidence, reasoning, factIds, sourceIds };
  }

  private scoreTechnologyAlignment(
    report: ExecutiveIntelligenceReport,
    event: EventContext,
  ): EventFitDimension {
    const techInterest = DecisionHelper.technologyInterest(report);
    const eventTheme = `${event.theme ?? ''} ${event.primaryTheme ?? ''} ${event.description ?? ''}`.trim();

    if (techInterest === 'Unknown' || techInterest === '') {
      return {
        dimension: 'Technology Alignment',
        score: 0,
        confidence: 0,
        reasoning: 'Executive technology interest is Unknown — cannot assess technology alignment.',
        factIds: [],
        sourceIds: [],
      };
    }

    const overlap = DecisionHelper.tokenOverlapCount(techInterest, eventTheme);
    const inf = report.persona.technologyInterest;
    let score = Math.min(100, overlap * 25);

    if (eventTheme === '') score = Math.round(inf.confidence * 0.3);

    const reasoning = `Executive technology interest "${techInterest}" has ${overlap} token overlap(s) with event theme "${eventTheme}". Score: ${score}/100.`;

    return {
      dimension: 'Technology Alignment',
      score,
      confidence: inf.confidence,
      reasoning,
      factIds: [...inf.factIds],
      sourceIds: [...inf.sourceIds],
    };
  }

  private scoreStrategicPriorities(
    report: ExecutiveIntelligenceReport,
    event: EventContext,
    objectives: OrganizationObjectives,
  ): EventFitDimension {
    const priorities = report.persona.strategicPriorities;
    if (priorities.length === 0) {
      return {
        dimension: 'Strategic Priorities Alignment',
        score: 0,
        confidence: 0,
        reasoning: 'No strategic priorities identified for this executive.',
        factIds: [],
        sourceIds: [],
      };
    }

    const eventText = `${event.theme ?? ''} ${event.primaryTheme ?? ''} ${eventGoals_join(event.eventGoals)} ${objectives.strategicGoals.join(' ')}`;
    let matchedCount = 0;
    const factIds: string[] = [];
    const sourceIds: string[] = [];
    let totalConf = 0;

    for (const p of priorities) {
      if (DecisionHelper.sharesTokens(p.value, eventText)) {
        matchedCount++;
        factIds.push(...p.factIds);
        sourceIds.push(...p.sourceIds);
      }
      totalConf += p.confidence;
    }

    const matchRate = matchedCount / priorities.length;
    const score = DecisionHelper.clampScore(matchRate * 80 + (matchedCount > 0 ? 20 : 0));
    const confidence = Math.round(totalConf / priorities.length);
    const reasoning = `${matchedCount}/${priorities.length} strategic priorities align with event/org themes. Score: ${score}/100.`;

    return { dimension: 'Strategic Priorities Alignment', score, confidence, reasoning, factIds, sourceIds };
  }

  private scoreInterestsAlignment(
    report: ExecutiveIntelligenceReport,
    event: EventContext,
  ): EventFitDimension {
    const interests = report.persona.businessInterests;
    if (interests.length === 0) {
      return {
        dimension: 'Executive Interests Alignment',
        score: 0,
        confidence: 0,
        reasoning: 'No business interests identified for this executive.',
        factIds: [],
        sourceIds: [],
      };
    }

    const eventText = `${event.theme ?? ''} ${event.primaryTheme ?? ''} ${event.description ?? ''}`;
    let matched = 0;
    const factIds: string[] = [];
    const sourceIds: string[] = [];
    let totalConf = 0;

    for (const interest of interests) {
      if (DecisionHelper.sharesTokens(interest.value, eventText)) {
        matched++;
        factIds.push(...interest.factIds);
        sourceIds.push(...interest.sourceIds);
      }
      totalConf += interest.confidence;
    }

    const score = DecisionHelper.clampScore((matched / interests.length) * 100);
    const confidence = Math.round(totalConf / interests.length);
    const reasoning = `${matched}/${interests.length} business interests align with event content. Score: ${score}/100.`;

    return { dimension: 'Executive Interests Alignment', score, confidence, reasoning, factIds, sourceIds };
  }

  private scoreRelationshipStrength(
    relReport: RelationshipIntelligenceReport,
  ): EventFitDimension {
    const score = relReport.scores.overallScore;
    const confidence = relReport.confidenceSummary.overallConfidence;
    const factIds = relReport.scores.citations.factIds;
    const sourceIds = relReport.scores.citations.sourceIds;
    const reasoning = `Relationship strength score: ${score}/100 (stage: ${relReport.relationshipProfile.stage}, readiness: ${relReport.relationshipProfile.engagementReadiness}).`;

    return { dimension: 'Relationship Strength', score, confidence, reasoning, factIds, sourceIds };
  }

  private scoreEventThemes(
    report: ExecutiveIntelligenceReport,
    event: EventContext,
    objectives: OrganizationObjectives,
  ): EventFitDimension {
    const oppThemes = DecisionHelper.opportunityThemes(report);
    const eventText = `${event.theme ?? ''} ${event.primaryTheme ?? ''} ${objectives.eventGoals.join(' ')}`;

    if (oppThemes.length === 0) {
      return {
        dimension: 'Event Themes & Objectives Alignment',
        score: 0,
        confidence: 0,
        reasoning: 'No opportunity themes identified from executive intelligence.',
        factIds: [],
        sourceIds: [],
      };
    }

    let matched = 0;
    const factIds: string[] = [];
    const sourceIds: string[] = [];

    for (const opp of report.opportunities) {
      for (const theme of opp.suggestedEventThemes) {
        if (DecisionHelper.sharesTokens(theme, eventText)) {
          matched++;
          factIds.push(...opp.factIds);
          sourceIds.push(...opp.sourceIds);
        }
      }
    }

    const totalThemes = oppThemes.length;
    const score = DecisionHelper.clampScore(totalThemes > 0 ? (matched / totalThemes) * 100 : 0);
    const confidence = report.opportunities.length > 0
      ? DecisionHelper.aggregateConfidence(report.opportunities)
      : 0;
    const reasoning = `${matched}/${totalThemes} opportunity themes align with event/org objectives. Score: ${score}/100.`;

    return { dimension: 'Event Themes & Objectives Alignment', score, confidence, reasoning, factIds, sourceIds };
  }
}

function eventGoals_join(goals: string[]): string {
  return goals.join(' ');
}
