import type { EvidenceContext, ContextFact } from '../research/EvidenceContextBuilder';
import type { ArchetypeClassification, ExecutiveArchetype } from './IntelligenceTypes';
import { FactHelper } from './FactHelper';

/*
 * ExecutiveArchetypeClassifier — classifies executives into explainable archetypes.
 *
 * Each archetype is scored based on keyword evidence in the EvidenceContext.
 * The highest-scoring archetype is selected, with full reasoning and citations.
 *
 * Archetypes:
 *   Digital Transformer, Innovation Leader, Operational Optimizer,
 *   Financial Strategist, Growth Executive, Technology Visionary,
 *   Customer Champion, Sustainability Advocate
 */

interface ArchetypeRule {
  archetype: ExecutiveArchetype;
  keywords: string[];
  description: string;
}

const ARCHETYPE_RULES: ArchetypeRule[] = [
  {
    archetype: 'Digital Transformer',
    keywords: ['digital transformation', 'digitization', 'modernization', 'digital', 'transformation'],
    description: 'Executive leads digital transformation initiatives',
  },
  {
    archetype: 'Innovation Leader',
    keywords: ['innovation', 'innovative', 'r&d', 'research', 'breakthrough', 'pioneer'],
    description: 'Executive drives innovation and research',
  },
  {
    archetype: 'Operational Optimizer',
    keywords: ['operations', 'efficiency', 'optimization', 'process', 'streamline', 'lean', 'six sigma'],
    description: 'Executive focuses on operational excellence',
  },
  {
    archetype: 'Financial Strategist',
    keywords: ['finance', 'revenue', 'profit', 'cost', 'budget', 'investment', 'roi', 'financial'],
    description: 'Executive prioritizes financial strategy',
  },
  {
    archetype: 'Growth Executive',
    keywords: ['growth', 'expansion', 'market', 'acquisition', 'merger', 'scale', 'new market'],
    description: 'Executive focuses on growth and expansion',
  },
  {
    archetype: 'Technology Visionary',
    keywords: ['technology', 'ai', 'artificial intelligence', 'cloud', 'machine learning', 'data', 'platform', 'architecture'],
    description: 'Executive champions technology vision',
  },
  {
    archetype: 'Customer Champion',
    keywords: ['customer', 'client', 'experience', 'satisfaction', 'service', 'cx'],
    description: 'Executive prioritizes customer experience',
  },
  {
    archetype: 'Sustainability Advocate',
    keywords: ['sustainability', 'esg', 'green', 'carbon', 'environmental', 'climate', 'renewable'],
    description: 'Executive advocates for sustainability',
  },
];

export class ExecutiveArchetypeClassifier {
  classify(context: EvidenceContext): ArchetypeClassification {
    const scores: { archetype: ExecutiveArchetype; score: number; facts: ContextFact[] }[] = [];

    for (const rule of ARCHETYPE_RULES) {
      const facts = FactHelper.byKeywords(context, rule.keywords);
      const score = facts.length;
      scores.push({ archetype: rule.archetype, score, facts });
    }

    const sorted = [...scores].sort((a, b) => b.score - a.score);
    const best = sorted[0];

    if (best.score === 0) {
      return {
        archetype: 'Unknown',
        confidence: 0,
        reasoning: 'Insufficient evidence to classify an executive archetype. No keyword signals matched any archetype rule.',
        factIds: [],
        sourceIds: [],
        trustScore: context.trustScore,
        archetypeScores: sorted.map((s) => ({ archetype: s.archetype, score: s.score })),
      };
    }

    const totalScore = sorted.reduce((sum, s) => sum + s.score, 0);
    const dominance = totalScore > 0 ? (best.score / totalScore) * 100 : 0;
    const confidence = Math.min(95, Math.round(30 + best.score * 10 + dominance * 0.3));

    const allFactIds = FactHelper.collectFactIds(best.facts);
    const allSourceIds = FactHelper.collectSourceIds(best.facts);

    const reasoning = this.buildReasoning(best.archetype, best.facts, dominance, sorted);

    return {
      archetype: best.archetype,
      confidence,
      reasoning,
      factIds: allFactIds,
      sourceIds: allSourceIds,
      trustScore: context.trustScore,
      archetypeScores: sorted.map((s) => ({ archetype: s.archetype, score: s.score })),
    };
  }

  private buildReasoning(
    archetype: ExecutiveArchetype,
    facts: ContextFact[],
    dominance: number,
    allScores: { archetype: ExecutiveArchetype; score: number }[],
  ): string {
    const rule = ARCHETYPE_RULES.find((r) => r.archetype === archetype);
    const description = rule?.description || '';

    const topEvidence = facts
      .slice(0, 3)
      .map((f) => `${f.predicate}: "${f.value}" (${f.confidence}% confidence)`)
      .join('; ');

    const otherScores = allScores
      .filter((s) => s.archetype !== archetype && s.score > 0)
      .slice(0, 3)
      .map((s) => `${s.archetype} (${s.score})`)
      .join(', ');

    let reasoning = `Classified as ${archetype}. ${description}. Based on ${facts.length} supporting evidence point(s). Dominance: ${dominance.toFixed(0)}% of total archetype signals. Key evidence: ${topEvidence}.`;

    if (otherScores) {
      reasoning += ` Also showed signals for: ${otherScores}.`;
    }

    return reasoning;
  }
}
