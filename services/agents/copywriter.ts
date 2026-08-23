import type { InvitationDraft, ScoreResult } from '../providers/types';
import type { Contact, EventItem, PersonaFact } from '@/lib/types';

/*
 * Copywriter Agent
 *
 * Input: Persona + event + score
 * Output: Invitation subject, body, cited fact IDs
 *
 * Must reference at least one verified fact. Supports regeneration.
 */

export class CopywriterAgent {
  async draft(
    contact: Contact,
    event: EventItem,
    _score: ScoreResult,
    personaFacts: PersonaFact[]
  ): Promise<InvitationDraft> {
    const verifiedFacts = personaFacts.filter((f) => f.confidence_level === 'verified' || f.confidence_level === 'probable');
    const citedFact = verifiedFacts[0] || personaFacts[0];

    const painPoint = personaFacts.find((f) => f.field_type === 'pain_point');
    const initiative = personaFacts.find((f) => f.field_type === 'initiative');
    const techReadiness = personaFacts.find((f) => f.field_type === 'tech_readiness');
    const industry = getIndustryFromTitle(contact.title || '');

    const subject = `Invitation: ${event.event_name} — ${event.date ? new Date(event.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : ''}`;

    const body = `Dear ${contact.name.split(' ')[0]},

I hope this message finds you well. As ${contact.title} at ${contact.company}, your perspective on ${industry} digital transformation would be invaluable at the upcoming ${event.event_name}${event.venue ? ` at ${event.venue}` : ''} on ${event.date ? new Date(event.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : ''}.

${painPoint ? `Given your focus on ${painPoint.value.toLowerCase()}, I believe the sessions on ${event.primary_theme || event.theme || 'emerging technology'} would be particularly relevant to your current priorities${initiative ? ` — especially in light of ${initiative.value.toLowerCase()}` : ''}.` : `The forum addresses themes directly relevant to your role and organization.`}

${techReadiness ? `Your organization's ${techReadiness.value.toLowerCase().includes('high') ? 'advanced' : techReadiness.value.toLowerCase().includes('medium') ? 'ongoing' : 'emerging'} technology readiness positions you well to contribute meaningfully to the peer discussions.` : ''}

The event is invitation-only and limited to senior technology leaders. I would be honored to reserve a seat for you. Would you be available to join us?

Warm regards,
DELCA VisionTech Events Team

---
This invitation was prepared with AI-assisted research. All facts are source-backed and confidence-tagged. Please verify before sending.`;

    return {
      subject,
      body,
      citedFactIds: citedFact ? [citedFact.id] : [],
    };
  }
}

function getIndustryFromTitle(title: string): string {
  const t = title.toLowerCase();
  if (t.includes('security') || t.includes('ciso')) return 'Cybersecurity';
  if (t.includes('infrastructure') || t.includes('cloud')) return 'Technology';
  if (t.includes('data') || t.includes('digital')) return 'Technology';
  if (t.includes('cio') || t.includes('cto')) return 'Technology';
  return 'Enterprise';
}
