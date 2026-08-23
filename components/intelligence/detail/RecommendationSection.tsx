'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Target, CheckCircle2, XCircle, AlertTriangle, Clock, Eye,
  ChevronDown, ChevronRight, Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { IntelligenceDetailData } from './types';
import type { ScoreBreakdownData } from './ScoreExplainer';

export function RecommendationSection({
  data,
  onExplainScore,
}: {
  data: IntelligenceDetailData;
  onExplainScore: (d: ScoreBreakdownData) => void;
}) {
  const { brief, relReport, topRec } = data;
  const [showReasoning, setShowReasoning] = useState(false);
  const [showBlocking, setShowBlocking] = useState(false);
  const [showAlternative, setShowAlternative] = useState(false);

  const decision = brief?.decision?.inviteRecommendation;
  if (!decision) return null;

  const decisionLabel = decision.decision || 'Needs More Research';
  const decisionConfidence = decision.confidence ?? 0;
  const isInvite = decisionLabel === 'Invite' || decisionLabel === 'Invite Immediately';
  const isDoNotInvite = decisionLabel === 'Do Not Invite';
  const isInviteLater = decisionLabel === 'Invite Later';
  const isObserve = decisionLabel === 'Observe';

  const decisionColor = isInvite ? 'bg-emerald-500 text-white' : isDoNotInvite ? 'bg-rose-500 text-white' : isInviteLater ? 'bg-amber-500 text-white' : isObserve ? 'bg-blue-500 text-white' : 'bg-slate-500 text-white';
  const DecisionIcon = isInvite ? CheckCircle2 : isDoNotInvite ? XCircle : isInviteLater ? Clock : isObserve ? Eye : AlertTriangle;

  const eventFit = brief?.decision?.eventFit;
  const reasoning = brief?.decision?.reasoning;
  const benefits = brief?.decision?.strategicBenefits || [];
  const risks = brief?.decision?.decisionRisks || [];
  const alternatives = brief?.decision?.recommendations || [];

  return (
    <div className="space-y-4">
      {/* Primary Recommendation */}
      <Card className={cn('p-5 border-2', isInvite ? 'border-emerald-500/30' : isDoNotInvite ? 'border-rose-500/30' : 'border-amber-500/30')}>
        <div className="flex items-center gap-2.5 mb-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Target className="h-4 w-4" />
          </div>
          <h2 className="text-sm font-semibold">Strategic Recommendation</h2>
        </div>

        <div className="flex items-center gap-4 mb-4">
          <div className={cn('flex h-14 w-14 items-center justify-center rounded-2xl shrink-0', decisionColor)}>
            <DecisionIcon className="h-7 w-7" />
          </div>
          <div>
            <div className="text-xl font-bold">{decisionLabel}</div>
            <div className="flex items-center gap-2 mt-1">
              <div className="h-1.5 w-20 rounded-full bg-muted overflow-hidden">
                <div
                  className={cn('h-full rounded-full', decisionConfidence >= 75 ? 'bg-emerald-500' : decisionConfidence >= 50 ? 'bg-amber-500' : 'bg-rose-500')}
                  style={{ width: `${decisionConfidence}%` }}
                />
              </div>
              <span className="text-xs font-semibold">{decisionConfidence}% confidence</span>
            </div>
          </div>
        </div>

        {/* Decision confidence + event fit + relationship score */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          <MetricTile label="Decision Confidence" value={`${decisionConfidence}%`} onHow={() => onExplainScore({
            title: 'Decision Confidence',
            score: decisionConfidence,
            dimensions: [
              { label: 'Event Fit Confidence', score: brief?.decision?.confidenceSummary?.eventFitConfidence ?? 0 },
              { label: 'Relationship Score Confidence', score: brief?.decision?.confidenceSummary?.relationshipScoreConfidence ?? 0 },
              { label: 'Executive Confidence', score: brief?.decision?.confidenceSummary?.executiveConfidence ?? 0 },
              { label: 'Evidence Confidence', score: brief?.decision?.confidenceSummary?.evidenceConfidence ?? 0 },
              { label: 'Opportunity Match Confidence', score: brief?.decision?.confidenceSummary?.opportunityMatchConfidence ?? 0 },
              { label: 'Risk Penalty', score: brief?.decision?.confidenceSummary?.riskPenalty ?? 0 },
            ],
            reasoning: brief?.decision?.confidenceSummary?.reasoning,
            whyItMatters: 'This is DEL\'s overall confidence in the invite recommendation.',
          })} />
          {eventFit && (
            <MetricTile label="Event Fit" value={`${eventFit.overallFitScore}%`} onHow={() => onExplainScore({
              title: 'Event Fit',
              score: eventFit.overallFitScore,
              confidence: eventFit.confidence,
              formula: eventFit.formula,
              dimensions: (eventFit.dimensions || []).map((d) => ({
                label: d.dimension.replace(/_/g, ' '),
                score: d.score,
                reasoning: d.reasoning,
              })),
              reasoning: eventFit.reasoning,
              whyItMatters: 'How well the executive aligns with the event\'s themes, audience, and goals.',
            })} />
          )}
          {relReport && (
            <MetricTile label="Relationship Score" value={`${relReport.scores?.overallScore ?? 0}%`} onHow={() => onExplainScore({
              title: 'Relationship Score',
              score: relReport.scores?.overallScore ?? 0,
              formula: relReport.scores?.formula,
              dimensions: [
                { label: 'Relationship Readiness', score: relReport.scores?.relationshipReadiness ?? 0, reasoning: relReport.scores?.readinessReasoning },
                { label: 'Networking Value', score: relReport.scores?.networkingValue ?? 0, reasoning: relReport.scores?.networkingReasoning },
                { label: 'Conversation Quality', score: relReport.scores?.conversationQuality ?? 0, reasoning: relReport.scores?.conversationReasoning },
                { label: 'Expected Engagement', score: relReport.scores?.expectedEngagement ?? 0, reasoning: relReport.scores?.engagementReasoning },
                { label: 'Follow-up Potential', score: relReport.scores?.followUpPotential ?? 0, reasoning: relReport.scores?.followUpReasoning },
              ],
              reasoning: relReport.scores?.overallReasoning,
              whyItMatters: 'Overall relationship strength, factoring in readiness, networking value, conversation quality, and engagement potential.',
            })} />
          )}
        </div>

        {/* Primary reason */}
        {decision.reasoning && (
          <div className="mb-4">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Primary Reason</div>
            <p className="text-sm leading-relaxed">{decision.reasoning}</p>
          </div>
        )}

        {/* Reasoning — expandable */}
        {reasoning?.summary && (
          <div className="mb-4">
            <button
              onClick={() => setShowReasoning(!showReasoning)}
              className="flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
            >
              {showReasoning ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              Why DEL recommends this
            </button>
            {showReasoning && (
              <div className="mt-2 space-y-2 animate-slide-up">
                <p className="text-sm leading-relaxed">{reasoning.summary}</p>
                {reasoning.chain && reasoning.chain.length > 0 && (
                  <div className="space-y-2">
                    {reasoning.chain.map((step, i) => (
                      <div key={i} className="rounded-lg border border-border p-3">
                        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Step {i + 1}</div>
                        <p className="text-sm"><span className="font-medium">Observation:</span> {step.observation}</p>
                        <p className="text-sm mt-1"><span className="font-medium">Analysis:</span> {step.analysis}</p>
                        <p className="text-sm mt-1"><span className="font-medium">Decision:</span> {step.decision}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Conditions */}
        {decision.conditions.length > 0 && (
          <div className="mb-4">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Conditions</div>
            <ul className="space-y-1">
              {decision.conditions.slice(0, 5).map((c, i) => (
                <li key={i} className="text-sm flex items-start gap-2">
                  <Info className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                  {c}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Supporting Factors */}
        {benefits.length > 0 && (
          <div className="mb-4">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
              Supporting Factors
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {benefits.map((benefit, i) => (
                <SupportingFactorCard key={i} benefit={benefit.benefit} alignment={benefit.alignment} confidence={benefit.confidence} reasoning={benefit.reasoning} />
              ))}
            </div>
          </div>
        )}

        {/* Blocking Factors — expandable */}
        {risks.length > 0 && (
          <div className="mb-4">
            <button
              onClick={() => setShowBlocking(!showBlocking)}
              className="flex items-center gap-1.5 text-sm font-medium text-rose-500 hover:underline"
            >
              {showBlocking ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              Blocking Factors ({risks.length})
            </button>
            {showBlocking && (
              <div className="mt-2 space-y-2 animate-slide-up">
                {risks.map((risk, i) => (
                  <div key={i} className="rounded-lg border border-border p-3">
                    <div className="flex items-start justify-between gap-3 mb-1">
                      <Badge className={cn(
                        'text-[10px]',
                        risk.severity === 'high' ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400' :
                        risk.severity === 'medium' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                        'bg-slate-100 text-slate-600 dark:bg-slate-800/50 dark:text-slate-400'
                      )}>{risk.severity} risk</Badge>
                      <span className="text-xs text-muted-foreground capitalize">{risk.type.replace(/_/g, ' ')}</span>
                    </div>
                    <p className="text-sm">{risk.description}</p>
                    {risk.reasoning && <p className="text-xs text-muted-foreground mt-1 italic">{risk.reasoning}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Alternative Recommendation — expandable */}
        {alternatives.length > 0 && (
          <div className="mb-4">
            <button
              onClick={() => setShowAlternative(!showAlternative)}
              className="flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
            >
              {showAlternative ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              Alternative Recommendation
            </button>
            {showAlternative && (
              <div className="mt-2 space-y-2 animate-slide-up">
                {alternatives.map((alt, i) => (
                  <div key={i} className="rounded-lg border border-border p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-[10px] capitalize">{alt.priority}</Badge>
                      <span className="text-sm font-medium">{alt.action}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{alt.reasoning}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Approve / Reject */}
        {topRec && topRec.status === 'pending' && (
          <div className="flex gap-2 pt-2 border-t border-border">
            <Button size="sm" onClick={() => data.onApprove(topRec.id)}>
              <CheckCircle2 className="h-4 w-4 mr-1.5" />
              Approve
            </Button>
            <Button size="sm" variant="outline" onClick={() => data.onReject(topRec.id)}>
              <XCircle className="h-4 w-4 mr-1.5" />
              Reject
            </Button>
          </div>
        )}
      </Card>

      {/* Event Recommendation */}
      {topRec && topRec.event && (
        <Card className="p-5">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Target className="h-4 w-4" />
            </div>
            <h2 className="text-sm font-semibold">Event Recommendation</h2>
          </div>
          <div className="rounded-lg border border-border p-4">
            <div className="flex items-start gap-4">
              <ScoreRingCompact score={topRec.suitability_score} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-base font-semibold">{topRec.event.event_name}</p>
                  <Badge className={cn(
                    topRec.priority === 'high' ? 'bg-rose-100 text-rose-700 border-rose-200' :
                    topRec.priority === 'medium' ? 'bg-amber-100 text-amber-700 border-amber-200' :
                    'bg-slate-100 text-slate-600 border-slate-200'
                  )}>{topRec.priority} priority</Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-1">{topRec.reason}</p>
              </div>
            </div>
            {topRec.status === 'approved' && (
              <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 mt-3">
                <CheckCircle2 className="h-3 w-3 mr-1" /> Approved
              </Badge>
            )}
          </div>
        </Card>
      )}

      {/* Relationship Intelligence */}
      {relReport && (
        <Card className="p-5">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500">
              <CheckCircle2 className="h-4 w-4" />
            </div>
            <h2 className="text-sm font-semibold">Relationship Intelligence</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            <InfoTile label="Relationship Stage" value={relReport.relationshipProfile.stage.replace(/_/g, ' ')} capitalize />
            <InfoTile label="Relationship Confidence" value={`${relReport.confidenceSummary.overallConfidence}%`} />
            <InfoTile label="Networking Potential" value={relReport.relationshipProfile.networkingPotential} capitalize />
            <InfoTile label="Engagement Readiness" value={relReport.relationshipProfile.engagementReadiness.replace(/_/g, ' ')} capitalize />
          </div>

          {relReport.conversationStarters && relReport.conversationStarters.length > 0 && (
            <div className="mb-4">
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Conversation Starters</div>
              <div className="space-y-2">
                {relReport.conversationStarters.slice(0, 5).map((cs, i) => (
                  <div key={i} className="rounded-lg border border-border p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 text-[10px]">{cs.category.replace(/_/g, ' ')}</Badge>
                      <span className="text-xs text-muted-foreground">{cs.topic}</span>
                    </div>
                    <p className="text-sm">{cs.suggestedQuestion}</p>
                    {cs.reasoning && <p className="text-xs text-muted-foreground mt-1 italic">{cs.reasoning}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {relReport.risks && relReport.risks.length > 0 && (
            <div>
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5" />
                Relationship Risks
              </div>
              <div className="space-y-2">
                {relReport.risks.slice(0, 4).map((risk, i) => (
                  <div key={i} className="rounded-lg border border-border p-3">
                    <div className="flex items-start justify-between gap-3 mb-1">
                      <Badge className={cn(
                        'text-[10px]',
                        risk.severity === 'high' ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400' :
                        risk.severity === 'medium' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                        'bg-slate-100 text-slate-600 dark:bg-slate-800/50 dark:text-slate-400'
                      )}>{risk.severity} risk</Badge>
                      <span className="text-xs text-muted-foreground capitalize">{risk.type.replace(/_/g, ' ')}</span>
                    </div>
                    <p className="text-sm">{risk.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

function MetricTile({ label, value, onHow }: { label: string; value: string; onHow: () => void }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">{label}</div>
      <div className="flex items-center justify-between">
        <span className="text-lg font-bold">{value}</span>
        <button onClick={onHow} className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline">
          <Info className="h-3 w-3" />
          How?
        </button>
      </div>
    </div>
  );
}

function SupportingFactorCard({ benefit, alignment, confidence, reasoning }: {
  benefit: string;
  alignment?: string;
  confidence?: number;
  reasoning?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="rounded-lg border border-border p-3">
      <p className="text-sm font-medium">{benefit}</p>
      {alignment && <p className="text-xs text-muted-foreground mt-1">{alignment}</p>}
      <div className="flex items-center gap-2 mt-2">
        {confidence != null && <Badge variant="outline" className="text-[10px]">{confidence}% confidence</Badge>}
        {reasoning && (
          <button onClick={() => setExpanded(!expanded)} className="text-[10px] text-primary hover:underline">
            {expanded ? 'Hide' : 'View'} Reasoning
          </button>
        )}
      </div>
      {expanded && reasoning && <p className="text-xs text-muted-foreground mt-2 animate-slide-up">{reasoning}</p>}
    </div>
  );
}

function InfoTile({ label, value, capitalize }: { label: string; value: string; capitalize?: boolean }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">{label}</div>
      <p className={cn('text-sm font-medium', capitalize && 'capitalize')}>{value}</p>
    </div>
  );
}

function ScoreRingCompact({ score }: { score: number }) {
  const color = score >= 85 ? '#10b981' : score >= 70 ? '#3b82f6' : score >= 50 ? '#f59e0b' : '#94a3b8';
  return (
    <div className="relative flex h-14 w-14 items-center justify-center shrink-0">
      <svg width={56} height={56} className="-rotate-90">
        <circle cx={28} cy={28} r={24} fill="none" stroke="currentColor" strokeWidth={3} className="text-muted/30" />
        <circle cx={28} cy={28} r={24} fill="none" stroke={color} strokeWidth={3} strokeDasharray={150.8} strokeDashoffset={150.8 - (score / 100) * 150.8} strokeLinecap="round" />
      </svg>
      <span className="absolute text-sm font-bold" style={{ color }}>{score}</span>
    </div>
  );
}
