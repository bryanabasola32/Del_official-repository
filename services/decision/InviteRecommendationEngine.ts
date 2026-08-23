import type { ExecutiveIntelligenceReport } from '../intelligence/IntelligenceTypes';
import type { RelationshipIntelligenceReport } from '../relationship/RelationshipTypes';
import type { EventContext, OrganizationObjectives, InviteRecommendation, InviteDecision, EventFitAnalysis } from './DecisionTypes';
import { DecisionHelper } from './DecisionHelper';

/*
 * InviteRecommendationEngine — produces the invite decision.
 *
 * Possible outputs: Invite Immediately | Invite | Invite Later | Observe | Do Not Invite | Unknown
 *
 * Decision logic (deterministic, rule-based):
 *   - Invite Immediately: fit >= 75, relationship >= 60, exec confidence >= 60
 *   - Invite: fit >= 55, relationship >= 40, exec confidence >= 40
 *   - Invite Later: fit >= 40, relationship >= 25
 *   - Observe: fit >= 25
 *   - Do Not Invite: fit < 25 OR exec confidence < 20
 *   - Unknown: any critical input is Unknown
 *
 * Never invents certainty. Unknown evidence → Unknown decision, confidence 0.
 */

export class InviteRecommendationEngine {
  recommend(
    execReport: ExecutiveIntelligenceReport,
    relReport: RelationshipIntelligenceReport,
    event: EventContext,
    _objectives: OrganizationObjectives,
    eventFit: EventFitAnalysis,
  ): InviteRecommendation {
    const fit = eventFit.overallFitScore;
    const relationship = relReport.scores.overallScore;
    const execConfidence = DecisionHelper.executiveConfidence(execReport);
    const evidenceConf = DecisionHelper.evidenceConfidence(execReport);
    const readiness = relReport.relationshipProfile.engagementReadiness;
    const stage = relReport.relationshipProfile.stage;

    // ── Unknown propagation ──
    if (
      stage === 'Unknown' ||
      readiness === 'Unknown' ||
      execConfidence === 0 ||
      eventFit.confidence === 0
    ) {
      return {
        decision: 'Unknown',
        confidence: 0,
        reasoning: `Critical input is Unknown (stage=${stage}, readiness=${readiness}, execConfidence=${execConfidence}, fitConfidence=${eventFit.confidence}). Cannot produce a reliable invite recommendation.`,
        factIds: [],
        sourceIds: [],
        conditions: ['Gather additional evidence before making invite decision'],
      };
    }

    // ── Decision rules ──
    let decision: InviteDecision;
    let confidence: number;
    const conditions: string[] = [];

    if (fit >= 75 && relationship >= 60 && execConfidence >= 60) {
      decision = 'Invite Immediately';
      confidence = Math.round((fit + relationship + execConfidence) / 3);
      conditions.push('Confirm executive availability before sending invitation');
    } else if (fit >= 55 && relationship >= 40 && execConfidence >= 40) {
      decision = 'Invite';
      confidence = Math.round((fit * 0.4 + relationship * 0.35 + execConfidence * 0.25));
      conditions.push('Personalize invitation with relevant conversation starters');
    } else if (fit >= 40 && relationship >= 25) {
      decision = 'Invite Later';
      confidence = Math.round((fit * 0.35 + relationship * 0.35 + execConfidence * 0.30));
      conditions.push('Build relationship before extending invitation');
      conditions.push('Monitor for relevant strategic developments');
    } else if (fit >= 25) {
      decision = 'Observe';
      confidence = Math.round((fit * 0.40 + execConfidence * 0.30 + evidenceConf * 0.30));
      conditions.push('Continue monitoring executive activity and industry developments');
      conditions.push('Reassess when additional evidence is gathered');
    } else {
      decision = 'Do Not Invite';
      confidence = Math.round(100 - Math.max(fit, execConfidence));
      conditions.push('Executive is not a strong fit for this event');
      if (execConfidence < 20) {
        conditions.push('Insufficient executive intelligence confidence');
      }
    }

    // ── Collect citations ──
    const factIds = new Set<string>([
      ...eventFit.citations.factIds,
      ...relReport.scores.citations.factIds,
    ]);
    const sourceIds = new Set<string>([
      ...eventFit.citations.sourceIds,
      ...relReport.scores.citations.sourceIds,
    ]);

    const reasoning = `Event fit=${fit}/100, relationship=${relationship}/100, execConfidence=${execConfidence}%, evidence=${evidenceConf}%. Decision: ${decision}. Confidence: ${confidence}%.`;

    return {
      decision,
      confidence: DecisionHelper.clampScore(confidence),
      reasoning,
      factIds: Array.from(factIds),
      sourceIds: Array.from(sourceIds),
      conditions,
    };
  }
}
