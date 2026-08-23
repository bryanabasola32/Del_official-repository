import type { ExecutiveIntelligenceReport } from '../intelligence/IntelligenceTypes';
import type { RelationshipIntelligenceReport } from '../relationship/RelationshipTypes';
import type { EventContext, OrganizationObjectives, EventFitAnalysis, InviteRecommendation, DecisionRisk, DecisionRiskType, DecisionRiskSeverity } from './DecisionTypes';
import { DecisionHelper } from './DecisionHelper';

/*
 * DecisionRiskEngine — identifies risks specific to the DECISION (not relationship).
 *
 * Risk types:
 *   poor_invite_timing, low_confidence_recommendation, weak_evidence,
 *   organizational_mismatch, event_mismatch, uncertain_priorities, strategic_conflict
 *
 * Each risk: severity, confidence, reasoning, citations.
 * No randomness.
 */

export class DecisionRiskEngine {
  assess(
    execReport: ExecutiveIntelligenceReport,
    relReport: RelationshipIntelligenceReport,
    event: EventContext,
    objectives: OrganizationObjectives,
    eventFit: EventFitAnalysis,
    invite: InviteRecommendation,
  ): DecisionRisk[] {
    const risks: DecisionRisk[] = [];

    // ── 1. Poor invite timing ──
    risks.push(...this.checkInviteTiming(relReport, invite));

    // ── 2. Low confidence recommendation ──
    risks.push(...this.checkLowConfidence(invite));

    // ── 3. Weak evidence ──
    risks.push(...this.checkWeakEvidence(execReport));

    // ── 4. Organizational mismatch ──
    risks.push(...this.checkOrgMismatch(execReport, objectives));

    // ── 5. Event mismatch ──
    risks.push(...this.checkEventMismatch(eventFit));

    // ── 6. Uncertain priorities ──
    risks.push(...this.checkUncertainPriorities(execReport));

    // ── 7. Strategic conflict ──
    risks.push(...this.checkStrategicConflict(execReport, objectives));

    return risks;
  }

  // ── Risk checks ──────────────────────────────────

  private checkInviteTiming(
    relReport: RelationshipIntelligenceReport,
    invite: InviteRecommendation,
  ): DecisionRisk[] {
    const risks: DecisionRisk[] = [];
    const stage = relReport.relationshipProfile.stage;
    const readiness = relReport.relationshipProfile.engagementReadiness;

    if (invite.decision === 'Invite Immediately' && (stage === 'First Contact' || stage === 'Unknown')) {
      risks.push({
        type: 'poor_invite_timing',
        description: 'Inviting immediately when relationship stage is early or unknown',
        severity: 'high',
        confidence: 100,
        reasoning: `Invite decision is "Invite Immediately" but relationship stage is "${stage}". Sending an invitation now may damage the relationship.`,
        factIds: [...relReport.relationshipProfile.citations.factIds],
        sourceIds: [...relReport.relationshipProfile.citations.sourceIds],
      });
    }

    if (invite.decision === 'Invite' && readiness === 'Not Ready') {
      risks.push({
        type: 'poor_invite_timing',
        description: 'Inviting when engagement readiness is "Not Ready"',
        severity: 'medium',
        confidence: 100,
        reasoning: `Invite decision is "Invite" but engagement readiness is "Not Ready". Consider building rapport first.`,
        factIds: [...relReport.relationshipProfile.citations.factIds],
        sourceIds: [...relReport.relationshipProfile.citations.sourceIds],
      });
    }

    return risks;
  }

  private checkLowConfidence(invite: InviteRecommendation): DecisionRisk[] {
    if (invite.confidence < 30 && invite.decision !== 'Unknown' && invite.decision !== 'Do Not Invite') {
      return [{
        type: 'low_confidence_recommendation',
        description: `Invite recommendation has low confidence (${invite.confidence}%)`,
        severity: 'medium',
        confidence: 100,
        reasoning: `The invite recommendation "${invite.decision}" is backed by only ${invite.confidence}% confidence. The decision may change with additional evidence.`,
        factIds: [...invite.factIds],
        sourceIds: [...invite.sourceIds],
      }];
    }
    return [];
  }

  private checkWeakEvidence(execReport: ExecutiveIntelligenceReport): DecisionRisk[] {
    const trust = execReport.evidenceSummary.trustScore;
    const totalFacts = execReport.evidenceSummary.totalFacts;
    const completeness = execReport.evidenceSummary.completeness;

    if (trust < 30 || totalFacts < 5) {
      return [{
        type: 'weak_evidence',
        description: `Evidence base is weak (trust=${trust}, facts=${totalFacts})`,
        severity: 'high',
        confidence: 100,
        reasoning: `Evidence trust score is ${trust} with ${totalFacts} facts and ${completeness}% completeness. Decision quality is compromised by insufficient evidence.`,
        factIds: [],
        sourceIds: [],
      }];
    }
    if (completeness < 40) {
      return [{
        type: 'weak_evidence',
        description: `Evidence completeness is low (${completeness}%)`,
        severity: 'medium',
        confidence: 100,
        reasoning: `Evidence completeness is ${completeness}%. Key attributes may be missing, reducing decision reliability.`,
        factIds: [],
        sourceIds: [],
      }];
    }
    return [];
  }

  private checkOrgMismatch(
    execReport: ExecutiveIntelligenceReport,
    objectives: OrganizationObjectives,
  ): DecisionRisk[] {
    const execIndustry = DecisionHelper.industryFocus(execReport);
    if (execIndustry === 'Unknown') return [];

    const matches = objectives.targetIndustries.some((ind) => DecisionHelper.sharesTokens(execIndustry, ind));
    if (!matches && objectives.targetIndustries.length > 0) {
      return [{
        type: 'organizational_mismatch',
        description: `Executive industry "${execIndustry}" does not match org target industries`,
        severity: 'medium',
        confidence: execReport.persona.industryFocus.confidence,
        reasoning: `Executive industry focus "${execIndustry}" does not align with organizational target industries [${objectives.targetIndustries.join(', ')}].`,
        factIds: [...execReport.persona.industryFocus.factIds],
        sourceIds: [...execReport.persona.industryFocus.sourceIds],
      }];
    }
    return [];
  }

  private checkEventMismatch(eventFit: EventFitAnalysis): DecisionRisk[] {
    if (eventFit.overallFitScore < 30) {
      return [{
        type: 'event_mismatch',
        description: `Event fit score is very low (${eventFit.overallFitScore}/100)`,
        severity: 'high',
        confidence: eventFit.confidence,
        reasoning: `Overall event fit is ${eventFit.overallFitScore}/100. The executive is a poor match for this event's themes, industries, and objectives.`,
        factIds: [...eventFit.citations.factIds],
        sourceIds: [...eventFit.citations.sourceIds],
      }];
    }
    if (eventFit.overallFitScore < 45) {
      return [{
        type: 'event_mismatch',
        description: `Event fit score is below moderate threshold (${eventFit.overallFitScore}/100)`,
        severity: 'low',
        confidence: eventFit.confidence,
        reasoning: `Overall event fit is ${eventFit.overallFitScore}/100. The executive is a marginal match for this event.`,
        factIds: [...eventFit.citations.factIds],
        sourceIds: [...eventFit.citations.sourceIds],
      }];
    }
    return [];
  }

  private checkUncertainPriorities(execReport: ExecutiveIntelligenceReport): DecisionRisk[] {
    const priorities = execReport.persona.strategicPriorities;
    const unknownCount = priorities.filter((p) => p.confidence < 30).length;
    if (priorities.length > 0 && unknownCount / priorities.length > 0.5) {
      return [{
        type: 'uncertain_priorities',
        description: `${unknownCount}/${priorities.length} strategic priorities have low confidence`,
        severity: 'medium',
        confidence: 100,
        reasoning: `More than half of strategic priorities have confidence below 30%. Strategic alignment assessment may be unreliable.`,
        factIds: priorities.filter((p) => p.confidence < 30).flatMap((p) => p.factIds),
        sourceIds: priorities.filter((p) => p.confidence < 30).flatMap((p) => p.sourceIds),
      }];
    }
    return [];
  }

  private checkStrategicConflict(
    execReport: ExecutiveIntelligenceReport,
    objectives: OrganizationObjectives,
  ): DecisionRisk[] {
    const risks: DecisionRisk[] = [];

    for (const priority of execReport.persona.strategicPriorities) {
      const val = priority.value.toLowerCase();
      const conflictKeywords = ['compete', 'competitor', 'rival', 'opposing', 'against'];
      if (conflictKeywords.some((kw) => val.includes(kw))) {
        risks.push({
          type: 'strategic_conflict',
          description: `Executive priority "${priority.value}" may conflict with organizational goals`,
          severity: 'high',
          confidence: priority.confidence,
          reasoning: `Strategic priority "${priority.value}" contains conflict-related language. This may indicate competing interests with organizational objectives [${objectives.strategicGoals.join(', ')}].`,
          factIds: [...priority.factIds],
          sourceIds: [...priority.sourceIds],
        });
      }
    }

    return risks;
  }
}
