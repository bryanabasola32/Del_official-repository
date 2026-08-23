import type { ExecutiveIntelligenceReport } from '../intelligence/IntelligenceTypes';
import type { EngagementStrategy, EngagementStrategyType } from './RelationshipTypes';
import { RelationshipHelper } from './RelationshipHelper';

/*
 * EngagementStrategyEngine — generates deterministic engagement strategies.
 *
 * Each strategy is derived from the MP4 report's persona, archetype,
 * opportunities, and influence level. Every strategy includes objectives,
 * reasoning, and supporting citations.
 */

interface StrategyRule {
  type: EngagementStrategyType;
  applies: (report: ExecutiveIntelligenceReport) => boolean;
  objectives: (report: ExecutiveIntelligenceReport) => string[];
  reasoning: (report: ExecutiveIntelligenceReport) => string;
  confidence: (report: ExecutiveIntelligenceReport) => number;
  citations: (report: ExecutiveIntelligenceReport) => ReturnType<typeof RelationshipHelper.collectFromInferences>;
}

const STRATEGY_RULES: StrategyRule[] = [
  {
    type: 'First Meeting',
    applies: (r) => RelationshipHelper.overallConfidence(r) >= 25 && RelationshipHelper.totalFacts(r) >= 3,
    objectives: (r) => [
      `Establish initial rapport with ${r.contact.name} based on their ${RelationshipHelper.archetype(r)} archetype`,
      `Identify shared interests from ${r.persona.businessInterests.length} known business interest(s)`,
      `Introduce DEL's value proposition aligned to ${r.opportunities.length} identified opportunity(ies)`,
    ],
    reasoning: (r) => `Overall confidence is ${RelationshipHelper.overallConfidence(r)}% with ${RelationshipHelper.totalFacts(r)} facts. Sufficient evidence for a first meeting. The executive's archetype (${RelationshipHelper.archetype(r)}) and ${r.persona.businessInterests.length} business interest(s) provide conversation anchors.`,
    confidence: (r) => Math.min(80, RelationshipHelper.overallConfidence(r)),
    citations: (r) => RelationshipHelper.collectFromInferences([
      ...r.persona.businessInterests,
      ...r.opportunities,
    ]),
  },
  {
    type: 'Conference Networking',
    applies: (r) => {
      const ns = RelationshipHelper.networkingStyle(r);
      return ns === 'Relationship Builder' || ns === 'Strategic Networker' || ns === 'Community Builder';
    },
    objectives: (r) => [
      `Leverage ${RelationshipHelper.networkingStyle(r)} networking style for organic connection`,
      `Use ${r.opportunities.length} identified opportunity(ies) as conversation entry points`,
      `Connect around ${RelationshipHelper.allEventThemes(r).length} relevant event theme(s)`,
    ],
    reasoning: (r) => `Networking style is "${RelationshipHelper.networkingStyle(r)}" which supports conference networking. ${r.opportunities.length} opportunities and ${RelationshipHelper.allEventThemes(r).length} event themes provide natural conversation starters.`,
    confidence: (r) => Math.min(85, RelationshipHelper.overallConfidence(r)),
    citations: (r) => RelationshipHelper.collectFromInferences([
      r.persona.networkingStyle,
      ...r.opportunities,
    ]),
  },
  {
    type: 'VIP Engagement',
    applies: (r) => {
      const il = RelationshipHelper.influenceLevel(r);
      return il === 'Industry Leader' || il === 'Sector Influencer';
    },
    objectives: (r) => [
      `Treat ${r.contact.name} as a ${RelationshipHelper.influenceLevel(r)} — tailor VIP protocol`,
      `Focus on strategic-level topics from ${r.persona.strategicPriorities.length} known priority(ies)`,
      `Ensure executive-level representation from DEL`,
    ],
    reasoning: (r) => `Influence level is "${RelationshipHelper.influenceLevel(r)}" which warrants VIP engagement. ${r.persona.strategicPriorities.length} strategic priorities provide high-level discussion topics.`,
    confidence: (r) => Math.min(90, RelationshipHelper.overallConfidence(r)),
    citations: (r) => RelationshipHelper.collectFromInferences([
      r.persona.influenceLevel,
      ...r.persona.strategicPriorities,
    ]),
  },
  {
    type: 'Executive Roundtable',
    applies: (r) => {
      const ls = RelationshipHelper.leadershipStyle(r);
      return ls === 'Transformational' || ls === 'Strategic' || ls === 'Democratic' || ls === 'Cross-functional';
    },
    objectives: (r) => [
      `Invite ${r.contact.name} to a roundtable leveraging their ${RelationshipHelper.leadershipStyle(r)} leadership style`,
      `Discuss ${r.persona.strategicPriorities.length} strategic priority(ies) in a peer setting`,
      `Foster cross-industry dialogue around ${RelationshipHelper.archetype(r)} archetype themes`,
    ],
    reasoning: (r) => `Leadership style is "${RelationshipHelper.leadershipStyle(r)}" which aligns with collaborative roundtable formats. ${r.persona.strategicPriorities.length} strategic priorities provide discussion material.`,
    confidence: (r) => Math.min(80, RelationshipHelper.overallConfidence(r)),
    citations: (r) => RelationshipHelper.collectFromInferences([
      r.persona.leadershipStyle,
      ...r.persona.strategicPriorities,
    ]),
  },
  {
    type: 'Speaker Interaction',
    applies: (r) => r.timeline.some((t) => t.type === 'speaking'),
    objectives: (r) => [
      `Attend ${r.contact.name}'s speaking engagement(s) and engage during Q&A`,
      `Reference their speaking topic(s) to demonstrate attentiveness`,
      `Follow up with insights related to ${r.persona.technologyInterest.value} technology interest`,
    ],
    reasoning: (r) => `${r.contact.name} has ${r.timeline.filter((t) => t.type === 'speaking').length} speaking engagement(s) in the timeline. These provide natural interaction opportunities.`,
    confidence: (r) => Math.min(85, RelationshipHelper.overallConfidence(r)),
    citations: (r) => {
      const speaking = r.timeline.filter((t) => t.type === 'speaking');
      return RelationshipHelper.collectFromInferences(speaking);
    },
  },
  {
    type: 'Sponsor Conversation',
    applies: (r) => r.opportunities.some((o) => o.type === 'partnership' || o.type === 'investment'),
    objectives: (r) => [
      `Explore sponsorship aligned with ${r.opportunities.filter((o) => o.type === 'partnership' || o.type === 'investment').length} partnership/investment opportunity(ies)`,
      `Position DEL events as platforms for ${r.contact.company}'s strategic initiatives`,
      `Connect sponsorship to ${r.persona.strategicPriorities.length} known strategic priority(ies)`,
    ],
    reasoning: (r) => `${r.opportunities.filter((o) => o.type === 'partnership' || o.type === 'investment').length} partnership/investment opportunity(ies) identified. These directly support sponsor-level conversations.`,
    confidence: (r) => Math.min(85, RelationshipHelper.overallConfidence(r)),
    citations: (r) => RelationshipHelper.collectFromInferences(
      r.opportunities.filter((o) => o.type === 'partnership' || o.type === 'investment'),
    ),
  },
  {
    type: 'Investor Discussion',
    applies: (r) => r.opportunities.some((o) => o.type === 'investment' || o.type === 'expansion'),
    objectives: (r) => [
      `Frame discussion around ${r.opportunities.filter((o) => o.type === 'investment' || o.type === 'expansion').length} investment/expansion opportunity(ies)`,
      `Connect to ${r.persona.riskAppetite.value} risk appetite and ${r.persona.innovationOrientation.value} innovation orientation`,
      `Position DEL as a gateway to relevant investment networks`,
    ],
    reasoning: (r) => `${r.opportunities.filter((o) => o.type === 'investment' || o.type === 'expansion').length} investment/expansion opportunity(ies) identified. Risk appetite is "${r.persona.riskAppetite.value}" and innovation orientation is "${r.persona.innovationOrientation.value}".`,
    confidence: (r) => Math.min(80, RelationshipHelper.overallConfidence(r)),
    citations: (r) => RelationshipHelper.collectFromInferences(
      r.opportunities.filter((o) => o.type === 'investment' || o.type === 'expansion'),
    ),
  },
  {
    type: 'Corporate Partnership',
    applies: (r) => r.opportunities.some((o) => o.type === 'partnership') &&
      RelationshipHelper.hasStrategicPriorities(r),
    objectives: (r) => [
      `Propose corporate partnership around ${r.persona.strategicPriorities.length} strategic priority(ies)`,
      `Leverage ${r.opportunities.filter((o) => o.type === 'partnership').length} partnership opportunity(ies) as foundation`,
      `Align partnership terms with ${RelationshipHelper.archetype(r)} archetype goals`,
    ],
    reasoning: (r) => `${r.opportunities.filter((o) => o.type === 'partnership').length} partnership opportunity(ies) and ${r.persona.strategicPriorities.length} strategic priority(ies) identified. The ${RelationshipHelper.archetype(r)} archetype supports corporate partnership discussions.`,
    confidence: (r) => Math.min(85, RelationshipHelper.overallConfidence(r)),
    citations: (r) => RelationshipHelper.collectFromInferences([
      ...r.opportunities.filter((o) => o.type === 'partnership'),
      ...r.persona.strategicPriorities,
    ]),
  },
];

export class EngagementStrategyEngine {
  generateStrategies(report: ExecutiveIntelligenceReport): EngagementStrategy[] {
    const strategies: EngagementStrategy[] = [];

    for (const rule of STRATEGY_RULES) {
      if (!rule.applies(report)) continue;

      strategies.push({
        type: rule.type,
        objectives: rule.objectives(report),
        reasoning: rule.reasoning(report),
        confidence: rule.confidence(report),
        citations: rule.citations(report),
      });
    }

    return strategies;
  }
}
