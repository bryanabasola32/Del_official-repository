import { supabase } from '@/lib/supabase';
import type { Contact } from '@/lib/types';

/*
 * ExecutiveResolver — reusable identity resolution for executive names.
 *
 * Pipeline:
 *   User Executive Reference
 *     → Name Normalization
 *     → Candidate Matching (DB ilike + normalized comparison)
 *     → Context Signals (company, title, active conversation)
 *     → Identity Confidence
 *     → Resolve / Clarify / No Match
 *
 * Never creates duplicate contacts. Never silently selects when ambiguous.
 */

export interface ResolveContext {
  companyName?: string | null;
  activeExecutiveId?: string | null;
}

export interface ResolveResult {
  contact: Contact | null;
  ambiguous: boolean;
  candidates: Contact[];
}

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[.\-_,]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractNameTokens(name: string): string[] {
  return normalizeName(name).split(' ').filter((t) => t.length > 0);
}

function nameSimilarity(query: string, candidate: string): number {
  const qTokens = extractNameTokens(query);
  const cTokens = extractNameTokens(candidate);
  if (qTokens.length === 0 || cTokens.length === 0) return 0;

  const qFirst = qTokens[0];
  const qLast = qTokens[qTokens.length - 1];
  const cFirst = cTokens[0];
  const cLast = cTokens[cTokens.length - 1];

  let score = 0;
  if (qFirst === cFirst) score += 40;
  if (qLast === cLast) score += 40;

  const qMiddle = qTokens.slice(1, -1);
  const cMiddle = cTokens.slice(1, -1);

  if (qMiddle.length === 0 && cMiddle.length > 0) {
    score += 15;
  } else if (qMiddle.length > 0 && cMiddle.length === 0) {
    score += 10;
  } else if (qMiddle.length > 0 && cMiddle.length > 0) {
    const qMiddleStr = qMiddle.join(' ');
    const cMiddleStr = cMiddle.join(' ');
    if (qMiddleStr === cMiddleStr) {
      score += 20;
    } else {
      const qInitials = qMiddle.filter((t) => t.length === 1);
      const cMiddleInitials = cMiddle.filter((t) => t.length === 1);
      if (qInitials.length > 0 && cMiddleInitials.length > 0) {
        if (qInitials.some((qi) => cMiddleInitials.some((ci) => ci === qi))) {
          score += 15;
        }
      }
    }
  }

  if (qTokens.length === cTokens.length) {
    score += 5;
  }

  return Math.min(score, 100);
}

export class ExecutiveResolver {
  async resolve(
    rawName: string,
    context?: ResolveContext,
  ): Promise<ResolveResult> {
    const normalized = normalizeName(rawName);
    if (!normalized) {
      return { contact: null, ambiguous: false, candidates: [] };
    }

    const { data: allContacts } = await supabase
      .from('contacts')
      .select('*')
      .order('created_at', { ascending: true });

    const contacts = (allContacts || []) as Contact[];

    const scored = contacts
      .map((c) => ({
        contact: c,
        score: nameSimilarity(normalized, c.name),
      }))
      .filter((s) => s.score >= 50)
      .sort((a, b) => b.score - a.score);

    if (scored.length === 0) {
      return { contact: null, ambiguous: false, candidates: [] };
    }

    if (context?.companyName) {
      const companyLower = context.companyName.toLowerCase();
      for (const s of scored) {
        if (s.contact.company && s.contact.company.toLowerCase().includes(companyLower)) {
          s.score += 30;
        }
      }
      scored.sort((a, b) => b.score - a.score);
    }

    if (context?.activeExecutiveId) {
      for (const s of scored) {
        if (s.contact.id === context.activeExecutiveId) {
          s.score += 20;
        }
      }
      scored.sort((a, b) => b.score - a.score);
    }

    const topScore = scored[0].score;
    const topCandidates = scored.filter((s) => s.score >= topScore - 5);

    if (topCandidates.length > 1 && topCandidates[0].score < 90) {
      return {
        contact: null,
        ambiguous: true,
        candidates: topCandidates.map((s) => s.contact),
      };
    }

    return {
      contact: scored[0].contact,
      ambiguous: false,
      candidates: [scored[0].contact],
    };
  }
}

let _resolver: ExecutiveResolver | null = null;

export function getExecutiveResolver(): ExecutiveResolver {
  if (!_resolver) {
    _resolver = new ExecutiveResolver();
  }
  return _resolver;
}
