import type { EvidenceContext, ContextFact } from '../research/EvidenceContextBuilder';
import type { Inference, ExecutivePersona, LeadershipStyle, CommunicationStyle, DecisionStyle, RiskAppetite, InnovationOrientation, InfluenceLevel, NetworkingStyle, NegotiationStyle } from './IntelligenceTypes';
import { FactHelper } from './FactHelper';

/*
 * ExecutivePersonaEngine — infers a structured executive persona
 * from the EvidenceContext.
 *
 * Every attribute is grounded in verified facts. Each inference includes:
 *   - value
 *   - confidence
 *   - reasoning (WHY)
 *   - factIds
 *   - sourceIds
 *   - trustScore
 *
 * No hallucination — if evidence is insufficient, the attribute is "Unknown"
 * with confidence 0 and explicit reasoning about the gap.
 */

export class ExecutivePersonaEngine {
  buildPersona(context: EvidenceContext): ExecutivePersona {
    return {
      leadershipStyle: this.inferLeadershipStyle(context),
      communicationStyle: this.inferCommunicationStyle(context),
      decisionStyle: this.inferDecisionStyle(context),
      riskAppetite: this.inferRiskAppetite(context),
      innovationOrientation: this.inferInnovationOrientation(context),
      strategicPriorities: this.inferStrategicPriorities(context),
      businessInterests: this.inferBusinessInterests(context),
      technologyInterest: this.inferTechnologyInterest(context),
      industryFocus: this.inferIndustryFocus(context),
      influenceLevel: this.inferInfluenceLevel(context),
      networkingStyle: this.inferNetworkingStyle(context),
      negotiationStyle: this.inferNegotiationStyle(context),
    };
  }

  // ── Leadership Style ────────────────────────────

  private inferLeadershipStyle(context: EvidenceContext): Inference {
    const transformational = FactHelper.byKeywords(context, [
      'transformation', 'digital', 'modernization', 'change', 'innovation',
      'initiative', 'overhaul', 'restructure',
    ]);
    const strategic = FactHelper.byKeywords(context, [
      'strategy', 'strategic', 'vision', 'direction', 'roadmap',
    ]);
    const collaborative = FactHelper.byKeywords(context, [
      'collaboration', 'partnership', 'team', 'cross-functional', 'joint',
    ]);
    const operational = FactHelper.byKeywords(context, [
      'operations', 'efficiency', 'optimization', 'process', 'streamline',
    ]);

    const scores: { style: LeadershipStyle; facts: ContextFact[] }[] = [
      { style: 'Transformational', facts: transformational },
      { style: 'Strategic', facts: strategic },
      { style: 'Democratic', facts: collaborative },
      { style: 'Transactional', facts: operational },
    ];

    const best = scores.reduce((top, cur) =>
      cur.facts.length > top.facts.length ? cur : top,
    );

    if (best.facts.length === 0) {
      return this.unknown(context, 'leadership style');
    }

    const confidence = Math.min(95, 40 + best.facts.length * 15);
    return {
      value: best.style,
      confidence,
      reasoning: FactHelper.buildReasoning(
        best.facts,
        `Leadership style inferred as ${best.style}.`,
      ),
      factIds: FactHelper.collectFactIds(best.facts),
      sourceIds: FactHelper.collectSourceIds(best.facts),
      trustScore: context.trustScore,
    };
  }

  // ── Communication Style ─────────────────────────

  private inferCommunicationStyle(context: EvidenceContext): Inference {
    const visionary = FactHelper.byKeywords(context, [
      'vision', 'future', 'keynote', 'speech', 'keynote',
    ]);
    const analytical = FactHelper.byKeywords(context, [
      'data', 'analytical', 'metrics', 'kpi', 'report',
    ]);
    const collaborative = FactHelper.byKeywords(context, [
      'collaboration', 'dialogue', 'discussion', 'panel',
    ]);
    const direct = FactHelper.byKeywords(context, [
      'direct', 'decisive', 'straightforward', 'clear',
    ]);

    const scores: { style: CommunicationStyle; facts: ContextFact[] }[] = [
      { style: 'Visionary', facts: visionary },
      { style: 'Analytical', facts: analytical },
      { style: 'Collaborative', facts: collaborative },
      { style: 'Direct', facts: direct },
    ];

    const best = scores.reduce((top, cur) =>
      cur.facts.length > top.facts.length ? cur : top,
    );

    if (best.facts.length === 0) {
      return this.unknown(context, 'communication style');
    }

    const confidence = Math.min(90, 35 + best.facts.length * 15);
    return {
      value: best.style,
      confidence,
      reasoning: FactHelper.buildReasoning(
        best.facts,
        `Communication style inferred as ${best.style}.`,
      ),
      factIds: FactHelper.collectFactIds(best.facts),
      sourceIds: FactHelper.collectSourceIds(best.facts),
      trustScore: context.trustScore,
    };
  }

  // ── Decision Style ───────────────────────────────

  private inferDecisionStyle(context: EvidenceContext): Inference {
    const dataDriven = FactHelper.byKeywords(context, [
      'data', 'analytics', 'metrics', 'kpi', 'evidence-based',
    ]);
    const consensus = FactHelper.byKeywords(context, [
      'consensus', 'collaboration', 'committee', 'board',
    ]);
    const decisive = FactHelper.byKeywords(context, [
      'decisive', 'decision', 'rapid', 'quick', 'agile',
    ]);
    const analytical = FactHelper.byKeywords(context, [
      'analytical', 'analysis', 'research', 'assessment', 'evaluation',
    ]);

    const scores: { style: DecisionStyle; facts: ContextFact[] }[] = [
      { style: 'Data-driven', facts: dataDriven },
      { style: 'Consensus-oriented', facts: consensus },
      { style: 'Decisive', facts: decisive },
      { style: 'Analytical', facts: analytical },
    ];

    const best = scores.reduce((top, cur) =>
      cur.facts.length > top.facts.length ? cur : top,
    );

    if (best.facts.length === 0) {
      return this.unknown(context, 'decision style');
    }

    const confidence = Math.min(90, 35 + best.facts.length * 15);
    return {
      value: best.style,
      confidence,
      reasoning: FactHelper.buildReasoning(
        best.facts,
        `Decision style inferred as ${best.style}.`,
      ),
      factIds: FactHelper.collectFactIds(best.facts),
      sourceIds: FactHelper.collectSourceIds(best.facts),
      trustScore: context.trustScore,
    };
  }

  // ── Risk Appetite ────────────────────────────────

  private inferRiskAppetite(context: EvidenceContext): Inference {
    const highRisk = FactHelper.byKeywords(context, [
      'transformation', 'disruption', 'pioneer', 'bold', 'aggressive',
      'venture', 'startup', 'invest',
    ]);
    const lowRisk = FactHelper.byKeywords(context, [
      'conservative', 'cautious', 'stable', 'incremental', 'gradual',
    ]);
    const moderateRisk = FactHelper.byKeywords(context, [
      'balanced', 'measured', 'strategic', 'calculated',
    ]);

    const scores: { appetite: RiskAppetite; facts: ContextFact[] }[] = [
      { appetite: 'High', facts: highRisk },
      { appetite: 'Low', facts: lowRisk },
      { appetite: 'Moderate', facts: moderateRisk },
    ];

    const best = scores.reduce((top, cur) =>
      cur.facts.length > top.facts.length ? cur : top,
    );

    if (best.facts.length === 0) {
      return this.unknown(context, 'risk appetite');
    }

    const confidence = Math.min(85, 30 + best.facts.length * 15);
    return {
      value: best.appetite,
      confidence,
      reasoning: FactHelper.buildReasoning(
        best.facts,
        `Risk appetite inferred as ${best.appetite}.`,
      ),
      factIds: FactHelper.collectFactIds(best.facts),
      sourceIds: FactHelper.collectSourceIds(best.facts),
      trustScore: context.trustScore,
    };
  }

  // ── Innovation Orientation ───────────────────────

  private inferInnovationOrientation(context: EvidenceContext): Inference {
    const pioneer = FactHelper.byKeywords(context, [
      'pioneer', 'first', 'early adopter', 'cutting-edge', 'breakthrough',
      'frontier', 'innovative',
    ]);
    const earlyAdopter = FactHelper.byKeywords(context, [
      'adopt', 'implement', 'deploy', 'rollout', 'launch',
    ]);
    const pragmatic = FactHelper.byKeywords(context, [
      'pragmatic', 'practical', 'proven', 'established', 'mainstream',
    ]);
    const conservative = FactHelper.byKeywords(context, [
      'conservative', 'traditional', 'legacy', 'conventional',
    ]);

    const scores: { orientation: InnovationOrientation; facts: ContextFact[] }[] = [
      { orientation: 'Pioneer', facts: pioneer },
      { orientation: 'Early Adopter', facts: earlyAdopter },
      { orientation: 'Pragmatic', facts: pragmatic },
      { orientation: 'Conservative', facts: conservative },
    ];

    const best = scores.reduce((top, cur) =>
      cur.facts.length > top.facts.length ? cur : top,
    );

    if (best.facts.length === 0) {
      return this.unknown(context, 'innovation orientation');
    }

    const confidence = Math.min(90, 35 + best.facts.length * 15);
    return {
      value: best.orientation,
      confidence,
      reasoning: FactHelper.buildReasoning(
        best.facts,
        `Innovation orientation inferred as ${best.orientation}.`,
      ),
      factIds: FactHelper.collectFactIds(best.facts),
      sourceIds: FactHelper.collectSourceIds(best.facts),
      trustScore: context.trustScore,
    };
  }

  // ── Strategic Priorities ─────────────────────────

  private inferStrategicPriorities(context: EvidenceContext): Inference[] {
    const priorities: Inference[] = [];

    const digitalTransformation = FactHelper.byKeywords(context, [
      'digital transformation', 'modernization', 'digitization',
    ]);
    if (digitalTransformation.length > 0) {
      priorities.push(this.buildInference(
        'Digital Transformation',
        digitalTransformation,
        context,
        'Strategic priority: digital transformation.',
      ));
    }

    const cloudMigration = FactHelper.byKeywords(context, [
      'cloud', 'cloud migration', 'cloud-native', 'aws', 'azure', 'gcp',
    ]);
    if (cloudMigration.length > 0) {
      priorities.push(this.buildInference(
        'Cloud Migration',
        cloudMigration,
        context,
        'Strategic priority: cloud migration.',
      ));
    }

    const dataAnalytics = FactHelper.byKeywords(context, [
      'data analytics', 'big data', 'data-driven', 'business intelligence',
    ]);
    if (dataAnalytics.length > 0) {
      priorities.push(this.buildInference(
        'Data Analytics',
        dataAnalytics,
        context,
        'Strategic priority: data analytics.',
      ));
    }

    const cybersecurity = FactHelper.byKeywords(context, [
      'cybersecurity', 'security', 'information security', 'ciso',
    ]);
    if (cybersecurity.length > 0) {
      priorities.push(this.buildInference(
        'Cybersecurity',
        cybersecurity,
        context,
        'Strategic priority: cybersecurity.',
      ));
    }

    const sustainability = FactHelper.byKeywords(context, [
      'sustainability', 'esg', 'green', 'carbon', 'environmental',
    ]);
    if (sustainability.length > 0) {
      priorities.push(this.buildInference(
        'Sustainability/ESG',
        sustainability,
        context,
        'Strategic priority: sustainability/ESG.',
      ));
    }

    const growth = FactHelper.byKeywords(context, [
      'growth', 'expansion', 'market', 'acquisition', 'merger',
    ]);
    if (growth.length > 0) {
      priorities.push(this.buildInference(
        'Growth & Expansion',
        growth,
        context,
        'Strategic priority: growth and expansion.',
      ));
    }

    if (priorities.length === 0) {
      priorities.push(this.unknown(context, 'strategic priorities'));
    }

    return priorities;
  }

  // ── Business Interests ───────────────────────────

  private inferBusinessInterests(context: EvidenceContext): Inference[] {
    const interests: Inference[] = [];

    const technology = FactHelper.byKeywords(context, [
      'technology', 'ai', 'artificial intelligence', 'machine learning',
      'automation', 'digital',
    ]);
    if (technology.length > 0) {
      interests.push(this.buildInference(
        'Technology & AI',
        technology,
        context,
        'Business interest: technology and AI.',
      ));
    }

    const finance = FactHelper.byKeywords(context, [
      'finance', 'revenue', 'profit', 'cost', 'budget', 'investment',
    ]);
    if (finance.length > 0) {
      interests.push(this.buildInference(
        'Financial Performance',
        finance,
        context,
        'Business interest: financial performance.',
      ));
    }

    const customer = FactHelper.byKeywords(context, [
      'customer', 'client', 'experience', 'satisfaction', 'service',
    ]);
    if (customer.length > 0) {
      interests.push(this.buildInference(
        'Customer Experience',
        customer,
        context,
        'Business interest: customer experience.',
      ));
    }

    const operations = FactHelper.byKeywords(context, [
      'operations', 'supply chain', 'logistics', 'manufacturing', 'process',
    ]);
    if (operations.length > 0) {
      interests.push(this.buildInference(
        'Operational Excellence',
        operations,
        context,
        'Business interest: operational excellence.',
      ));
    }

    if (interests.length === 0) {
      interests.push(this.unknown(context, 'business interests'));
    }

    return interests;
  }

  // ── Technology Interest ──────────────────────────

  private inferTechnologyInterest(context: EvidenceContext): Inference {
    const techFacts = FactHelper.byKeywords(context, [
      'technology', 'ai', 'cloud', 'digital', 'data', 'automation',
      'machine learning', 'artificial intelligence', 'cybersecurity',
      'software', 'platform', 'infrastructure', 'it ', 'tech',
    ]);

    if (techFacts.length === 0) {
      return this.unknown(context, 'technology interest');
    }

    const confidence = Math.min(95, 40 + techFacts.length * 12);
    return {
      value: `${techFacts.length} technology-related evidence points found`,
      confidence,
      reasoning: FactHelper.buildReasoning(
        techFacts,
        'Technology interest inferred from evidence.',
      ),
      factIds: FactHelper.collectFactIds(techFacts),
      sourceIds: FactHelper.collectSourceIds(techFacts),
      trustScore: context.trustScore,
    };
  }

  // ── Industry Focus ───────────────────────────────

  private inferIndustryFocus(context: EvidenceContext): Inference {
    const industryFacts = FactHelper.byCategoryContains(context, 'industry');
    const companyFacts = FactHelper.byCategoryContains(context, 'company');

    const allFacts = [...industryFacts, ...companyFacts];

    if (allFacts.length === 0) {
      return this.unknown(context, 'industry focus');
    }

    const industryValue = industryFacts.length > 0
      ? industryFacts.map((f) => f.value).join(', ')
      : context.contact.company;

    const confidence = Math.min(90, 40 + allFacts.length * 12);
    return {
      value: industryValue,
      confidence,
      reasoning: FactHelper.buildReasoning(
        allFacts,
        'Industry focus inferred from company and industry evidence.',
      ),
      factIds: FactHelper.collectFactIds(allFacts),
      sourceIds: FactHelper.collectSourceIds(allFacts),
      trustScore: context.trustScore,
    };
  }

  // ── Influence Level ──────────────────────────────

  private inferInfluenceLevel(context: EvidenceContext): Inference {
    const speaking = FactHelper.byKeywords(context, [
      'keynote', 'speaker', 'panel', 'conference', 'summit', 'forum',
    ]);
    const awards = FactHelper.byKeywords(context, [
      'award', 'recognition', 'honored', 'top', 'best', 'distinguished',
    ]);
    const publications = FactHelper.byKeywords(context, [
      'publication', 'article', 'paper', 'author', 'published',
    ]);
    const boardSeats = FactHelper.byKeywords(context, [
      'board', 'director', 'advisor', 'trustee',
    ]);

    const totalSignals = speaking.length + awards.length + publications.length + boardSeats.length;

    if (totalSignals === 0) {
      return this.unknown(context, 'influence level');
    }

    const allFacts = [...speaking, ...awards, ...publications, ...boardSeats];

    let level: InfluenceLevel;
    if (totalSignals >= 8) level = 'Industry Leader';
    else if (totalSignals >= 5) level = 'Sector Influencer';
    else if (totalSignals >= 3) level = 'Company Leader';
    else level = 'Emerging Voice';

    const confidence = Math.min(90, 30 + totalSignals * 10);
    return {
      value: level,
      confidence,
      reasoning: FactHelper.buildReasoning(
        allFacts,
        `Influence level inferred as ${level} based on ${totalSignals} influence signals (speaking: ${speaking.length}, awards: ${awards.length}, publications: ${publications.length}, board seats: ${boardSeats.length}).`,
      ),
      factIds: FactHelper.collectFactIds(allFacts),
      sourceIds: FactHelper.collectSourceIds(allFacts),
      trustScore: context.trustScore,
    };
  }

  // ── Networking Style ─────────────────────────────

  private inferNetworkingStyle(context: EvidenceContext): Inference {
    const events = FactHelper.byKeywords(context, [
      'conference', 'summit', 'forum', 'panel', 'networking', 'event',
    ]);
    const partnerships = FactHelper.byKeywords(context, [
      'partnership', 'collaboration', 'alliance', 'joint venture',
    ]);
    const community = FactHelper.byKeywords(context, [
      'community', 'association', 'member', 'society', 'foundation',
    ]);

    const scores: { style: NetworkingStyle; facts: ContextFact[] }[] = [
      { style: 'Strategic Networker', facts: events },
      { style: 'Relationship Builder', facts: partnerships },
      { style: 'Community Builder', facts: community },
    ];

    const best = scores.reduce((top, cur) =>
      cur.facts.length > top.facts.length ? cur : top,
    );

    if (best.facts.length === 0) {
      return this.unknown(context, 'networking style');
    }

    const confidence = Math.min(85, 30 + best.facts.length * 15);
    return {
      value: best.style,
      confidence,
      reasoning: FactHelper.buildReasoning(
        best.facts,
        `Networking style inferred as ${best.style}.`,
      ),
      factIds: FactHelper.collectFactIds(best.facts),
      sourceIds: FactHelper.collectSourceIds(best.facts),
      trustScore: context.trustScore,
    };
  }

  // ── Negotiation Style ─────────────────────────────

  private inferNegotiationStyle(context: EvidenceContext): Inference {
    const collaborative = FactHelper.byKeywords(context, [
      'partnership', 'collaboration', 'win-win', 'mutual', 'agreement',
    ]);
    const competitive = FactHelper.byKeywords(context, [
      'acquisition', 'merger', 'deal', 'negotiate', 'bargain',
    ]);
    const principled = FactHelper.byKeywords(context, [
      'principle', 'value', 'integrity', 'standard', 'framework',
    ]);

    const scores: { style: NegotiationStyle; facts: ContextFact[] }[] = [
      { style: 'Collaborative', facts: collaborative },
      { style: 'Competitive', facts: competitive },
      { style: 'Principled', facts: principled },
    ];

    const best = scores.reduce((top, cur) =>
      cur.facts.length > top.facts.length ? cur : top,
    );

    if (best.facts.length === 0) {
      return this.unknown(context, 'negotiation style');
    }

    const confidence = Math.min(80, 30 + best.facts.length * 15);
    return {
      value: best.style,
      confidence,
      reasoning: FactHelper.buildReasoning(
        best.facts,
        `Negotiation style inferred as ${best.style}.`,
      ),
      factIds: FactHelper.collectFactIds(best.facts),
      sourceIds: FactHelper.collectSourceIds(best.facts),
      trustScore: context.trustScore,
    };
  }

  // ── Helpers ──────────────────────────────────────

  private buildInference(
    value: string,
    facts: ContextFact[],
    context: EvidenceContext,
    prefix: string,
  ): Inference {
    const confidence = Math.min(90, 35 + facts.length * 12);
    return {
      value,
      confidence,
      reasoning: FactHelper.buildReasoning(facts, prefix),
      factIds: FactHelper.collectFactIds(facts),
      sourceIds: FactHelper.collectSourceIds(facts),
      trustScore: context.trustScore,
    };
  }

  private unknown(context: EvidenceContext, attribute: string): Inference {
    return {
      value: 'Unknown',
      confidence: 0,
      reasoning: `Insufficient evidence to infer ${attribute}. No supporting facts found in the EvidenceContext.`,
      factIds: [],
      sourceIds: [],
      trustScore: context.trustScore,
    };
  }
}
