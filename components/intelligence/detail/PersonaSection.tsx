'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  ChevronDown, ChevronRight, Crown, Gauge, Brain, Lightbulb, Users, Award,
  ShieldCheck, AlertTriangle, ExternalLink, FileText, Clock, Sparkles, Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { IntelligenceDetailData, FactFilter } from './types';
import type { ScoreBreakdownData } from './ScoreExplainer';
import type { PersonaFact, Source } from '@/lib/types';

export function PersonaSection({
  data,
  onExplainScore,
}: {
  data: IntelligenceDetailData;
  onExplainScore: (d: ScoreBreakdownData) => void;
}) {
  const { contact, execReport, facts, sources } = data;
  const [showFullPersona, setShowFullPersona] = useState(false);
  const [factFilter, setFactFilter] = useState<FactFilter>('all');
  const [showAllFacts, setShowAllFacts] = useState(false);
  const [expandedFact, setExpandedFact] = useState<string | null>(null);

  const persona = execReport?.persona;

  const personaCards = [
    { icon: Crown, label: 'Leadership Style', value: persona?.leadershipStyle?.value ?? contact.decision_style, confidence: persona?.leadershipStyle?.confidence, reasoning: persona?.leadershipStyle?.reasoning },
    { icon: Gauge, label: 'Technology Readiness', value: persona?.technologyInterest?.value ?? contact.tech_readiness_level, confidence: persona?.technologyInterest?.confidence, reasoning: persona?.technologyInterest?.reasoning },
    { icon: Brain, label: 'Decision Style', value: persona?.decisionStyle?.value ?? contact.decision_style, confidence: persona?.decisionStyle?.confidence, reasoning: persona?.decisionStyle?.reasoning },
    { icon: Lightbulb, label: 'Innovation Profile', value: persona?.innovationOrientation?.value, confidence: persona?.innovationOrientation?.confidence, reasoning: persona?.innovationOrientation?.reasoning },
    { icon: Users, label: 'Networking Potential', value: persona?.networkingStyle?.value, confidence: persona?.networkingStyle?.confidence, reasoning: persona?.networkingStyle?.reasoning },
    { icon: Award, label: 'Executive Archetype', value: execReport?.archetypeClassification?.archetype, confidence: execReport?.archetypeClassification?.confidence, reasoning: execReport?.archetypeClassification?.reasoning },
  ];

  const filteredFacts = facts.filter((f) => {
    if (factFilter === 'all') return true;
    return f.confidence_level === factFilter;
  });

  const visibleFacts = showAllFacts ? filteredFacts : filteredFacts.slice(0, 6);

  return (
    <div className="space-y-4">
      {/* Persona Cards */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Sparkles className="h-4 w-4" />
            </div>
            <h2 className="text-sm font-semibold">Executive Persona</h2>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setShowFullPersona(!showFullPersona)}>
            {showFullPersona ? 'Hide Full Persona' : 'View Full Persona'}
            {showFullPersona ? <ChevronDown className="h-4 w-4 ml-1.5" /> : <ChevronRight className="h-4 w-4 ml-1.5" />}
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {personaCards.map((card) => (
            <PersonaMetricCard key={card.label} {...card} onHow={() => card.confidence != null && onExplainScore({
              title: card.label,
              score: card.confidence,
              dimensions: [{ label: card.label, score: card.confidence }],
              reasoning: card.reasoning,
              whyItMatters: `This attribute was inferred from the executive's evidence base. The confidence score reflects how well the evidence supports this inference.`,
            })} />
          ))}
        </div>

        {/* Full Persona — progressive disclosure */}
        {showFullPersona && (
          <div className="mt-4 pt-4 border-t border-border space-y-4 animate-slide-up">
            {/* Additional persona attributes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <PersonaDetail label="Communication Style" value={persona?.communicationStyle?.value} confidence={persona?.communicationStyle?.confidence} reasoning={persona?.communicationStyle?.reasoning} />
              <PersonaDetail label="Risk Appetite" value={persona?.riskAppetite?.value} confidence={persona?.riskAppetite?.confidence} reasoning={persona?.riskAppetite?.reasoning} />
              <PersonaDetail label="Influence Level" value={persona?.influenceLevel?.value} confidence={persona?.influenceLevel?.confidence} reasoning={persona?.influenceLevel?.reasoning} />
              <PersonaDetail label="Negotiation Style" value={persona?.negotiationStyle?.value} confidence={persona?.negotiationStyle?.confidence} reasoning={persona?.negotiationStyle?.reasoning} />
            </div>

            {/* Strategic Priorities */}
            {persona?.strategicPriorities && persona.strategicPriorities.length > 0 && (
              <div>
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Strategic Priorities</div>
                <div className="flex flex-wrap gap-2">
                  {persona.strategicPriorities.map((p, i) => (
                    <Badge key={i} variant="outline" className="text-xs">{p.value}</Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Business Interests */}
            {persona?.businessInterests && persona.businessInterests.length > 0 && (
              <div>
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Business Interests</div>
                <div className="flex flex-wrap gap-2">
                  {persona.businessInterests.map((b, i) => (
                    <Badge key={i} variant="outline" className="text-xs">{b.value}</Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Tech readiness explanation */}
            {contact.tech_readiness_explanation && (
              <div className="rounded-lg bg-muted/40 border border-border p-3">
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Tech Readiness Explanation</div>
                <p className="text-sm leading-relaxed">{contact.tech_readiness_explanation}</p>
              </div>
            )}

            {/* Client-provided persona */}
            {contact.persona_provided && contact.persona_provided.trim() && (
              <div className="rounded-lg bg-muted/40 border border-border p-3">
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Client-Provided Persona</div>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">{contact.persona_provided}</p>
              </div>
            )}

            {/* Reasoning Chains */}
            {execReport?.reasoning && execReport.reasoning.length > 0 && (
              <div>
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Reasoning Chains</div>
                <div className="space-y-2">
                  {execReport.reasoning.slice(0, 6).map((chain, i) => (
                    <div key={i} className="rounded-lg border border-border p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-[10px] capitalize">{chain.attribute.replace(/_/g, ' ')}</Badge>
                        <span className="text-sm font-medium">{chain.value}</span>
                        <Badge variant="outline" className="text-[10px] ml-auto">{chain.confidence}% confidence</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{chain.reasoning}</p>
                      {chain.reasoningSteps && chain.reasoningSteps.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {chain.reasoningSteps.slice(0, 3).map((step, j) => (
                            <div key={j} className="text-xs text-muted-foreground/80 pl-3 border-l border-border">
                              <span className="font-medium">Observed:</span> {step.observation}
                              <br />
                              <span className="font-medium">Inferred:</span> {step.inference}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Extracted Facts */}
      {facts.length > 0 && (
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <FileText className="h-4 w-4" />
              </div>
              <h2 className="text-sm font-semibold">Extracted Facts</h2>
              <Badge variant="outline" className="text-[10px]">{facts.length}</Badge>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setShowAllFacts(!showAllFacts)}>
              {showAllFacts ? 'Show Less' : 'View All Facts'}
              {showAllFacts ? <ChevronDown className="h-4 w-4 ml-1.5" /> : <ChevronRight className="h-4 w-4 ml-1.5" />}
            </Button>
          </div>

          {/* Fact filters */}
          <div className="flex gap-2 mb-3">
            {(['all', 'verified', 'probable', 'unverified'] as FactFilter[]).map((filter) => (
              <button
                key={filter}
                onClick={() => setFactFilter(filter)}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-colors',
                  factFilter === filter
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/70'
                )}
              >
                {filter}
              </button>
            ))}
          </div>

          <div className="space-y-2">
            {visibleFacts.map((fact) => (
              <FactDetail
                key={fact.id}
                fact={fact}
                factSources={sources[fact.id] || []}
                expanded={expandedFact === fact.id}
                onToggle={() => setExpandedFact(expandedFact === fact.id ? null : fact.id)}
              />
            ))}
          </div>
          {!showAllFacts && filteredFacts.length > 6 && (
            <p className="text-xs text-muted-foreground text-center mt-3">Showing 6 of {filteredFacts.length} facts</p>
          )}
        </Card>
      )}

      {/* Risk Assessment */}
      {execReport?.risks && execReport.risks.length > 0 && (
        <Card className="p-5">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-500/10 text-rose-500">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <h2 className="text-sm font-semibold">Risk Assessment</h2>
          </div>
          <div className="space-y-2">
            {execReport.risks.map((risk, i) => (
              <div key={i} className="rounded-lg border border-border p-3">
                <div className="flex items-start justify-between gap-3 mb-1">
                  <div className="flex items-center gap-2">
                    <Badge className={cn(
                      'text-[10px]',
                      risk.severity === 'high' ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400' :
                      risk.severity === 'medium' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                      'bg-slate-100 text-slate-600 dark:bg-slate-800/50 dark:text-slate-400'
                    )}>{risk.severity} risk</Badge>
                    <span className="text-sm font-medium capitalize">{risk.type.replace(/_/g, ' ')}</span>
                  </div>
                  <Badge variant="outline" className="text-[10px] shrink-0">{risk.confidence}% confidence</Badge>
                </div>
                <p className="text-sm">{risk.value}</p>
                {risk.reasoning && <p className="text-xs text-muted-foreground mt-1 italic">{risk.reasoning}</p>}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Career Timeline */}
      {execReport?.timeline && execReport.timeline.length > 0 && (
        <Card className="p-5">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 text-blue-500">
              <Clock className="h-4 w-4" />
            </div>
            <h2 className="text-sm font-semibold">Career Timeline</h2>
          </div>
          <div className="relative pl-6">
            <div className="absolute left-2 top-0 bottom-0 w-0.5 bg-border" />
            {execReport.timeline.slice(0, 10).map((entry, i) => (
              <div key={i} className="relative pb-4 last:pb-0">
                <div className={cn(
                  'absolute -left-4 top-1 flex h-3 w-3 items-center justify-center rounded-full border-2 border-background',
                  entry.type === 'promotion' || entry.type === 'award' ? 'bg-emerald-500' :
                  entry.type === 'career' ? 'bg-primary' :
                  entry.type === 'speaking' ? 'bg-amber-500' :
                  'bg-muted-foreground/40'
                )} />
                <div className="ml-2">
                  <div className="flex items-center gap-2 mb-0.5">
                    <Badge variant="outline" className="text-[10px] capitalize">{entry.type.replace(/_/g, ' ')}</Badge>
                    {entry.date && <span className="text-xs text-muted-foreground">{new Date(entry.date).toLocaleDateString()}</span>}
                  </div>
                  <p className="text-sm font-medium">{entry.title}</p>
                  {entry.description && <p className="text-xs text-muted-foreground mt-0.5">{entry.description}</p>}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function PersonaMetricCard({ icon: Icon, label, value, confidence, reasoning, onHow }: {
  icon: React.ElementType;
  label: string;
  value: string | null | undefined;
  confidence?: number;
  reasoning?: string;
  onHow: () => void;
}) {
  return (
    <div className="rounded-xl border border-border p-4 hover:border-primary/20 transition-colors">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      {value ? (
        <>
          <p className="text-sm font-medium">{value}</p>
          {confidence != null && (
            <div className="flex items-center gap-2 mt-2">
              <div className="h-1.5 w-20 rounded-full bg-muted overflow-hidden">
                <div
                  className={cn('h-full rounded-full', confidence >= 75 ? 'bg-emerald-500' : confidence >= 50 ? 'bg-amber-500' : 'bg-rose-500')}
                  style={{ width: `${confidence}%` }}
                />
              </div>
              <span className="text-[10px] text-muted-foreground">{confidence}%</span>
            </div>
          )}
          {confidence != null && (
            <button onClick={onHow} className="mt-1.5 inline-flex items-center gap-1 text-[10px] text-primary hover:underline">
              <Info className="h-2.5 w-2.5" />
              How?
            </button>
          )}
        </>
      ) : (
        <p className="text-sm text-muted-foreground/50">Not yet generated</p>
      )}
    </div>
  );
}

function PersonaDetail({ label, value, confidence, reasoning }: {
  label: string;
  value?: string;
  confidence?: number;
  reasoning?: string;
}) {
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">{label}</div>
      {value ? (
        <>
          <p className="text-sm font-medium">{value}</p>
          {confidence != null && <span className="text-[10px] text-muted-foreground">{confidence}% confidence</span>}
          {reasoning && <p className="text-xs text-muted-foreground mt-1">{reasoning}</p>}
        </>
      ) : (
        <p className="text-sm text-muted-foreground/50">Not available</p>
      )}
    </div>
  );
}

function FactDetail({ fact, factSources, expanded, onToggle }: {
  fact: PersonaFact;
  factSources: Source[];
  expanded: boolean;
  onToggle: () => void;
}) {
  const typeLabels: Record<string, string> = {
    pain_point: 'Pain Point',
    initiative: 'Initiative',
    tech_readiness: 'Tech Readiness',
    professional_interest: 'Interest',
    decision_making_role: 'Role',
    industry: 'Industry',
    summary: 'Summary',
  };
  const confidenceColors: Record<string, string> = {
    verified: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    probable: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    unverified: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    insufficient_data: 'bg-slate-100 text-slate-500 dark:bg-slate-800/50 dark:text-slate-400',
  };

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-start gap-2 p-3 hover:bg-muted/20 transition-colors text-left"
      >
        <Badge className={cn('shrink-0 text-[10px] px-1.5 py-0', confidenceColors[fact.confidence_level] || 'bg-slate-100 text-slate-500')}>
          {typeLabels[fact.field_type] || fact.field_type}
        </Badge>
        <div className="flex-1 min-w-0">
          <p className="text-sm leading-relaxed">{fact.value}</p>
          {fact.reasoning_note && !expanded && <p className="text-xs text-muted-foreground/70 mt-0.5 truncate">{fact.reasoning_note}</p>}
        </div>
        {expanded ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />}
      </button>
      {expanded && (
        <div className="px-3 pb-3 space-y-2 animate-slide-up">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Confidence:</span>
            <Badge className={cn('text-[10px]', confidenceColors[fact.confidence_level] || 'bg-slate-100 text-slate-500')}>
              {fact.confidence_level.replace(/_/g, ' ')}
            </Badge>
          </div>
          {fact.reasoning_note && (
            <div>
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Why DEL believes this</span>
              <p className="text-xs text-muted-foreground mt-0.5">{fact.reasoning_note}</p>
            </div>
          )}
          {factSources.length > 0 && (
            <div>
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Supporting Evidence</span>
              <div className="space-y-1 mt-1">
                {factSources.map((src) => (
                  <div key={src.id} className="flex items-center gap-2 rounded border border-border p-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium truncate">{src.source_name || src.title || 'Untitled'}</div>
                      {src.snippet && <div className="text-[10px] text-muted-foreground truncate">{src.snippet}</div>}
                    </div>
                    {src.url && (
                      <a href={src.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline shrink-0">
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}


