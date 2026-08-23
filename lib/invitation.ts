import type { Contact, EventItem } from './types';

export type InvitationStatus =
  | 'not_generated'
  | 'draft_ready'
  | 'reviewed'
  | 'sent'
  | 'delivered'
  | 'failed'
  | 'declined'
  | 'accepted'
  | 'pending_response';

export type CommunicationMethod = 'email' | 'sms' | 'copy' | 'linkedin' | 'whatsapp' | 'teams';

export type MessageTemplate = 'professional' | 'formal' | 'executive' | 'friendly' | 'networking';

export interface InvitationRecord {
  id: string;
  contactId: string;
  eventId: string;
  executiveName: string;
  company: string;
  status: InvitationStatus;
  method: CommunicationMethod | null;
  subject: string;
  body: string;
  template: MessageTemplate;
  generatedDate: string | null;
  editedBy: string | null;
  lastUpdated: string;
  history: InvitationHistoryEntry[];
}

export interface InvitationHistoryEntry {
  id: string;
  timestamp: string;
  action: string;
  detail: string;
  editedBy: string;
  status: InvitationStatus;
  method: CommunicationMethod | null;
}

export const INVITATION_STATUS_CONFIG: Record<
  InvitationStatus,
  { label: string; dot: string; cls: string }
> = {
  not_generated: {
    label: 'Not Generated',
    dot: 'bg-slate-400',
    cls: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800/50 dark:text-slate-400 dark:border-slate-700',
  },
  draft_ready: {
    label: 'Draft Ready',
    dot: 'bg-blue-500',
    cls: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800',
  },
  reviewed: {
    label: 'Reviewed',
    dot: 'bg-violet-500',
    cls: 'bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-900/30 dark:text-violet-400 dark:border-violet-800',
  },
  sent: {
    label: 'Sent',
    dot: 'bg-indigo-500',
    cls: 'bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-400 dark:border-indigo-800',
  },
  delivered: {
    label: 'Delivered',
    dot: 'bg-cyan-500',
    cls: 'bg-cyan-100 text-cyan-700 border-cyan-200 dark:bg-cyan-900/30 dark:text-cyan-400 dark:border-cyan-800',
  },
  failed: {
    label: 'Failed',
    dot: 'bg-rose-500',
    cls: 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-400 dark:border-rose-800',
  },
  declined: {
    label: 'Declined',
    dot: 'bg-red-600',
    cls: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800',
  },
  accepted: {
    label: 'Accepted',
    dot: 'bg-emerald-500',
    cls: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800',
  },
  pending_response: {
    label: 'Pending Response',
    dot: 'bg-amber-500',
    cls: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800',
  },
};

export const COMMUNICATION_METHODS: {
  id: CommunicationMethod;
  label: string;
  available: boolean;
}[] = [
  { id: 'email', label: 'Email', available: true },
  { id: 'sms', label: 'SMS', available: true },
  { id: 'copy', label: 'Copy to Clipboard', available: true },
  { id: 'linkedin', label: 'LinkedIn', available: false },
  { id: 'whatsapp', label: 'WhatsApp', available: false },
  { id: 'teams', label: 'Microsoft Teams', available: false },
];

export const TEMPLATE_LABELS: Record<MessageTemplate, string> = {
  professional: 'Professional',
  formal: 'Formal',
  executive: 'Executive',
  friendly: 'Friendly',
  networking: 'Networking',
};

export const GENERATION_STEPS = [
  'Understanding executive...',
  'Analyzing event...',
  'Building personalized message...',
  'Writing invitation...',
  'Checking tone...',
  'Preparing draft...',
  'Complete.',
];

function pick<T>(arr: T[], seed: number): T {
  return arr[seed % arr.length];
}

function seedFrom(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function generateMockInvitation(
  contact: Pick<Contact, 'id' | 'name' | 'title' | 'company' | 'email' | 'persona_type' | 'decision_making_role' | 'executive_summary'>,
  event: Pick<EventItem, 'id' | 'event_name' | 'primary_theme' | 'theme' | 'date' | 'venue' | 'organizer' | 'target_audience'>,
  template: MessageTemplate = 'professional',
): { subject: string; body: string } {
  const seed = seedFrom(contact.id + event.id + template);
  const firstName = contact.name.split(' ')[0];
  const eventTheme = event.primary_theme || event.theme || 'this exclusive gathering';
  const eventDate = event.date
    ? new Date(event.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
    : 'a date to be confirmed';
  const venue = event.venue || 'our flagship venue';
  const role = contact.title || 'leader';
  const persona = contact.persona_type || 'strategic decision-maker';
  const summary = contact.executive_summary || `${firstName} is a ${persona} in the ${contact.company} organization.`;

  const subjects: Record<MessageTemplate, string> = {
    professional: `Invitation: ${event.event_name} — ${eventTheme}`,
    formal: `Formal Invitation to ${event.event_name}`,
    executive: `${firstName}, a strategic conversation at ${event.event_name}`,
    friendly: `You're invited to ${event.event_name}!`,
    networking: `Connecting at ${event.event_name} — an exclusive invite`,
  };

  const openers: Record<MessageTemplate, string[]> = {
    professional: [
      `Dear ${firstName},`,
      `Hello ${firstName},`,
      `Good day ${firstName},`,
    ],
    formal: [
      `Dear ${firstName},`,
      `Esteemed ${firstName},`,
      `Greetings ${firstName},`,
    ],
    executive: [
      `${firstName},`,
      `Hi ${firstName},`,
      `${firstName} —`,
    ],
    friendly: [
      `Hi ${firstName}!`,
      `Hey ${firstName},`,
      `Hello ${firstName}!`,
    ],
    networking: [
      `Hi ${firstName},`,
      `Hello ${firstName} —`,
      `Dear ${firstName},`,
    ],
  };

  const bodies: Record<MessageTemplate, string[]> = {
    professional: [
      `Based on your role as ${role} at ${contact.company}, I believe ${event.event_name} would be a strong fit for your strategic priorities.\n\nThe event focuses on ${eventTheme}, bringing together ${event.target_audience || 'industry leaders'} on ${eventDate} at ${venue}.\n\n${summary}\n\nI'd welcome the opportunity to host you. Would you be available to attend?`,
      `I'm reaching out because your work at ${contact.company} aligns closely with the themes of ${event.event_name}.\n\nThis gathering on ${eventDate} at ${venue} will explore ${eventTheme} — an area where your perspective as ${role} would be invaluable.\n\nI'd be delighted to reserve a seat for you. Please let me know your availability.`,
    ],
    formal: [
      `It is with great pleasure that we extend to you a formal invitation to ${event.event_name}, taking place on ${eventDate} at ${venue}.\n\nAs ${role} at ${contact.company}, your expertise in ${eventTheme} makes you an ideal participant. The program is designed for ${event.target_audience || 'distinguished leaders'} and will feature in-depth discussion and networking.\n\nWe would be honored by your presence. Kindly confirm your attendance at your earliest convenience.`,
    ],
    executive: [
      `${firstName} —\n\nI'll be direct: ${event.event_name} on ${eventDate} is bringing together the people shaping ${eventTheme}. You should be in the room.\n\nYour track record at ${contact.company} as ${role} speaks for itself. This is a small, curated gathering at ${venue} — not a conference, but a working session among peers.\n\nI've reserved a seat for you. Can you make it?`,
    ],
    friendly: [
      `I hope this finds you well! I wanted to personally invite you to ${event.event_name} on ${eventDate} at ${venue}.\n\nGiven what you're building at ${contact.company}, I think you'd really enjoy the conversations around ${eventTheme}. It's going to be a great group of ${event.target_audience || 'peers'}.\n\nNo pressure at all — just let me know if the date works and I'll save you a spot!`,
    ],
    networking: [
      `I've been following your work at ${contact.company}, and ${event.event_name} on ${eventDate} seems like the perfect place to connect.\n\nThe event is centered on ${eventTheme}, and I'm assembling a small group of ${event.target_audience || 'industry peers'} who I think would benefit from knowing each other. Your perspective as ${role} would add a lot to the conversation.\n\nWould you be open to joining us at ${venue}? I'd love to introduce you to a few folks.`,
    ],
  };

  const closers: Record<MessageTemplate, string[]> = {
    professional: [
      `\n\nWarm regards,\nThe DELCA Events Team`,
      `\n\nBest regards,\nThe DELCA Events Team`,
    ],
    formal: [
      `\n\nWith sincere regards,\nThe DELCA Events Committee`,
      `\n\nRespectfully,\nThe DELCA Events Team`,
    ],
    executive: [
      `\n\nBest,\nThe DELCA Events Team`,
      `\n\n— The DELCA Team`,
    ],
    friendly: [
      `\n\nCheers,\nThe DELCA Events Team`,
      `\n\nTalk soon!\nThe DELCA Events Team`,
    ],
    networking: [
      `\n\nLooking forward to it,\nThe DELCA Events Team`,
      `\n\nBest,\nThe DELCA Events Team`,
    ],
  };

  const subject = subjects[template];
  const body = `${pick(openers[template], seed)}\n\n${pick(bodies[template], seed)}${pick(closers[template], seed)}`;

  return { subject, body };
}

export function createEmptyInvitation(
  contactId: string,
  eventId: string,
  name: string,
  company: string,
): InvitationRecord {
  return {
    id: `${contactId}-${eventId}`,
    contactId,
    eventId,
    executiveName: name,
    company,
    status: 'not_generated',
    method: null,
    subject: '',
    body: '',
    template: 'professional',
    generatedDate: null,
    editedBy: null,
    lastUpdated: new Date().toISOString(),
    history: [],
  };
}
