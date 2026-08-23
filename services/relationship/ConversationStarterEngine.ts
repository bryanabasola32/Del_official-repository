import type { ExecutiveIntelligenceReport } from '../intelligence/IntelligenceTypes';
import type { ConversationStarter, ConversationCategory } from './RelationshipTypes';
import { RelationshipHelper } from './RelationshipHelper';

/*
 * ConversationStarterEngine — generates conversation recommendations
 * using only MP4 outputs.
 *
 * Never invents data. If evidence is insufficient, returns "Unknown"
 * with confidence = 0.
 */

interface StarterRule {
  category: ConversationCategory;
  applies: (report: ExecutiveIntelligenceReport) => boolean;
  topic: (report: ExecutiveIntelligenceReport) => string;
  question: (report: ExecutiveIntelligenceReport) => string;
  reasoning: (report: ExecutiveIntelligenceReport) => string;
  confidence: (report: ExecutiveIntelligenceReport) => number;
  citations: (report: ExecutiveIntelligenceReport) => ReturnType<typeof RelationshipHelper.collectFromInferences>;
}

const STARTER_RULES: StarterRule[] = [
  {
    category: 'Industry Trends',
    applies: (r) => r.persona.industryFocus.value !== 'Unknown' && r.persona.industryFocus.confidence > 0,
    topic: (r) => `Trends in ${r.persona.industryFocus.value}`,
    question: (r) => `How do you see ${r.persona.industryFocus.value} evolving over the next few years, and what shifts are you most focused on?`,
    reasoning: (r) => `Industry focus is "${r.persona.industryFocus.value}" with ${r.persona.industryFocus.confidence}% confidence. This provides a direct conversation anchor for industry trend discussions.`,
    confidence: (r) => Math.min(85, r.persona.industryFocus.confidence),
    citations: (r) => RelationshipHelper.collectFromInferences([r.persona.industryFocus]),
  },
  {
    category: 'Technology Interests',
    applies: (r) => r.persona.technologyInterest.value !== 'Unknown' && r.persona.technologyInterest.confidence > 0,
    topic: (r) => `Technology: ${r.persona.technologyInterest.value}`,
    question: (r) => `You've shown interest in ${r.persona.technologyInterest.value} — what initiatives are you most excited about in that space?`,
    reasoning: (r) => `Technology interest is "${r.persona.technologyInterest.value}" with ${r.persona.technologyInterest.confidence}% confidence. This is a strong conversation anchor for technology topics.`,
    confidence: (r) => Math.min(85, r.persona.technologyInterest.confidence),
    citations: (r) => RelationshipHelper.collectFromInferences([r.persona.technologyInterest]),
  },
  {
    category: 'Leadership Topics',
    applies: (r) => r.persona.leadershipStyle.value !== 'Unknown' && r.persona.leadershipStyle.confidence > 0,
    topic: (r) => `Leadership: ${r.persona.leadershipStyle.value} approach`,
    question: (r) => `As someone recognized for a ${r.persona.leadershipStyle.value} leadership approach, how do you foster that within your organization?`,
    reasoning: (r) => `Leadership style is "${r.persona.leadershipStyle.value}" with ${r.persona.leadershipStyle.confidence}% confidence. This supports a leadership-focused conversation starter.`,
    confidence: (r) => Math.min(80, r.persona.leadershipStyle.confidence),
    citations: (r) => RelationshipHelper.collectFromInferences([r.persona.leadershipStyle]),
  },
  {
    category: 'Innovation Initiatives',
    applies: (r) => r.persona.innovationOrientation.value !== 'Unknown' && r.persona.innovationOrientation.confidence > 0,
    topic: (r) => `Innovation: ${r.persona.innovationOrientation.value} orientation`,
    question: (r) => `With a ${r.persona.innovationOrientation.value} approach to innovation, what emerging technologies or methodologies are you watching most closely?`,
    reasoning: (r) => `Innovation orientation is "${r.persona.innovationOrientation.value}" with ${r.persona.innovationOrientation.confidence}% confidence. This supports an innovation-focused conversation starter.`,
    confidence: (r) => Math.min(80, r.persona.innovationOrientation.confidence),
    citations: (r) => RelationshipHelper.collectFromInferences([r.persona.innovationOrientation]),
  },
  {
    category: 'Business Priorities',
    applies: (r) => RelationshipHelper.hasStrategicPriorities(r),
    topic: (r) => `Strategic priorities: ${r.persona.strategicPriorities.slice(0, 3).map((p) => p.value).join(', ')}`,
    question: (r) => `Given your focus on ${r.persona.strategicPriorities.slice(0, 2).map((p) => p.value).join(' and ')}, what milestones are you targeting this year?`,
    reasoning: (r) => `${r.persona.strategicPriorities.length} strategic priority(ies) identified with average confidence ${RelationshipHelper.averageConfidence(r.persona.strategicPriorities)}%. These provide direct conversation anchors for business priorities.`,
    confidence: (r) => Math.min(85, RelationshipHelper.averageConfidence(r.persona.strategicPriorities)),
    citations: (r) => RelationshipHelper.collectFromInferences(r.persona.strategicPriorities),
  },
  {
    category: 'Conference Themes',
    applies: (r) => RelationshipHelper.allEventThemes(r).length > 0,
    topic: (r) => `Event themes: ${RelationshipHelper.allEventThemes(r).slice(0, 3).join(', ')}`,
    question: (r) => `Several themes from your work — ${RelationshipHelper.allEventThemes(r).slice(0, 2).join(' and ')} — align with our upcoming events. Which of these areas interests you most?`,
    reasoning: (r) => `${RelationshipHelper.allEventThemes(r).length} event theme(s) derived from ${r.opportunities.length} opportunity(ies). These provide conference-relevant conversation starters.`,
    confidence: (r) => Math.min(80, RelationshipHelper.averageConfidence(r.opportunities)),
    citations: (r) => RelationshipHelper.collectFromInferences(r.opportunities),
  },
  {
    category: 'Mutual Interests',
    applies: (r) => RelationshipHelper.hasBusinessInterests(r) && RelationshipHelper.hasOpportunities(r),
    topic: (r) => `Shared interests: ${r.persona.businessInterests.slice(0, 2).map((b) => b.value).join(', ')}`,
    question: (r) => `Your interests in ${r.persona.businessInterests.slice(0, 2).map((b) => b.value).join(' and ')} overlap with several of our initiatives — would you be interested in exploring a collaboration?`,
    reasoning: (r) => `${r.persona.businessInterests.length} business interest(s) and ${r.opportunities.length} opportunity(ies) identified. Overlap between interests and opportunities supports mutual-interest conversation starters.`,
    confidence: (r) => Math.min(80, Math.min(
      RelationshipHelper.averageConfidence(r.persona.businessInterests),
      RelationshipHelper.averageConfidence(r.opportunities),
    )),
    citations: (r) => RelationshipHelper.collectFromInferences([
      ...r.persona.businessInterests,
      ...r.opportunities,
    ]),
  },
  {
    category: 'Open-ended Questions',
    applies: (r) => RelationshipHelper.overallConfidence(r) >= 30,
    topic: (r) => `Open-ended: ${r.contact.name}'s vision`,
    question: (r) => `What's the biggest challenge you see in ${r.persona.industryFocus.value !== 'Unknown' ? r.persona.industryFocus.value : 'your industry'} right now, and how are you approaching it?`,
    reasoning: (r) => `Overall confidence is ${RelationshipHelper.overallConfidence(r)}%. Sufficient evidence for an open-ended question that invites the executive to share their vision.`,
    confidence: (r) => Math.min(70, RelationshipHelper.overallConfidence(r)),
    citations: (r) => r.persona.industryFocus.value !== 'Unknown'
      ? RelationshipHelper.collectFromInferences([r.persona.industryFocus])
      : RelationshipHelper.emptyCitation(),
  },
];

export class ConversationStarterEngine {
  generateStarters(report: ExecutiveIntelligenceReport): ConversationStarter[] {
    const starters: ConversationStarter[] = [];

    for (const rule of STARTER_RULES) {
      if (!rule.applies(report)) continue;

      starters.push({
        category: rule.category,
        topic: rule.topic(report),
        suggestedQuestion: rule.question(report),
        reasoning: rule.reasoning(report),
        confidence: rule.confidence(report),
        citations: rule.citations(report),
      });
    }

    if (starters.length === 0) {
      starters.push({
        category: 'Open-ended Questions',
        topic: 'Unknown',
        suggestedQuestion: 'Unknown',
        reasoning: 'Insufficient evidence in the Executive Intelligence Report to generate any conversation starters. No persona attributes, strategic priorities, business interests, or opportunities have sufficient confidence.',
        confidence: 0,
        citations: RelationshipHelper.emptyCitation(),
      });
    }

    return starters;
  }
}
