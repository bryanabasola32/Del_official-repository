'use client';

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScoreRing } from '@/components/Badges';
import { Brain, Heart, Target, ShieldCheck, FileText, Sparkles, TrendingUp, AlertTriangle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { IntelligenceDetailData } from './types';
import type { ScoreBreakdownData } from './ScoreExplainer';

export function OverviewSection({
  data,
  onExplainScore,
}: {
  data: IntelligenceDetailData;
  onExplainScore: (d: ScoreBreakdownData) => void;
}) {
  const { contact, execReport, relReport, brief } = data;

  const execConfidence = execReport?.confidenceSummary?.overall ?? contact.persona_confidence_pct ?? 0;
  const relConfidence = relReport?.confidenceSummary?.overallConfidence ?? 0;
  const decisionConfidence = brief?.decision?.confidenceSummary?.overallConfidence ?? brief?.decision?.inviteRecommendation?.confidence ?? 0;

  const summary = contact.executive_summary || execReport?.executiveSummary?.summary;
  const keyFindings = execReport?.executiveSummary?.keyFindings ?? [];
  const opportunities = execReport?.opportunities ?? [];
  const risks = execReport?.risks ?? [];

  const topOpportunity = opportunities[0];
  const topRisk = risks.find((r) => r.severity === 'high') || risks[0];

  return (
    <div className="space-y-4">
      {/* Executive Summary */}
      {summary && (
        <Card className="p-5">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <FileText className="h-4 w-4" />
            </div>
            <h2 className="text-sm font-semibold">Executive Summary</h2>
          </div>
          <p className="text-sm leading-relaxed">{summary}</p>
          {keyFindings.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {keyFindings.slice(0, 5).map((finding, i) => (
                <span key={i} className="inline-flex items-center gap-1.5 rounded-lg bg-primary/5 border border-primary/10 px-2.5 py-1 text-xs text-muted-foreground">
                  <Sparkles className="h-3 w-3 text-primary/60" />
                  {finding}
                </span>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Key Opportunity & Key Risk */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {topOpportunity && (
          <Card className="p-4 border-emerald-500/20">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-emerald-500" />
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Key Opportunity</span>
            </div>
            <p className="text-sm font-medium">{topOpportunity.value}</p>
            {topOpportunity.reasoning && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{topOpportunity.reasoning}</p>}
          </Card>
        )}
        {topRisk && (
          <Card className="p-4 border-rose-500/20">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-4 w-4 text-rose-500" />
              <span className="text-xs font-semibold text-rose-600 dark:text-rose-400 uppercase tracking-wider">Key Risk</span>
              <Badge className={cn('text-[10px] ml-auto', topRisk.severity === 'high' ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400')}>{topRisk.severity} risk</Badge>
            </div>
            <p className="text-sm font-medium">{topRisk.value}</p>
            {topRisk.reasoning && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{topRisk.reasoning}</p>}
          </Card>
        )}
      </div>

      {/* Intelligence Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <ScoreCard
          label="Persona Confidence"
          score={execConfidence}
          icon={Brain}
          status={execConfidence >= 75 ? 'High' : execConfidence >= 50 ? 'Medium' : 'Low'}
          explanation="How confident DEL is in the executive's persona profile"
          onHow={() => onExplainScore({
            title: 'Persona Confidence',
            score: execConfidence,
            confidence: execReport?.confidenceSummary?.level === 'high' ? execConfidence : execConfidence,
            dimensions: [
              { label: 'Leadership Style', score: execReport?.confidenceSummary?.leadershipStyle ?? 0 },
              { label: 'Decision Style', score: execReport?.confidenceSummary?.decisionStyle ?? 0 },
              { label: 'Innovation', score: execReport?.confidenceSummary?.innovation ?? 0 },
              { label: 'Communication', score: execReport?.confidenceSummary?.communication ?? 0 },
              { label: 'Strategic Vision', score: execReport?.confidenceSummary?.strategicVision ?? 0 },
              { label: 'Networking', score: execReport?.confidenceSummary?.networking ?? 0 },
            ],
            reasoning: execReport?.confidenceSummary?.reasoning,
            whyItMatters: 'This score reflects how much evidence DEL has gathered and how well it supports the inferred persona attributes. Higher confidence means the persona is more likely to be accurate.',
            formula: execReport?.confidenceSummary?.breakdown ? `Evidence: ${execReport.confidenceSummary.breakdown.evidenceConfidence}% · Verification: ${execReport.confidenceSummary.breakdown.verificationConfidence}% · Source Diversity: ${execReport.confidenceSummary.breakdown.sourceDiversity}% · Trust: ${execReport.confidenceSummary.breakdown.trustScore}%` : undefined,
          })}
        />
        <ScoreCard
          label="Relationship Intelligence"
          score={relConfidence}
          icon={Heart}
          status={relConfidence >= 75 ? 'High' : relConfidence >= 50 ? 'Medium' : 'Low'}
          explanation="Confidence in the relationship assessment"
          onHow={() => onExplainScore({
            title: 'Relationship Intelligence',
            score: relConfidence,
            dimensions: [
              { label: 'Profile Confidence', score: relReport?.confidenceSummary?.profileConfidence ?? 0 },
              { label: 'Strategy Confidence', score: relReport?.confidenceSummary?.strategyConfidence ?? 0 },
              { label: 'Conversation Confidence', score: relReport?.confidenceSummary?.conversationConfidence ?? 0 },
              { label: 'Rapport Confidence', score: relReport?.confidenceSummary?.rapportConfidence ?? 0 },
              { label: 'Alignment Confidence', score: relReport?.confidenceSummary?.alignmentConfidence ?? 0 },
              { label: 'Risk Confidence', score: relReport?.confidenceSummary?.riskConfidence ?? 0 },
              { label: 'Follow-up Confidence', score: relReport?.confidenceSummary?.followUpConfidence ?? 0 },
              { label: 'Scoring Confidence', score: relReport?.confidenceSummary?.scoringConfidence ?? 0 },
            ],
            reasoning: relReport?.confidenceSummary?.reasoning,
            whyItMatters: 'This score reflects how confident DEL is in the relationship assessment, including engagement readiness, rapport, and conversation strategy.',
          })}
        />
        <ScoreCard
          label="Event Fit"
          score={brief?.decision?.eventFit?.overallFitScore ?? 0}
          icon={Target}
          status={(brief?.decision?.eventFit?.overallFitScore ?? 0) >= 75 ? 'Strong' : (brief?.decision?.eventFit?.overallFitScore ?? 0) >= 50 ? 'Moderate' : 'Weak'}
          explanation="How well the executive matches the target event"
          onHow={() => {
            const ef = brief?.decision?.eventFit;
            if (!ef) return;
            onExplainScore({
              title: 'Event Fit',
              score: ef.overallFitScore,
              confidence: ef.confidence,
              formula: ef.formula,
              dimensions: (ef.dimensions || []).map((d) => ({
                label: d.dimension.replace(/_/g, ' '),
                score: d.score,
                reasoning: d.reasoning,
              })),
              reasoning: ef.reasoning,
              whyItMatters: 'This score measures how well the executive aligns with the event\'s themes, target audience, and strategic goals. A higher fit means a better match.',
            });
          }}
        />
        <ScoreCard
          label="Decision Confidence"
          score={decisionConfidence}
          icon={ShieldCheck}
          status={decisionConfidence >= 75 ? 'High' : decisionConfidence >= 50 ? 'Medium' : 'Low'}
          explanation="Confidence in the invite recommendation"
          onHow={() => onExplainScore({
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
            whyItMatters: 'This is DEL\'s overall confidence in the invite recommendation, factoring in evidence quality, event fit, relationship strength, and risk.',
          })}
        />
      </div>
    </div>
  );
}

function ScoreCard({ label, score, icon: Icon, status, explanation, onHow }: {
  label: string;
  score: number;
  icon: React.ElementType;
  status: string;
  explanation: string;
  onHow: () => void;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="flex items-center gap-3">
        <ScoreRing score={score} size={44} />
        <div className="min-w-0">
          <div className="text-lg font-bold">{score}%</div>
          <div className="text-xs text-muted-foreground">{status}</div>
        </div>
      </div>
      <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{explanation}</p>
      <button
        onClick={onHow}
        className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline"
      >
        <Info className="h-3 w-3" />
        How DEL calculated this
      </button>
    </Card>
  );
}
