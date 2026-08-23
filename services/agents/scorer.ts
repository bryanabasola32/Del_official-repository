import type { ScoreResult } from '../providers/types';
import type { Contact, EventItem, PersonaFact } from '@/lib/types';

/*
 * Scorer Agent
 *
 * Input: Persona + event
 * Output: Weighted event-match score
 *
 * Rubric:
 *   Role/title relevance: 40%
 *   Industry match:      25%
 *   Pain point alignment: 25%
 *   Tech readiness fit:  10%
 *
 * Proactive: runs on new persona, refreshed persona, new event, or manual add.
 * Only scores against active/upcoming events.
 * Low-confidence personas get capped scores.
 */

export class ScorerAgent {
  async score(
    contact: Pick<Contact, 'name' | 'title' | 'company' | 'persona_confidence_level' | 'persona_confidence_pct'>,
    event: EventItem,
    personaFacts: PersonaFact[]
  ): Promise<ScoreResult> {
    const title = (contact.title || '').toLowerCase();
    const eventDesc = (event.description || '').toLowerCase();
    const eventIndustries = (event.target_industries || []).map((i) => i.toLowerCase());
    const contactIndustry = getIndustryFromTitle(contact.title || '').toLowerCase();

    // Role score (0-40)
    let roleScore = 20;
    if (/\b(chief|cto|cio|cdo|ciso|ceo|coo|cfo)\b/i.test(title)) roleScore = 36;
    else if (/\b(vp|vice president|director|head)\b/i.test(title)) roleScore = 30;
    else if (/\b(manager|lead)\b/i.test(title)) roleScore = 22;

    if (eventDesc.includes('cio') && title.includes('cio')) roleScore = 39;
    if (eventDesc.includes('ciso') && title.includes('ciso')) roleScore = 39;
    if (eventDesc.includes('cto') && title.includes('cto')) roleScore = 39;

    // Industry score (0-25)
    let industryScore = 12;
    if (eventIndustries.some((ind) => contactIndustry.includes(ind) || ind.includes(contactIndustry))) {
      industryScore = 22;
    }
    if (eventIndustries.some((ind) => {
      const companyLower = contact.company.toLowerCase();
      return companyLower.includes(ind.split(' ')[0]) || ind.split(' ')[0].includes(companyLower.split(' ')[0]);
    })) {
      industryScore = 23;
    }

    // Pain point score (0-25)
    let painpointScore = 12;
    const painPoints = personaFacts.filter((f) => f.field_type === 'pain_point');
    if (painPoints.length > 0) {
      const painText = painPoints.map((p) => p.value.toLowerCase()).join(' ');
      const eventTheme = (event.primary_theme || event.theme || '').toLowerCase();
      if (eventTheme.includes('ai') && (painText.includes('ai') || painText.includes('digital'))) painpointScore = 22;
      else if (eventTheme.includes('cloud') && (painText.includes('cloud') || painText.includes('infrastructure'))) painpointScore = 23;
      else if (eventTheme.includes('modern') && (painText.includes('modern') || painText.includes('legacy'))) painpointScore = 21;
      else painpointScore = 18;
    }

    // Tech readiness score (0-10)
    let techreadinessScore = 5;
    const techFact = personaFacts.find((f) => f.field_type === 'tech_readiness');
    if (techFact) {
      const techText = techFact.value.toLowerCase();
      if (techText.includes('high')) techreadinessScore = 9;
      else if (techText.includes('medium')) techreadinessScore = 7;
      else if (techText.includes('low')) techreadinessScore = 4;
    }

    const totalScore = roleScore + industryScore + painpointScore + techreadinessScore;

    // Confidence capping: Low-confidence personas get capped at 70
    const confidenceCapped = contact.persona_confidence_level === 'low';
    const finalTotal = confidenceCapped ? Math.min(totalScore, 70) : totalScore;

    const reasoning = generateScoreReasoning(contact, event, { roleScore, industryScore, painpointScore, techreadinessScore }, confidenceCapped);

    return { roleScore, industryScore, painpointScore, techreadinessScore, totalScore: finalTotal, confidenceCapped, reasoning };
  }
}

function generateScoreReasoning(
  contact: Pick<Contact, 'name' | 'title' | 'company' | 'persona_confidence_level'>,
  event: EventItem,
  scores: { roleScore: number; industryScore: number; painpointScore: number; techreadinessScore: number },
  capped: boolean
): string {
  const parts: string[] = [];
  parts.push(`Role match: ${scores.roleScore}/40 — ${contact.title} aligns ${scores.roleScore >= 35 ? 'strongly' : scores.roleScore >= 28 ? 'moderately' : 'weakly'} with ${event.event_name}'s target audience.`);
  parts.push(`Industry: ${scores.industryScore}/25 — ${contact.company}'s sector ${scores.industryScore >= 20 ? 'is a primary target' : 'has partial overlap'}.`);
  parts.push(`Pain points: ${scores.painpointScore}/25 — ${scores.painpointScore >= 20 ? 'Strong alignment with session content' : 'Moderate alignment'}.`);
  parts.push(`Tech readiness: ${scores.techreadinessScore}/10.`);
  if (capped) {
    parts.push(`NOTE: Score capped at 70 due to Low persona confidence. Treat as tentative.`);
  }
  return parts.join(' ');
}

function getIndustryFromTitle(title: string): string {
  const t = title.toLowerCase();
  if (t.includes('security') || t.includes('ciso')) return 'Cybersecurity';
  if (t.includes('infrastructure') || t.includes('cloud')) return 'Technology';
  if (t.includes('data') || t.includes('digital')) return 'Technology';
  if (t.includes('cio') || t.includes('cto')) return 'Technology';
  return 'Enterprise';
}
