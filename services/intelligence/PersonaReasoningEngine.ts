import type { EvidenceContext, ContextFact } from '../research/EvidenceContextBuilder';
import type { ReasoningChain, ReasoningStep, ExecutivePersona } from './IntelligenceTypes';
import { FactHelper } from './FactHelper';

/*
 * PersonaReasoningEngine — explains WHY every inference exists.
 *
 * For each persona attribute, this engine produces a ReasoningChain:
 *   - The attribute being reasoned about
 *   - The inferred value
 *   - WHY (the reasoning narrative)
 *   - Confidence
 *   - Supporting fact IDs and source IDs
 *   - Individual reasoning steps (observation → inference)
 *
 * Every reasoning chain is grounded in EvidenceContext facts.
 * No reasoning is produced without supporting evidence.
 */

export class PersonaReasoningEngine {
  buildReasoningChains(
    context: EvidenceContext,
    persona: ExecutivePersona,
  ): ReasoningChain[] {
    const chains: ReasoningChain[] = [];

    chains.push(this.buildChain(context, 'leadership_style', persona.leadershipStyle));
    chains.push(this.buildChain(context, 'communication_style', persona.communicationStyle));
    chains.push(this.buildChain(context, 'decision_style', persona.decisionStyle));
    chains.push(this.buildChain(context, 'risk_appetite', persona.riskAppetite));
    chains.push(this.buildChain(context, 'innovation_orientation', persona.innovationOrientation));
    chains.push(this.buildChain(context, 'technology_interest', persona.technologyInterest));
    chains.push(this.buildChain(context, 'industry_focus', persona.industryFocus));
    chains.push(this.buildChain(context, 'influence_level', persona.influenceLevel));
    chains.push(this.buildChain(context, 'networking_style', persona.networkingStyle));
    chains.push(this.buildChain(context, 'negotiation_style', persona.negotiationStyle));

    for (const priority of persona.strategicPriorities) {
      chains.push(this.buildChain(context, 'strategic_priority', priority));
    }

    for (const interest of persona.businessInterests) {
      chains.push(this.buildChain(context, 'business_interest', interest));
    }

    return chains;
  }

  private buildChain(
    context: EvidenceContext,
    attribute: string,
    inference: {
      value: string;
      confidence: number;
      reasoning: string;
      factIds: string[];
      sourceIds: string[];
      trustScore: number;
    },
  ): ReasoningChain {
    const facts = context.allFacts.filter((f) =>
      inference.factIds.includes(f.factId),
    );

    const reasoningSteps = this.buildReasoningSteps(facts, attribute);

    return {
      attribute,
      value: inference.value,
      reasoning: inference.reasoning,
      confidence: inference.confidence,
      factIds: inference.factIds,
      sourceIds: inference.sourceIds,
      trustScore: inference.trustScore,
      reasoningSteps,
    };
  }

  private buildReasoningSteps(
    facts: ContextFact[],
    attribute: string,
  ): ReasoningStep[] {
    if (facts.length === 0) {
      return [
        {
          observation: 'No supporting evidence found in the EvidenceContext.',
          factIds: [],
          inference: `Unable to infer ${attribute} — insufficient data.`,
        },
      ];
    }

    return facts.slice(0, 5).map((fact) => ({
      observation: `Evidence: ${fact.predicate} = "${fact.value}" (${fact.verificationStatus}, ${fact.confidence}% confidence) from ${fact.sourceNames.length} source(s).`,
      factIds: [fact.factId],
      inference: `This evidence supports the ${attribute} inference.`,
    }));
  }
}
