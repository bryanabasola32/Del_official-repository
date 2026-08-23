import type { ExecutiveIntelligenceReport } from '../intelligence/IntelligenceTypes';
import type { RelationshipIntelligenceReport } from '../relationship/RelationshipTypes';
import type { EventContext, OrganizationObjectives, OpportunityMatch, OpportunityRole, StrategicBenefit } from './DecisionTypes';
import { DecisionHelper } from './DecisionHelper';

/*
 * OpportunityMatchingEngine — matches executive to organization objectives,
 * event goals, and business opportunities.
 *
 * Roles evaluated: speaker, sponsor, VIP guest, panelist, mentor, partner, investor, advisor
 *
 * Every match requires evidence (factIds + sourceIds from MP4/MP5).
 * No evidence → matchScore=0, confidence=0.
 */

const ALL_ROLES: OpportunityRole[] = [
  'speaker', 'sponsor', 'VIP guest', 'panelist', 'mentor', 'partner', 'investor', 'advisor',
];

export class OpportunityMatchingEngine {
  match(
    execReport: ExecutiveIntelligenceReport,
    relReport: RelationshipIntelligenceReport,
    event: EventContext,
    objectives: OrganizationObjectives,
  ): { matches: OpportunityMatch[]; benefits: StrategicBenefit[] } {
    const matches: OpportunityMatch[] = [];
    const benefits: StrategicBenefit[] = [];

    for (const role of ALL_ROLES) {
      const match = this.scoreRole(execReport, relReport, event, objectives, role);
      if (match.matchScore > 0) {
        matches.push(match);
      }
    }

    matches.sort((a, b) => b.matchScore - a.matchScore);

    // ── Strategic benefits from top matches ──
    for (const match of matches.slice(0, 5)) {
      benefits.push({
        benefit: `Engage as ${match.role}`,
        alignment: match.reasoning,
        confidence: match.confidence,
        reasoning: match.reasoning,
        factIds: match.factIds,
        sourceIds: match.sourceIds,
      });
    }

    // ── Strategic benefits from aligned priorities ──
    for (const priority of execReport.persona.strategicPriorities.slice(0, 3)) {
      const alignedGoal = objectives.strategicGoals.find((g) => DecisionHelper.sharesTokens(priority.value, g));
      if (alignedGoal) {
        benefits.push({
          benefit: `Strategic priority alignment: ${priority.value}`,
          alignment: `Aligns with org goal: ${alignedGoal}`,
          confidence: priority.confidence,
          reasoning: `Executive priority "${priority.value}" aligns with organizational goal "${alignedGoal}".`,
          factIds: [...priority.factIds],
          sourceIds: [...priority.sourceIds],
        });
      }
    }

    return { matches, benefits };
  }

  private scoreRole(
    execReport: ExecutiveIntelligenceReport,
    relReport: RelationshipIntelligenceReport,
    event: EventContext,
    objectives: OrganizationObjectives,
    role: OpportunityRole,
  ): OpportunityMatch {
    const influence = execReport.persona.influenceLevel;
    const leadership = execReport.persona.leadershipStyle;
    const networking = execReport.persona.networkingStyle;
    const archetype = execReport.archetypeClassification.archetype;
    const relationship = relReport.scores.overallScore;
    const execConf = DecisionHelper.executiveConfidence(execReport);

    let score = 0;
    const factIds: string[] = [];
    const sourceIds: string[] = [];
    let reasoningParts: string[] = [];

    // ── Desired by organization ──
    if (objectives.desiredOpportunities.includes(role)) {
      score += 20;
      reasoningParts.push(`Organization desires ${role} role`);
    }

    // ── Role-specific scoring ──
    switch (role) {
      case 'speaker':
        if (influence.value === 'Industry Leader' || influence.value === 'Sector Influencer') {
          score += 30;
          factIds.push(...influence.factIds);
          sourceIds.push(...influence.sourceIds);
          reasoningParts.push(`${influence.value} influence level suits speaker role`);
        }
        if (archetype === 'Technology Visionary' || archetype === 'Innovation Leader') {
          score += 15;
          reasoningParts.push(`${archetype} archetype aligns with speaking themes`);
        }
        if (event.eventGoals.some((g) => DecisionHelper.sharesTokens('speaker keynote presentation', g))) {
          score += 10;
        }
        break;

      case 'sponsor':
        if (influence.value === 'Industry Leader' || influence.value === 'Company Leader') {
          score += 25;
          factIds.push(...influence.factIds);
          sourceIds.push(...influence.sourceIds);
          reasoningParts.push(`${influence.value} suitable for sponsor visibility`);
        }
        if (relationship >= 50) {
          score += 15;
          reasoningParts.push(`Relationship score ${relationship} supports sponsor engagement`);
        }
        break;

      case 'VIP guest':
        if (influence.value !== 'Unknown' && influence.value !== 'Emerging Voice') {
          score += 30;
          factIds.push(...influence.factIds);
          sourceIds.push(...influence.sourceIds);
          reasoningParts.push(`${influence.value} warrants VIP treatment`);
        }
        if (relationship >= 40) {
          score += 10;
        }
        break;

      case 'panelist':
        if (leadership.value !== 'Unknown') {
          score += 20;
          factIds.push(...leadership.factIds);
          sourceIds.push(...leadership.sourceIds);
          reasoningParts.push(`${leadership.value} leadership style suits panel discussion`);
        }
        if (archetype !== 'Unknown') {
          score += 15;
          reasoningParts.push(`${archetype} archetype adds panel diversity`);
        }
        break;

      case 'mentor':
        if (networking.value === 'Relationship Builder' || networking.value === 'Community Builder') {
          score += 30;
          factIds.push(...networking.factIds);
          sourceIds.push(...networking.sourceIds);
          reasoningParts.push(`${networking.value} networking style suits mentor role`);
        }
        if (influence.value === 'Industry Leader' || influence.value === 'Sector Influencer') {
          score += 15;
        }
        break;

      case 'partner':
        if (archetype === 'Growth Executive' || archetype === 'Operational Optimizer') {
          score += 25;
          reasoningParts.push(`${archetype} archetype aligns with partnership`);
        }
        if (execReport.persona.strategicPriorities.some((p) =>
          DecisionHelper.sharesTokens(p.value, 'partnership collaboration alliance')
        )) {
          score += 20;
          const matched = execReport.persona.strategicPriorities.find((p) =>
            DecisionHelper.sharesTokens(p.value, 'partnership collaboration alliance')
          )!;
          factIds.push(...matched.factIds);
          sourceIds.push(...matched.sourceIds);
          reasoningParts.push(`Strategic priority "${matched.value}" supports partnership`);
        }
        break;

      case 'investor':
        if (archetype === 'Financial Strategist' || archetype === 'Growth Executive') {
          score += 30;
          reasoningParts.push(`${archetype} archetype suits investor role`);
        }
        if (execReport.persona.businessInterests.some((b) =>
          DecisionHelper.sharesTokens(b.value, 'investment funding venture capital')
        )) {
          score += 20;
          const matched = execReport.persona.businessInterests.find((b) =>
            DecisionHelper.sharesTokens(b.value, 'investment funding venture capital')
          )!;
          factIds.push(...matched.factIds);
          sourceIds.push(...matched.sourceIds);
          reasoningParts.push(`Business interest "${matched.value}" supports investor engagement`);
        }
        break;

      case 'advisor':
        if (leadership.value === 'Strategic' || leadership.value === 'Transformational') {
          score += 25;
          factIds.push(...leadership.factIds);
          sourceIds.push(...leadership.sourceIds);
          reasoningParts.push(`${leadership.value} leadership style suits advisor role`);
        }
        if (influence.value === 'Industry Leader') {
          score += 15;
        }
        break;
    }

    // ── If no evidence-backed score, return zeroed match ──
    if (factIds.length === 0) {
      return {
        role,
        matchScore: 0,
        confidence: 0,
        reasoning: `No evidence supports ${role} role. Score: 0.`,
        factIds: [],
        sourceIds: [],
      };
    }

    // ── Scale by executive confidence (low exec confidence reduces match) ──
    const confMultiplier = execConf > 0 ? execConf / 100 : 1;
    score = DecisionHelper.clampScore(score * confMultiplier);
    const confidence = DecisionHelper.clampScore(execConf * 0.6 + relationship * 0.4);
    const reasoning = reasoningParts.length > 0
      ? reasoningParts.join('; ') + `. Score: ${score}/100.`
      : `No evidence supports ${role} role. Score: 0.`;

    return {
      role,
      matchScore: score,
      confidence,
      reasoning,
      factIds,
      sourceIds,
    };
  }
}
