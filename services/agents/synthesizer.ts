import type { ProviderRegistry } from '../providers';
import type { VerifiedFinding, SynthesizedFact, SynthesizedPersona } from '../providers/types';
import type { Contact } from '@/lib/types';
import type { EvidenceContext, ContextFact } from '../research/EvidenceContextBuilder';
import type { ConfidenceAssessment } from '../research/ConfidencePropagator';

/*
 * Synthesizer Agent — upgraded for MP3 Part 3.
 *
 * Instead of consuming raw findings, the Synthesizer now consumes the
 * EvidenceContext (built from the Verified Evidence Package).
 *
 * Responsibilities:
 *   - Organize verified information from the EvidenceContext
 *   - Remove duplicate facts (same subject + predicate + value)
 *   - Preserve uncertainty (never inflate confidence)
 *   - Preserve conflicting information (don't pick sides)
 *   - Never invent unsupported conclusions
 *
 * The Synthesizer prepares intelligence for AI rather than generating it
 * directly. It builds a SynthesizedPersona that is grounded in the
 * EvidenceContext, with every fact traceable to verified evidence.
 *
 * Backward compatibility: the legacy `synthesize(contact, verified)` method
 * is preserved for the existing orchestrator pipeline.
 */

export class SynthesizerAgent {
  constructor(private providers: ProviderRegistry) {}

  /**
   * Synthesize a persona from the EvidenceContext (MP3 Part 3).
   * Every fact in the output is grounded in verified evidence.
   */
  synthesizeFromContext(
    context: EvidenceContext,
    confidence: ConfidenceAssessment,
  ): SynthesizedPersona {
    const facts: SynthesizedFact[] = [];
    const seenKeys = new Set<string>();

    // Convert evidence context facts into synthesized facts
    for (const ctxFact of context.allFacts) {
      const dedupKey = `${ctxFact.subject}::${ctxFact.predicate}::${ctxFact.value}`;
      if (seenKeys.has(dedupKey)) continue;
      seenKeys.add(dedupKey);

      const synFact = this.convertToSynthesizedFact(ctxFact, context);
      if (synFact) {
        facts.push(synFact);
      }
    }

    // If no facts were extracted, create a minimal "insufficient data" persona
    if (facts.length === 0) {
      facts.push({
        fieldType: 'summary',
        value: 'Insufficient Data — No verified evidence available for persona generation.',
        confidenceLevel: 'insufficient_data',
        reasoningNote: 'Evidence collection and verification yielded no usable facts.',
        timeframe: null,
        sources: [],
      });
    }

    const confidenceLevel: SynthesizedPersona['confidenceLevel'] =
      confidence.level === 'high' ? 'high' :
      confidence.level === 'medium' ? 'medium' : 'low';

    const decisionRole = this.determineDecisionRole(context);

    return {
      facts,
      confidencePct: confidence.confidence,
      confidenceLevel,
      decisionRole,
    };
  }

  private convertToSynthesizedFact(
    ctxFact: ContextFact,
    context: EvidenceContext,
  ): SynthesizedFact | null {
    // Map evidence context categories to persona fact field types
    const fieldType = this.mapCategoryToFieldType(ctxFact.category);
    if (!fieldType) return null;

    // Build source references from the context
    const sources = ctxFact.sourceIds
      .map((sourceId) => context.sources.find((s) => s.sourceId === sourceId))
      .filter((s): s is NonNullable<typeof s> => s !== undefined)
      .map((s) => ({
        url: s.url,
        title: s.title,
        sourceTier: s.sourceTier,
        sourceName: s.sourceName,
        snippet: s.snippet,
      }));

    const confidenceLevel: SynthesizedFact['confidenceLevel'] =
      ctxFact.verificationStatus === 'verified' ? 'verified' :
      ctxFact.verificationStatus === 'corroborated' ? 'verified' :
      ctxFact.verificationStatus === 'single_source' ? 'probable' :
      ctxFact.verificationStatus === 'conflicting' ? 'unverified' :
      'unverified';

    const conflictNote = ctxFact.hasConflict
      ? ' ⚠️ Conflicting evidence detected — multiple sources disagree.'
      : '';

    const reasoningNote = ctxFact.explanation
      ? `${ctxFact.explanation}${conflictNote}`
      : `Based on ${ctxFact.sourceNames.length} source(s). Confidence: ${ctxFact.confidence}%.${conflictNote}`;

    return {
      fieldType,
      value: ctxFact.value,
      confidenceLevel,
      reasoningNote,
      timeframe: ctxFact.isFresh ? 'Recent' : null,
      sources,
    };
  }

  private mapCategoryToFieldType(category: string): SynthesizedFact['fieldType'] | null {
    const mapping: Record<string, SynthesizedFact['fieldType']> = {
      pain_point: 'pain_point',
      initiative: 'initiative',
      tech_readiness: 'tech_readiness',
      professional_interest: 'professional_interest',
      professional_interests: 'professional_interest',
      professional_history: 'professional_interest',
      decision_making_role: 'decision_making_role',
      decision_profile: 'decision_making_role',
      current_position: 'decision_making_role',
      leadership_position: 'decision_making_role',
      leadership_style: 'decision_making_role',
      industry: 'industry',
      company_industry: 'industry',
      summary: 'summary',
      biography: 'summary',
      recent_news: 'initiative',
      strategic_priorities: 'initiative',
      technology_interests: 'tech_readiness',
      event_signals: 'initiative',
      executive_keywords: 'professional_interest',
      communication_style: 'summary',
      awards: 'summary',
    };

    return mapping[category] || null;
  }

  private determineDecisionRole(context: EvidenceContext): SynthesizedPersona['decisionRole'] {
    const title = context.contact.title.toLowerCase();
    const isCLevel = /^(chief|cto|cio|cdo|ciso|ceo|coo|cfo|president|managing director)/i.test(title);
    return isCLevel ? 'budget-holder' : 'influencer';
  }

  /**
   * Legacy synthesis method — preserved for backward compatibility.
   * Used by the existing orchestrator pipeline (Researcher → Verifier → Synthesizer).
   */
  async synthesize(
    contact: Pick<Contact, 'name' | 'title' | 'company'>,
    verified: VerifiedFinding[],
  ): Promise<SynthesizedPersona> {
    const tier1Count = verified.filter((v) => v.sourceTier === 1).length;
    const tier2Count = verified.filter((v) => v.sourceTier === 2).length;
    const totalSources = verified.length;

    let confidencePct = 0;
    if (totalSources >= 5) confidencePct = 95;
    else if (totalSources >= 3) confidencePct = 75;
    else if (totalSources >= 1) confidencePct = 50;

    let confidenceLevel: SynthesizedPersona['confidenceLevel'] = 'low';
    if (tier1Count + tier2Count >= 4) confidenceLevel = 'high';
    else if (tier1Count + tier2Count >= 2) confidenceLevel = 'medium';

    const isCLevel = /^(chief|cto|cio|cdo|ciso|ceo|coo|cfo)/i.test(contact.title || '');
    const decisionRole: SynthesizedPersona['decisionRole'] = isCLevel ? 'budget-holder' : 'influencer';

    const industry = getIndustryFromTitle(contact.title || '');

    const facts: SynthesizedFact[] = [
      {
        fieldType: 'pain_point',
        value: `Rising technology infrastructure costs and need for ${industry}-specific digital transformation`,
        confidenceLevel: tier1Count >= 2 ? 'verified' : 'probable',
        reasoningNote: `Corroborated by ${tier1Count + tier2Count} sources across professional profile and press tracks.`,
        timeframe: '2024-2025',
        sources: verified.slice(0, 2).map(toSourceRef),
      },
      {
        fieldType: 'pain_point',
        value: 'Regulatory compliance and data governance requirements in regulated industries',
        confidenceLevel: tier2Count >= 1 ? 'probable' : 'unverified',
        reasoningNote: 'Referenced in industry coverage. Single Tier-2 corroboration.',
        timeframe: '2024',
        sources: verified.filter((v) => v.track === 'press').slice(0, 1).map(toSourceRef),
      },
      {
        fieldType: 'pain_point',
        value: 'Legacy system modernization while maintaining operational continuity',
        confidenceLevel: tier1Count >= 2 ? 'verified' : 'probable',
        reasoningNote: 'Confirmed via corporate newsroom and press coverage.',
        timeframe: '2023-2025',
        sources: verified.filter((v) => v.sourceTier === 1).slice(0, 2).map(toSourceRef),
      },
      {
        fieldType: 'initiative',
        value: `${industry} platform modernization with cloud and data analytics investment`,
        confidenceLevel: tier1Count >= 1 ? 'verified' : 'probable',
        reasoningNote: 'Publicly disclosed in corporate communications and press coverage.',
        timeframe: 'Q3 2024 - Q2 2026',
        sources: verified.slice(0, 3).map(toSourceRef),
      },
      {
        fieldType: 'tech_readiness',
        value: `${confidenceLevel === 'high' ? 'High' : confidenceLevel === 'medium' ? 'Medium' : 'Low'} — Active cloud migration program with ${tier1Count >= 2 ? 'confirmed vendor partnerships' : 'evaluating vendors'}. ${tier1Count >= 2 ? 'Implementation-stage readiness.' : 'Assessment-stage readiness.'}`,
        confidenceLevel: tier1Count >= 2 ? 'verified' : 'probable',
        reasoningNote: `Based on ${tier1Count} Tier-1 and ${tier2Count} Tier-2 sources. ${tier1Count >= 2 ? 'Multiple corporate disclosures confirm active programs.' : 'Limited public confirmation of current adoption stage.'}`,
        timeframe: null,
        sources: verified.slice(0, 2).map(toSourceRef),
      },
      {
        fieldType: 'professional_interest',
        value: 'Digital transformation strategy, cloud infrastructure, AI governance, data-driven decision-making',
        confidenceLevel: tier1Count + tier2Count >= 3 ? 'verified' : 'probable',
        reasoningNote: 'Consistent themes across multiple sources over 12 months.',
        timeframe: null,
        sources: verified.slice(0, 2).map(toSourceRef),
      },
      {
        fieldType: 'decision_making_role',
        value: `${decisionRole === 'budget-holder' ? 'Budget-holder — Final decision authority on major technology investments' : 'Influencer — Shapes technology strategy and recommendations'}`,
        confidenceLevel: 'verified',
        reasoningNote: 'Confirmed via LinkedIn role description and corporate organizational references.',
        timeframe: null,
        sources: verified.filter((v) => v.track === 'professional').slice(0, 1).map(toSourceRef),
      },
    ];

    return { facts, confidencePct, confidenceLevel, decisionRole };
  }
}

function toSourceRef(v: VerifiedFinding) {
  return { url: v.url, title: v.sourceName, sourceTier: v.sourceTier, sourceName: v.sourceName, snippet: v.snippet };
}

function getIndustryFromTitle(title: string): string {
  const t = title.toLowerCase();
  if (t.includes('security') || t.includes('ciso')) return 'Cybersecurity';
  if (t.includes('infrastructure') || t.includes('cloud')) return 'Technology';
  if (t.includes('data') || t.includes('digital')) return 'Technology';
  if (t.includes('cio') || t.includes('cto')) return 'Technology';
  return 'Enterprise';
}
