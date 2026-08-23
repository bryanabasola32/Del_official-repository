import type { ExecutiveIntelligenceReport } from '../intelligence/IntelligenceTypes';
import type { AlignmentObject, AlignmentDimension } from './RelationshipTypes';
import { RelationshipHelper } from './RelationshipHelper';

/*
 * InterestAlignmentEngine — determines overlap between
 * Executive, Business Interests, Strategic Priorities, and Event Themes.
 *
 * Produces AlignmentObjects with alignment score, reasoning, and citations.
 * All scoring is deterministic using token-overlap heuristics.
 */

export class InterestAlignmentEngine {
  analyze(report: ExecutiveIntelligenceReport): AlignmentObject[] {
    const alignments: AlignmentObject[] = [];

    const execToInterests = this.alignExecutiveToInterests(report);
    if (execToInterests) alignments.push(execToInterests);

    const interestsToPriorities = this.alignInterestsToPriorities(report);
    if (interestsToPriorities) alignments.push(interestsToPriorities);

    const prioritiesToThemes = this.alignPrioritiesToThemes(report);
    if (prioritiesToThemes) alignments.push(prioritiesToThemes);

    const execToThemes = this.alignExecutiveToThemes(report);
    if (execToThemes) alignments.push(execToThemes);

    return alignments;
  }

  // ── Executive ↔ Business Interests ────────────────

  private alignExecutiveToInterests(report: ExecutiveIntelligenceReport): AlignmentObject | null {
    const interests = report.persona.businessInterests;
    if (interests.length === 0) return null;

    const techInterest = report.persona.technologyInterest.value;
    const industryFocus = report.persona.industryFocus.value;
    const matchedItems: string[] = [];

    for (const interest of interests) {
      if (techInterest !== 'Unknown' && RelationshipHelper.sharesTokens(interest.value, techInterest)) {
        matchedItems.push(`${interest.value} ↔ ${techInterest}`);
      }
      if (industryFocus !== 'Unknown' && RelationshipHelper.sharesTokens(interest.value, industryFocus)) {
        matchedItems.push(`${interest.value} ↔ ${industryFocus}`);
      }
    }

    const totalPossible = interests.length * 2;
    const alignmentScore = totalPossible > 0
      ? Math.round((matchedItems.length / totalPossible) * 100)
      : 0;

    const citations = RelationshipHelper.collectFromInferences([
      ...interests,
      report.persona.technologyInterest,
      report.persona.industryFocus,
    ]);

    return {
      dimension: 'Executive ↔ Business Interests',
      alignmentScore,
      reasoning: `Compared ${interests.length} business interest(s) against technology interest ("${techInterest}") and industry focus ("${industryFocus}"). ${matchedItems.length} match(es) found out of ${totalPossible} possible comparisons. Alignment score: ${alignmentScore}%.`,
      matchedItems,
      citations,
    };
  }

  // ── Business Interests ↔ Strategic Priorities ─────

  private alignInterestsToPriorities(report: ExecutiveIntelligenceReport): AlignmentObject | null {
    const interests = report.persona.businessInterests;
    const priorities = report.persona.strategicPriorities;
    if (interests.length === 0 || priorities.length === 0) return null;

    const matchedItems: string[] = [];
    for (const interest of interests) {
      for (const priority of priorities) {
        if (RelationshipHelper.sharesTokens(interest.value, priority.value)) {
          matchedItems.push(`${interest.value} ↔ ${priority.value}`);
        }
      }
    }

    const totalPossible = interests.length * priorities.length;
    const alignmentScore = totalPossible > 0
      ? Math.round((matchedItems.length / totalPossible) * 100)
      : 0;

    const citations = RelationshipHelper.collectFromInferences([
      ...interests,
      ...priorities,
    ]);

    return {
      dimension: 'Business Interests ↔ Strategic Priorities',
      alignmentScore,
      reasoning: `Compared ${interests.length} business interest(s) against ${priorities.length} strategic priority(ies). ${matchedItems.length} match(es) found out of ${totalPossible} possible comparisons. Alignment score: ${alignmentScore}%.`,
      matchedItems,
      citations,
    };
  }

  // ── Strategic Priorities ↔ Event Themes ───────────

  private alignPrioritiesToThemes(report: ExecutiveIntelligenceReport): AlignmentObject | null {
    const priorities = report.persona.strategicPriorities;
    const themes = RelationshipHelper.allEventThemes(report);
    if (priorities.length === 0 || themes.length === 0) return null;

    const matchedItems: string[] = [];
    for (const priority of priorities) {
      for (const theme of themes) {
        if (RelationshipHelper.sharesTokens(priority.value, theme)) {
          matchedItems.push(`${priority.value} ↔ ${theme}`);
        }
      }
    }

    const totalPossible = priorities.length * themes.length;
    const alignmentScore = totalPossible > 0
      ? Math.round((matchedItems.length / totalPossible) * 100)
      : 0;

    const citations = RelationshipHelper.collectFromInferences([
      ...priorities,
      ...report.opportunities,
    ]);

    return {
      dimension: 'Strategic Priorities ↔ Event Themes',
      alignmentScore,
      reasoning: `Compared ${priorities.length} strategic priority(ies) against ${themes.length} event theme(s). ${matchedItems.length} match(es) found out of ${totalPossible} possible comparisons. Alignment score: ${alignmentScore}%.`,
      matchedItems,
      citations,
    };
  }

  // ── Executive ↔ Event Themes ───────────────────────

  private alignExecutiveToThemes(report: ExecutiveIntelligenceReport): AlignmentObject | null {
    const themes = RelationshipHelper.allEventThemes(report);
    if (themes.length === 0) return null;

    const execProfile = [
      report.persona.industryFocus,
      report.persona.technologyInterest,
      report.persona.innovationOrientation,
    ].filter((inf) => inf.value !== 'Unknown');

    if (execProfile.length === 0) return null;

    const matchedItems: string[] = [];
    for (const inf of execProfile) {
      for (const theme of themes) {
        if (RelationshipHelper.sharesTokens(inf.value, theme)) {
          matchedItems.push(`${inf.value} ↔ ${theme}`);
        }
      }
    }

    const totalPossible = execProfile.length * themes.length;
    const alignmentScore = totalPossible > 0
      ? Math.round((matchedItems.length / totalPossible) * 100)
      : 0;

    const citations = RelationshipHelper.collectFromInferences([
      ...execProfile,
      ...report.opportunities,
    ]);

    return {
      dimension: 'Executive ↔ Event Themes',
      alignmentScore,
      reasoning: `Compared ${execProfile.length} executive attribute(s) (industry focus, technology interest, innovation orientation) against ${themes.length} event theme(s). ${matchedItems.length} match(es) found out of ${totalPossible} possible comparisons. Alignment score: ${alignmentScore}%.`,
      matchedItems,
      citations,
    };
  }
}
