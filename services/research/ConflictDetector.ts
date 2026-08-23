import type { Fact, VerificationStatus } from './Fact';
import type { EvidenceSource, EvidencePackage, ConflictRecord } from './EvidencePackage';

/*
 * ConflictDetector — detects when multiple sources disagree.
 *
 * Responsibilities:
 *   - Compare facts with the same subject + predicate but different values
 *   - Record conflicting values
 *   - Preserve supporting sources for each conflicting value
 *   - Mark facts as CONFLICTING
 *   - Forward conflicts to the Trust Engine (via ConflictRecord[])
 *
 * When conflicts occur, the detector does NOT discard information.
 * Instead, it records all conflicting values and their supporting sources,
 * marks the fact as CONFLICTING, and creates a ConflictRecord for the
 * Trust Engine to factor into its scoring.
 *
 * Conflict severity:
 *   - minor: small variations (e.g. "CTO" vs "Chief Technology Officer")
 *   - major: significant disagreements (e.g. different company names, different dates)
 */

export class ConflictDetector {
  /**
   * Detect conflicts among extracted facts.
   * Returns an updated fact array with conflict markers and a list of conflict records.
   */
  detect(facts: Fact[], sources: EvidenceSource[]): { facts: Fact[]; conflicts: ConflictRecord[] } {
    const conflicts: ConflictRecord[] = [];

    // Group facts by subject + predicate to find disagreements
    const groups = new Map<string, Fact[]>();
    for (const fact of facts) {
      const key = `${fact.subject}::${fact.predicate}`;
      const existing = groups.get(key) || [];
      existing.push(fact);
      groups.set(key, existing);
    }

    const updatedFacts: Fact[] = [];

    for (const [, groupFacts] of Array.from(groups.entries())) {
      if (groupFacts.length <= 1) {
        // No possible conflict — single fact
        updatedFacts.push(...groupFacts);
        continue;
      }

      // Check for value disagreements
      const valueGroups = new Map<string, Fact[]>();
      for (const fact of groupFacts) {
        const normalizedValue = this.normalizeValue(fact.value);
        const existing = valueGroups.get(normalizedValue) || [];
        existing.push(fact);
        valueGroups.set(normalizedValue, existing);
      }

      if (valueGroups.size <= 1) {
        // All facts agree — no conflict, mark as corroborated
        for (const fact of groupFacts) {
          const corroboratingIds = groupFacts
            .filter((f) => f.factId !== fact.factId)
            .flatMap((f) => f.sourceIds);
          updatedFacts.push({
            ...fact,
            verificationStatus: 'corroborated' as VerificationStatus,
            metadata: {
              ...fact.metadata,
              corroboratingSourceIds: corroboratingIds,
            },
          });
        }
      } else {
        // Conflict detected — multiple different values for the same subject + predicate
        const conflictingValues = Array.from(valueGroups.values()).map((group) => ({
          value: group[0].value,
          sourceIds: group.flatMap((f) => f.sourceIds),
        }));

        const severity = this.assessSeverity(conflictingValues.map((cv) => cv.value));
        const subject = groupFacts[0].subject;
        const predicate = groupFacts[0].predicate;

        // Create a conflict record
        const conflictRecord: ConflictRecord = {
          factId: groupFacts[0].factId,
          subject,
          predicate,
          conflictingValues,
          severity,
        };
        conflicts.push(conflictRecord);

        // Mark all facts in this group as conflicting
        for (const fact of groupFacts) {
          const conflictingSourceIds = groupFacts
            .filter((f) => f.factId !== fact.factId)
            .flatMap((f) => f.sourceIds);

          updatedFacts.push({
            ...fact,
            verificationStatus: 'conflicting' as VerificationStatus,
            metadata: {
              ...fact.metadata,
              conflictingSourceIds,
            },
          });
        }
      }
    }

    return { facts: updatedFacts, conflicts };
  }

  /**
   * Normalize a value for comparison.
   * Handles common variations like abbreviations, case, and whitespace.
   */
  private normalizeValue(value: string): string {
    return value
      .toLowerCase()
      .trim()
      // Remove common title prefixes
      .replace(/^(mr|mrs|ms|dr|prof)\.?\s+/i, '')
      // Normalize whitespace
      .replace(/\s+/g, ' ')
      // Expand common abbreviations
      .replace(/\bcto\b/g, 'chief technology officer')
      .replace(/\bcfo\b/g, 'chief financial officer')
      .replace(/\bceo\b/g, 'chief executive officer')
      .replace(/\bcio\b/g, 'chief information officer')
      .replace(/\bcoo\b/g, 'chief operating officer')
      .replace(/\bvp\b/g, 'vice president')
      .replace(/\bdir\b/g, 'director')
      .trim();
  }

  /**
   * Assess the severity of a conflict.
   * minor: likely formatting/abbreviation differences
   * major: substantively different values
   */
  private assessSeverity(values: string[]): 'minor' | 'major' {
    if (values.length <= 1) return 'minor';

    // Check if the normalized values are actually the same (minor formatting difference)
    const normalized = values.map((v) => this.normalizeValue(v));
    const uniqueNormalized = new Set(normalized);
    if (uniqueNormalized.size <= 1) return 'minor';

    // Check for date-like values — date conflicts are always major
    if (values.some((v) => /\d{4}|\d{1,2}\/\d{1,2}/.test(v))) {
      return 'major';
    }

    // Check for company name conflicts — always major
    if (values.length >= 2 && values.every((v) => v.length > 2)) {
      const first = normalized[0];
      const others = normalized.slice(1);
      // If none of the others contain the first (or vice versa), it's major
      const hasOverlap = others.some((o) => o.includes(first) || first.includes(o));
      if (!hasOverlap) return 'major';
    }

    return 'minor';
  }
}
