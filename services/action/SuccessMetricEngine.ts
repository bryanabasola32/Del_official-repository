import type { ExecutiveIntelligenceReport } from '../intelligence/IntelligenceTypes';
import type { RelationshipIntelligenceReport } from '../relationship/RelationshipTypes';
import type { StrategicDecisionReport } from '../decision/DecisionTypes';
import type { SuccessMetrics, SuccessMetric, MetricType } from './ActionTypes';
import { ActionHelper } from './ActionHelper';

/*
 * SuccessMetricEngine — generates measurable KPIs for the engagement.
 *
 * Consumes MP4, MP5, and MP6 public interfaces.
 * Produces metrics with target, measurementMethod, confidence, reasoning.
 * Returns Unknown when insufficient evidence.
 */

export class SuccessMetricEngine {
  generate(
    execReport: ExecutiveIntelligenceReport,
    relReport: RelationshipIntelligenceReport,
    decisionReport: StrategicDecisionReport,
  ): SuccessMetrics {
    if (ActionHelper.isInsufficientEvidence(execReport, relReport, decisionReport)) {
      return this.unknownMetrics();
    }

    const invite = decisionReport.inviteRecommendation.decision;
    const metrics: SuccessMetric[] = [];

    // 1. Meeting Scheduled
    if (invite !== 'Do Not Invite' && invite !== 'Unknown') {
      metrics.push(this.buildMetric(
        'Meeting Scheduled',
        '1 meeting scheduled within 2 weeks of event',
        'Track via calendar invitation confirmation and CRM meeting log.',
        ActionHelper.clampConfidence(relReport.relationshipProfile.readinessConfidence),
        `Engagement readiness is "${ActionHelper.engagementReadiness(relReport)}" with confidence ${relReport.relationshipProfile.readinessConfidence}.`,
        [...relReport.relationshipProfile.citations.factIds],
        [...relReport.relationshipProfile.citations.sourceIds],
      ));
    }

    // 2. Meeting Completed
    if (invite === 'Invite Immediately' || invite === 'Invite') {
      metrics.push(this.buildMetric(
        'Meeting Completed',
        '1 meeting completed within 4 weeks of event',
        'Track via CRM meeting completion status and follow-up notes.',
        ActionHelper.clampConfidence(
          ActionHelper.mergeConfidence([
            { confidence: relReport.confidenceSummary.overallConfidence },
            { confidence: decisionReport.confidenceSummary.overallConfidence },
          ]),
        ),
        `Relationship confidence: ${relReport.confidenceSummary.overallConfidence}. Decision confidence: ${decisionReport.confidenceSummary.overallConfidence}.`,
        ActionHelper.collectRelationshipFactIds(relReport).slice(0, 3),
        ActionHelper.collectRelationshipSourceIds(relReport).slice(0, 3),
      ));
    }

    // 3. Response Received
    if (invite !== 'Do Not Invite' && invite !== 'Unknown') {
      const responsiveness = relReport.rapport.expectedResponsiveness;
      const target = responsiveness === 'High' ? 'Response within 3 days' : responsiveness === 'Moderate' ? 'Response within 7 days' : 'Response within 14 days';
      metrics.push(this.buildMetric(
        'Response Received',
        target,
        'Track via email/communication response timestamp in CRM.',
        ActionHelper.clampConfidence(relReport.rapport.responsivenessScore),
        `Expected responsiveness is "${responsiveness}" with score ${relReport.rapport.responsivenessScore}.`,
        [...relReport.rapport.citations.factIds],
        [...relReport.rapport.citations.sourceIds],
      ));
    }

    // 4. Proposal Sent
    const topRoles = ActionHelper.topOpportunityRoles(decisionReport);
    if (topRoles.includes('partner') || topRoles.includes('investor')) {
      metrics.push(this.buildMetric(
        'Proposal Sent',
        `1 ${topRoles.find((r) => r === 'partner' || r === 'investor')} proposal sent within 4 weeks of event`,
        'Track via CRM proposal record and document delivery confirmation.',
        ActionHelper.clampConfidence(
          decisionReport.opportunityAnalysis.find((o) => o.role === 'partner' || o.role === 'investor')?.confidence ?? 0,
        ),
        `Opportunity match for ${topRoles.find((r) => r === 'partner' || r === 'investor')} role with confidence ${decisionReport.opportunityAnalysis.find((o) => o.role === 'partner' || o.role === 'investor')?.confidence ?? 0}.`,
        decisionReport.opportunityAnalysis.find((o) => o.role === 'partner' || o.role === 'investor')?.factIds ?? [],
        decisionReport.opportunityAnalysis.find((o) => o.role === 'partner' || o.role === 'investor')?.sourceIds ?? [],
      ));
    }

    // 5. Pilot Started
    if (topRoles.includes('partner')) {
      metrics.push(this.buildMetric(
        'Pilot Started',
        '1 pilot project initiated within 3 months of event',
        'Track via CRM project creation and signed pilot agreement.',
        ActionHelper.clampConfidence(
          (decisionReport.opportunityAnalysis.find((o) => o.role === 'partner')?.confidence ?? 0) * 0.7,
        ),
        `Partner opportunity match confidence is ${decisionReport.opportunityAnalysis.find((o) => o.role === 'partner')?.confidence ?? 0}. Pilot is a realistic 3-month outcome.`,
        decisionReport.opportunityAnalysis.find((o) => o.role === 'partner')?.factIds ?? [],
        decisionReport.opportunityAnalysis.find((o) => o.role === 'partner')?.sourceIds ?? [],
      ));
    }

    // 6. Strategic Partnership
    if (topRoles.includes('partner') || topRoles.includes('investor')) {
      metrics.push(this.buildMetric(
        'Strategic Partnership',
        '1 formal partnership or investment agreement within 6 months',
        'Track via signed agreement in legal/CRM system.',
        ActionHelper.clampConfidence(
          (decisionReport.opportunityAnalysis.find((o) => o.role === 'partner' || o.role === 'investor')?.confidence ?? 0) * 0.5,
        ),
        `Long-term outcome based on ${topRoles.find((r) => r === 'partner' || r === 'investor')} opportunity match. Reduced confidence reflects 6-month timeline uncertainty.`,
        decisionReport.opportunityAnalysis.find((o) => o.role === 'partner' || o.role === 'investor')?.factIds ?? [],
        decisionReport.opportunityAnalysis.find((o) => o.role === 'partner' || o.role === 'investor')?.sourceIds ?? [],
      ));
    }

    // 7. Executive Referral
    const networkingStyle = ActionHelper.networkingStyle(execReport);
    if (networkingStyle === 'Relationship Builder' || networkingStyle === 'Strategic Networker' || networkingStyle === 'Community Builder') {
      metrics.push(this.buildMetric(
        'Executive Referral',
        `1 referral to another executive within ${execReport.contact.company} or industry network`,
        'Track via CRM referral source field and introduction confirmation.',
        ActionHelper.clampConfidence(execReport.persona.networkingStyle.confidence * 0.6),
        `Networking style is "${networkingStyle}" with confidence ${execReport.persona.networkingStyle.confidence}. Referrals are likely for this networking profile.`,
        [...execReport.persona.networkingStyle.factIds],
        [...execReport.persona.networkingStyle.sourceIds],
      ));
    }

    // 8. Event Attendance
    if (invite === 'Invite Immediately' || invite === 'Invite') {
      metrics.push(this.buildMetric(
        'Event Attendance',
        `${execReport.contact.name} attends ${decisionReport.event.name}`,
        'Track via event registration confirmation and on-site check-in.',
        ActionHelper.clampConfidence(decisionReport.inviteRecommendation.confidence),
        `Invite decision is "${invite}" with confidence ${decisionReport.inviteRecommendation.confidence}.`,
        [...decisionReport.inviteRecommendation.factIds],
        [...decisionReport.inviteRecommendation.sourceIds],
      ));
    }

    const confidence = metrics.length > 0
      ? ActionHelper.clampConfidence(ActionHelper.mergeConfidence(metrics.map((m) => ({ confidence: m.confidence }))))
      : 0;
    const citations = ActionHelper.mergeCitations(metrics);

    return {
      metrics,
      confidence,
      reasoning: `Generated ${metrics.length} success metrics based on invite decision "${invite}", opportunity roles [${topRoles.join(', ')}], and networking style "${networkingStyle}".`,
      factIds: citations.factIds,
      sourceIds: citations.sourceIds,
    };
  }

  private buildMetric(
    metric: MetricType,
    target: string,
    measurementMethod: string,
    confidence: number,
    reasoning: string,
    factIds: string[],
    sourceIds: string[],
  ): SuccessMetric {
    return {
      metric,
      target,
      measurementMethod,
      confidence,
      reasoning,
      factIds,
      sourceIds,
    };
  }

  private unknownMetrics(): SuccessMetrics {
    return {
      metrics: [],
      confidence: 0,
      reasoning: ActionHelper.insufficientReasoning(),
      factIds: [],
      sourceIds: [],
    };
  }
}
