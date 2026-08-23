import type { EvidenceContext, ContextFact } from '../research/EvidenceContextBuilder';
import type { ExecutiveOpportunity, OpportunityType } from './IntelligenceTypes';
import { FactHelper } from './FactHelper';

/*
 * ExecutiveOpportunityEngine — identifies opportunities grounded in evidence.
 *
 * Scans the EvidenceContext for signals related to:
 *   Technology Adoption, Digital Transformation, AI Adoption, Cloud,
 *   Cybersecurity, Partnership, Innovation, ESG, Investment, Expansion,
 *   Recruitment
 *
 * Every recommendation references supporting evidence (factIds, sourceIds).
 */

interface OpportunityRule {
  type: OpportunityType;
  keywords: string[];
  description: string;
  eventThemes: string[];
}

const OPPORTUNITY_RULES: OpportunityRule[] = [
  {
    type: 'technology_adoption',
    keywords: ['technology', 'digital', 'platform', 'infrastructure', 'it ', 'software'],
    description: 'Technology adoption opportunity — executive shows interest in technology initiatives',
    eventThemes: ['Technology Innovation', 'Digital Strategy', 'Enterprise IT'],
  },
  {
    type: 'digital_transformation',
    keywords: ['digital transformation', 'transformation', 'modernization', 'digitization'],
    description: 'Digital transformation opportunity — executive leads or supports transformation',
    eventThemes: ['Digital Transformation', 'Business Modernization', 'Change Leadership'],
  },
  {
    type: 'ai_adoption',
    keywords: ['ai', 'artificial intelligence', 'machine learning', 'ml', 'generative ai', 'genai'],
    description: 'AI adoption opportunity — executive engages with AI/ML initiatives',
    eventThemes: ['AI & Machine Learning', 'Generative AI', 'Intelligent Automation'],
  },
  {
    type: 'cloud',
    keywords: ['cloud', 'aws', 'azure', 'gcp', 'cloud migration', 'cloud-native', 'saas'],
    description: 'Cloud adoption opportunity — executive involved in cloud strategy',
    eventThemes: ['Cloud Computing', 'Cloud Strategy', 'Cloud Migration'],
  },
  {
    type: 'cybersecurity',
    keywords: ['cybersecurity', 'security', 'ciso', 'information security', 'data protection', 'zero trust'],
    description: 'Cybersecurity opportunity — executive prioritizes security',
    eventThemes: ['Cybersecurity', 'Information Security', 'Risk Management'],
  },
  {
    type: 'partnership',
    keywords: ['partnership', 'alliance', 'collaboration', 'joint venture', 'strategic partnership'],
    description: 'Partnership opportunity — executive open to strategic alliances',
    eventThemes: ['Strategic Partnerships', 'Business Alliances', 'Collaborative Growth'],
  },
  {
    type: 'innovation',
    keywords: ['innovation', 'innovative', 'r&d', 'research', 'breakthrough', 'incubator'],
    description: 'Innovation opportunity — executive champions innovation',
    eventThemes: ['Innovation', 'R&D Strategy', 'Disruptive Technology'],
  },
  {
    type: 'esg',
    keywords: ['esg', 'sustainability', 'green', 'carbon', 'environmental', 'climate', 'renewable'],
    description: 'ESG opportunity — executive engaged in sustainability',
    eventThemes: ['ESG & Sustainability', 'Green Business', 'Corporate Responsibility'],
  },
  {
    type: 'investment',
    keywords: ['investment', 'invest', 'funding', 'capital', 'venture', 'portfolio'],
    description: 'Investment opportunity — executive involved in investment decisions',
    eventThemes: ['Investment Strategy', 'Capital Allocation', 'Venture & Growth'],
  },
  {
    type: 'expansion',
    keywords: ['expansion', 'growth', 'new market', 'scale', 'global', 'international'],
    description: 'Expansion opportunity — executive drives market expansion',
    eventThemes: ['Market Expansion', 'Global Growth', 'Scaling Strategies'],
  },
  {
    type: 'recruitment',
    keywords: ['recruitment', 'talent', 'hiring', 'workforce', 'team building', 'headcount'],
    description: 'Recruitment opportunity — executive focused on talent acquisition',
    eventThemes: ['Talent Strategy', 'Workforce Development', 'Leadership Recruitment'],
  },
];

export class ExecutiveOpportunityEngine {
  identify(context: EvidenceContext): ExecutiveOpportunity[] {
    const opportunities: ExecutiveOpportunity[] = [];

    for (const rule of OPPORTUNITY_RULES) {
      const facts = FactHelper.byKeywords(context, rule.keywords);
      if (facts.length === 0) continue;

      const confidence = Math.min(90, 30 + facts.length * 12);
      const factIds = FactHelper.collectFactIds(facts);
      const sourceIds = FactHelper.collectSourceIds(facts);

      const reasoning = FactHelper.buildReasoning(
        facts,
        `${rule.description}.`,
      );

      opportunities.push({
        type: rule.type,
        value: rule.description,
        confidence,
        reasoning,
        factIds,
        sourceIds,
        trustScore: context.trustScore,
        suggestedEventThemes: rule.eventThemes,
      });
    }

    return opportunities;
  }
}
