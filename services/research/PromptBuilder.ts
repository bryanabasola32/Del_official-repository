import type { EvidenceContext, ContextFact } from './EvidenceContextBuilder';

/*
 * PromptBuilder — generates AI prompts exclusively from the EvidenceContext.
 *
 * No prompt is ever built from raw search results, raw findings, or webpages.
 * The PromptBuilder is the single point where evidence becomes an AI prompt.
 *
 * Reusable across:
 *   - Persona generation
 *   - Recommendation generation
 *   - Invitation generation
 *   - Future AI tasks
 *
 * Each prompt includes:
 *   - Executive facts (verified)
 *   - Company profile
 *   - Verified professional history
 *   - Leadership indicators
 *   - Awards, publications, speaking engagements
 *   - Pain points and technology indicators
 *   - Trust scores and confidence summaries
 *   - Missing information and evidence limitations
 */

export type PromptPurpose =
  | 'persona_generation'
  | 'recommendation_generation'
  | 'invitation_generation'
  | 'executive_summary'
  | 'general_analysis';

export interface BuiltPrompt {
  systemPrompt: string;
  userPrompt: string;
  /** The purpose this prompt was built for */
  purpose: PromptPurpose;
  /** Fact IDs that were included in the prompt (for traceability) */
  citedFactIds: string[];
  /** Source IDs referenced in the prompt */
  citedSourceIds: string[];
  /** Trust score at time of prompt construction */
  trustScore: number;
  /** Evidence completeness at time of prompt construction */
  completeness: number;
}

export class PromptBuilder {
  /**
   * Build a complete AI prompt from the EvidenceContext.
   */
  build(context: EvidenceContext, purpose: PromptPurpose = 'persona_generation'): BuiltPrompt {
    const systemPrompt = this.buildSystemPrompt(purpose);
    const userPrompt = this.buildUserPrompt(context, purpose);
    const citedFactIds = context.allFacts.map((f) => f.factId);
    const citedSourceIds = context.sources.map((s) => s.sourceId);

    return {
      systemPrompt,
      userPrompt,
      purpose,
      citedFactIds,
      citedSourceIds,
      trustScore: context.trustScore,
      completeness: context.completeness,
    };
  }

  private buildSystemPrompt(purpose: PromptPurpose): string {
    const base = `You are DEL, an expert Executive Intelligence Analyst. You analyze verified evidence about executives and their companies to generate actionable intelligence for event invitation planning.

CRITICAL RULES:
1. Base every conclusion ONLY on the verified evidence provided below.
2. Never fabricate information that is not supported by the evidence.
3. If evidence is insufficient for a conclusion, state "Insufficient Data" explicitly.
4. Always consider the confidence score and trust score when making claims.
5. If conflicting evidence exists, acknowledge the conflict rather than picking a side arbitrarily.
6. Preserve the source references — every claim should be traceable to the evidence.`;

    const purposeSpecific: Record<PromptPurpose, string> = {
      persona_generation: `\n\nYOUR TASK: Generate a comprehensive executive persona based on the verified evidence. Identify pain points, initiatives, technology readiness, professional interests, and decision-making role. Each finding must reference the supporting evidence.`,
      recommendation_generation: `\n\nYOUR TASK: Based on the verified evidence, recommend which upcoming events this executive should be invited to. Consider their role, industry, pain points, and technology readiness. Score the fit and explain the reasoning with evidence references.`,
      invitation_generation: `\n\nYOUR TASK: Draft a personalized invitation for this executive to attend a specific event. Use the verified evidence to personalize the message with specific, evidence-backed details about their role, interests, and pain points. Never include unverified claims.`,
      executive_summary: `\n\nYOUR TASK: Produce a concise executive summary based on the verified evidence. Highlight the executive's role, key initiatives, technology readiness, and relevant context. Maintain the confidence levels from the evidence.`,
      general_analysis: `\n\nYOUR TASK: Analyze the verified evidence and provide insights relevant to the query. Ground every insight in the evidence provided.`,
    };

    return base + purposeSpecific[purpose];
  }

  private buildUserPrompt(context: EvidenceContext, purpose: PromptPurpose): string {
    const sections: string[] = [];

    // ── Executive Profile ──
    sections.push(this.buildExecutiveSection(context));

    // ── Verified Facts by Category ──
    sections.push(this.buildFactsSection(context));

    // ── Company Information ──
    sections.push(this.buildCompanySection(context));

    // ── Conflicts ──
    if (context.conflicts.length > 0) {
      sections.push(this.buildConflictsSection(context));
    }

    // ── Trust & Confidence Summary ──
    sections.push(this.buildTrustSection(context));

    // ── Missing Information ──
    sections.push(this.buildMissingInfoSection(context));

    // ── Source References ──
    sections.push(this.buildSourcesSection(context));

    // ── Task-Specific Instructions ──
    sections.push(this.buildTaskInstructions(purpose));

    return sections.join('\n\n---\n\n');
  }

  private buildExecutiveSection(context: EvidenceContext): string {
    return `## EXECUTIVE PROFILE

Name: ${context.contact.name}
Title: ${context.contact.title || 'Not specified'}
Company: ${context.contact.company}`;
  }

  private buildFactsSection(context: EvidenceContext): string {
    if (context.allFacts.length === 0) {
      return `## VERIFIED FACTS

No verified facts were extracted from the evidence. All conclusions should be marked as "Insufficient Data."`;
    }

    const lines: string[] = ['## VERIFIED FACTS (Organized by Category)'];

    for (const group of context.factGroups) {
      lines.push(`\n### ${this.formatCategoryLabel(group.category)}`);
      for (const fact of group.facts) {
        lines.push(this.formatFactLine(fact));
      }
    }

    return lines.join('\n');
  }

  private formatFactLine(fact: ContextFact): string {
    const statusIcon = this.statusIcon(fact.verificationStatus);
    const sources = fact.sourceNames.length > 0 ? ` [Sources: ${fact.sourceNames.join(', ')}]` : '';
    const conflictNote = fact.hasConflict ? ' ⚠️ CONFLICTING' : '';
    const freshness = fact.isFresh ? '' : ' (potentially outdated)';

    return `- ${statusIcon} [${fact.confidence}% confidence] ${fact.predicate}: ${fact.value}${sources}${conflictNote}${freshness}`;
  }

  private statusIcon(status: string): string {
    switch (status) {
      case 'verified': return '✓';
      case 'corroborated': return '✓';
      case 'single_source': return '○';
      case 'conflicting': return '⚠';
      case 'rejected': return '✗';
      default: return '?';
    }
  }

  private buildCompanySection(context: EvidenceContext): string {
    const companyFacts = context.allFacts.filter(
      (f) => f.category === 'company' || f.category === 'company_industry' || f.category === 'company_size',
    );

    if (companyFacts.length === 0) {
      return `## COMPANY INFORMATION

Limited company information available from verified evidence.`;
    }

    const lines: string[] = ['## COMPANY INFORMATION'];
    for (const fact of companyFacts) {
      lines.push(`- ${fact.predicate}: ${fact.value} [${fact.confidence}% confidence]`);
    }
    return lines.join('\n');
  }

  private buildConflictsSection(context: EvidenceContext): string {
    const lines: string[] = ['## EVIDENCE CONFLICTS (Acknowledged)'];

    for (const conflict of context.conflicts) {
      lines.push(`\n**${conflict.subject} — ${conflict.predicate}** (${conflict.severity} conflict):`);
      for (const cv of conflict.conflictingValues) {
        lines.push(`  - "${cv.value}" (from: ${cv.sourceNames.join(', ')})`);
      }
    }

    lines.push('\nNote: These conflicts must be acknowledged in any analysis. Do not arbitrarily choose one value over another.');
    return lines.join('\n');
  }

  private buildTrustSection(context: EvidenceContext): string {
    return `## TRUST & CONFIDENCE SUMMARY

- Overall Trust Score: ${context.trustScore}/100
- Verification Status: ${context.verification.status}
- Total Facts: ${context.verification.totalFacts}
- Verified Facts: ${context.verification.verifiedCount}
- Conflicting Facts: ${context.verification.conflictingCount}
- Unverified Facts: ${context.verification.unverifiedCount}
- Evidence Completeness: ${context.completeness}%
- Average Source Authority: ${context.authority.averageAuthority}/100
- Source Distribution: ${context.authority.tier1Count} Tier-1, ${context.authority.tier2Count} Tier-2, ${context.authority.tier3Count} Tier-3

${context.evidenceSummary}`;
  }

  private buildMissingInfoSection(context: EvidenceContext): string {
    if (context.missingInfo.length === 0 && context.researchRecommendations.length === 0) {
      return `## MISSING INFORMATION

No significant information gaps detected.`;
    }

    const lines: string[] = ['## MISSING INFORMATION & EVIDENCE LIMITATIONS'];

    if (context.missingInfo.length > 0) {
      lines.push('\nMissing categories:');
      for (const missing of context.missingInfo) {
        lines.push(`- ${missing.category}: ${missing.reason} (${missing.queriesAttempted} queries attempted)`);
      }
    }

    if (context.researchRecommendations.length > 0) {
      lines.push('\nRecommendations for additional research:');
      for (const rec of context.researchRecommendations) {
        lines.push(`- ${rec}`);
      }
    }

    lines.push('\nNote: Conclusions about missing areas should be marked as "Insufficient Data" or given appropriately low confidence.');
    return lines.join('\n');
  }

  private buildSourcesSection(context: EvidenceContext): string {
    if (context.sources.length === 0) {
      return `## SOURCE REFERENCES

No sources collected.`;
    }

    const lines: string[] = ['## SOURCE REFERENCES (Full Provenance)'];
    for (const source of context.sources) {
      const date = source.publishedDate ? ` (published: ${source.publishedDate})` : '';
      lines.push(`- [${source.sourceId}] ${source.sourceName} (Tier ${source.sourceTier}, Authority ${source.authorityScore}) — ${source.title}${date}`);
      lines.push(`  URL: ${source.url}`);
    }
    return lines.join('\n');
  }

  private buildTaskInstructions(purpose: PromptPurpose): string {
    const instructions: Record<PromptPurpose, string> = {
      persona_generation: `## YOUR OUTPUT

Generate a structured executive persona with the following sections:
1. PAIN POINTS — What challenges is this executive likely facing? (grounded in evidence)
2. INITIATIVES — What projects or transformations are underway? (grounded in evidence)
3. TECHNOLOGY READINESS — How ready is the organization for technology adoption?
4. PROFESSIONAL INTERESTS — What topics and areas is this executive interested in?
5. DECISION-MAKING ROLE — Is this executive a budget-holder or influencer?
6. INDUSTRY CONTEXT — What industry dynamics are relevant?

For each point, cite the fact IDs that support it. If evidence is insufficient, state so explicitly.`,
      recommendation_generation: `## YOUR OUTPUT

Based on the evidence above, provide:
1. ROLE FIT — How well does the executive's role match the event? (0-100)
2. INDUSTRY FIT — How well does the industry match? (0-100)
3. PAIN POINT FIT — Do the executive's pain points align with the event theme? (0-100)
4. TECH READINESS FIT — Does the tech readiness match the event level? (0-100)
5. TOTAL SCORE — Weighted overall fit (0-100)
6. REASONING — Evidence-based explanation with fact citations`,
      invitation_generation: `## YOUR OUTPUT

Draft a personalized invitation that:
1. References the executive's verified role and interests
2. Connects the event theme to their evidence-backed pain points
3. Is professional, concise, and personalized
4. Never includes unverified claims
5. Cites fact IDs used in the personalization`,
      executive_summary: `## YOUR OUTPUT

Produce a 2-3 paragraph executive summary that:
1. Describes the executive's role and company context
2. Highlights key initiatives and technology readiness
3. Notes any significant evidence gaps or conflicts
4. Maintains the confidence levels from the evidence`,
      general_analysis: `## YOUR OUTPUT

Provide analysis grounded in the evidence above. Cite fact IDs for each conclusion.`,
    };

    return instructions[purpose];
  }

  private formatCategoryLabel(category: string): string {
    return category
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
}
