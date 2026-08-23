import { supabase } from '@/lib/supabase';
import type { EvidencePackage, ConfidenceBreakdown } from '../research/EvidencePackage';
import type { EvidenceLibraryRow, RawCuratedPackage, ValidationResult, IdentityMatchResult } from './CuratedEvidenceTypes';
import { CuratedEvidenceAdapter } from './CuratedEvidenceAdapter';
import type { Contact } from '@/lib/types';
import { getExecutionLogger } from '../logging';

/*
 * CuratedEvidenceLibrary — persistence layer for the Executive Evidence
 * Library (Plan B).
 *
 * Supabase is the source of truth. The memory cache is an optional
 * optimization only.
 *
 * Responsibilities:
 *   - getActivePackage(contactId)
 *   - savePackage(contactId, rawPackage, contact)
 *   - archivePreviousVersion(contactId)
 *   - getVersion(contactId, version)
 *   - hasNewerVersion(contactId, cachedVersion)
 *   - listAll()
 */

const logger = getExecutionLogger();

export class CuratedEvidenceLibrary {
  private adapter: CuratedEvidenceAdapter;

  constructor(adapter?: CuratedEvidenceAdapter) {
    this.adapter = adapter ?? new CuratedEvidenceAdapter();
  }

  /** Get the active curated package for a contact. Returns null if none or on error. */
  async getActivePackage(contactId: string): Promise<EvidencePackage | null> {
    try {
      const { data, error } = await supabase
        .from('executive_evidence_library')
        .select('*')
        .eq('contact_id', contactId)
        .eq('status', 'active')
        .maybeSingle();

      if (error) {
        logger.warning('evidence_library', `Query failed for contact ${contactId}: ${error.message}`);
        return null;
      }
      if (!data) return null;

      const row = data as EvidenceLibraryRow;
      return this.deserializePackage(row.evidence_package as unknown as Record<string, unknown>);
    } catch (err) {
      logger.warning('evidence_library', `getActivePackage failed: ${err instanceof Error ? err.message : 'unknown'}`);
      return null;
    }
  }

  /** Get metadata about the active package without the full JSON. */
  async getActivePackageMeta(contactId: string): Promise<EvidenceLibraryRow | null> {
    try {
      const { data, error } = await supabase
        .from('executive_evidence_library')
        .select('id, contact_id, version, status, evidence_trust_score, evidence_completeness, source_count, fact_count, provider, imported_at, updated_at, notes')
        .eq('contact_id', contactId)
        .eq('status', 'active')
        .maybeSingle();

      if (error || !data) return null;
      return data as EvidenceLibraryRow;
    } catch {
      return null;
    }
  }

  /** Save a new curated package. Archives any previous active version. */
  async savePackage(
    contactId: string,
    raw: RawCuratedPackage,
    contact: Pick<Contact, 'id' | 'name' | 'title' | 'company'>,
    notes?: string,
  ): Promise<{ success: boolean; version: number; errors: string[] }> {
    const errors: string[] = [];

    // Step 1: Validate the raw package structure
    const validation = this.adapter.validate(raw);
    if (!validation.valid) {
      return { success: false, version: 0, errors: validation.errors };
    }

    // Step 2: Validate identity
    const identityMatch = this.adapter.validateIdentity(
      validation.identity.name,
      validation.identity.company,
      contact,
    );
    if (!identityMatch.matched) {
      return { success: false, version: 0, errors: identityMatch.reasons };
    }

    // Step 3: Normalize to DEL EvidencePackage
    const evidencePackage = this.adapter.toEvidencePackage(raw, contact);

    // Step 4: Determine the next version number
    const nextVersion = await this.getNextVersion(contactId);

    // Step 5: Archive any existing active version
    await this.archivePreviousVersion(contactId);

    // Step 6: Insert the new active package
    const { error } = await supabase
      .from('executive_evidence_library')
      .insert({
        contact_id: contactId,
        version: nextVersion,
        status: 'active',
        evidence_package: this.serializePackage(evidencePackage),
        evidence_trust_score: 0,
        evidence_completeness: 0,
        source_count: validation.sourceCount,
        fact_count: validation.factCount,
        provider: 'curated',
        notes: notes || null,
      });

    if (error) {
      errors.push(`Database insert failed: ${error.message}`);
      return { success: false, version: 0, errors };
    }

    logger.info('evidence_library', `Saved curated package v${nextVersion} for contact ${contactId}`);

    return { success: true, version: nextVersion, errors: [] };
  }

  /** Archive the current active version for a contact. */
  async archivePreviousVersion(contactId: string): Promise<void> {
    try {
      await supabase
        .from('executive_evidence_library')
        .update({ status: 'archived', updated_at: new Date().toISOString() })
        .eq('contact_id', contactId)
        .eq('status', 'active');
    } catch (err) {
      logger.warning('evidence_library', `archivePreviousVersion failed: ${err instanceof Error ? err.message : 'unknown'}`);
    }
  }

  /** Explicitly archive a specific version. */
  async archiveVersion(contactId: string, version: number): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('executive_evidence_library')
        .update({ status: 'archived', updated_at: new Date().toISOString() })
        .eq('contact_id', contactId)
        .eq('version', version);
      return !error;
    } catch {
      return false;
    }
  }

  /** Get a specific version of a package. */
  async getVersion(contactId: string, version: number): Promise<EvidencePackage | null> {
    try {
      const { data, error } = await supabase
        .from('executive_evidence_library')
        .select('*')
        .eq('contact_id', contactId)
        .eq('version', version)
        .maybeSingle();

      if (error || !data) return null;
      const row = data as EvidenceLibraryRow;
      return this.deserializePackage(row.evidence_package as unknown as Record<string, unknown>);
    } catch {
      return null;
    }
  }

  /** Check if a newer version exists than the cached one. */
  async hasNewerVersion(contactId: string, cachedVersion: number): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('executive_evidence_library')
        .select('version')
        .eq('contact_id', contactId)
        .eq('status', 'active')
        .maybeSingle();

      if (error || !data) return false;
      return (data as { version: number }).version > cachedVersion;
    } catch {
      return false;
    }
  }

  /** Get the active version number for a contact (0 if none). */
  async getActiveVersion(contactId: string): Promise<number> {
    try {
      const { data } = await supabase
        .from('executive_evidence_library')
        .select('version')
        .eq('contact_id', contactId)
        .eq('status', 'active')
        .maybeSingle();
      return data ? (data as { version: number }).version : 0;
    } catch {
      return 0;
    }
  }

  /** List all active packages with metadata (for the library view). */
  async listAll(): Promise<EvidenceLibraryRow[]> {
    try {
      const { data, error } = await supabase
        .from('executive_evidence_library')
        .select('id, contact_id, version, status, evidence_trust_score, evidence_completeness, source_count, fact_count, provider, imported_at, updated_at, notes')
        .eq('status', 'active')
        .order('imported_at', { ascending: false });

      if (error || !data) return [];
      return data as EvidenceLibraryRow[];
    } catch {
      return [];
    }
  }

  /** Validate a raw package without saving (for UI preview). */
  validatePackage(raw: RawCuratedPackage): ValidationResult {
    return this.adapter.validate(raw);
  }

  /** Validate identity without saving (for UI preview). */
  validateIdentity(
    raw: RawCuratedPackage,
    contact: Pick<Contact, 'id' | 'name' | 'title' | 'company'>,
  ): IdentityMatchResult {
    const validation = this.adapter.validate(raw);
    return this.adapter.validateIdentity(
      validation.identity.name,
      validation.identity.company,
      contact,
    );
  }

  /** Preview a raw package as a DEL EvidencePackage without saving. */
  previewPackage(
    raw: RawCuratedPackage,
    contact: Pick<Contact, 'id' | 'name' | 'title' | 'company'>,
  ): EvidencePackage {
    return this.adapter.toEvidencePackage(raw, contact);
  }

  // ── Private helpers ──

  private async getNextVersion(contactId: string): Promise<number> {
    const { data } = await supabase
      .from('executive_evidence_library')
      .select('version')
      .eq('contact_id', contactId)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!data) return 1;
    return (data as { version: number }).version + 1;
  }

  /**
   * Serialize an EvidencePackage for JSONB storage.
   * The confidenceBreakdown Map is converted to a plain object since JSON
   * does not support Map.
   */
  private serializePackage(pkg: EvidencePackage): Record<string, unknown> {
    const { confidenceBreakdown, ...rest } = pkg;
    const breakdownObj: Record<string, unknown> = {};
    for (const [key, value] of confidenceBreakdown.entries()) {
      breakdownObj[key] = value;
    }
    return { ...rest, confidenceBreakdown: breakdownObj } as Record<string, unknown>;
  }

  /** Deserialize an EvidencePackage from JSONB storage. */
  private deserializePackage(raw: Record<string, unknown>): EvidencePackage {
    const breakdownMap = new Map<string, ConfidenceBreakdown>();
    const cb = raw.confidenceBreakdown as Record<string, unknown> | undefined;
    if (cb && typeof cb === 'object') {
      for (const [key, value] of Object.entries(cb)) {
        if (value && typeof value === 'object') {
          breakdownMap.set(key, value as ConfidenceBreakdown);
        }
      }
    }
    return { ...(raw as unknown as EvidencePackage), confidenceBreakdown: breakdownMap };
  }
}

// ── Singleton ────────────────────────────────────────

let _library: CuratedEvidenceLibrary | null = null;

export function getCuratedEvidenceLibrary(): CuratedEvidenceLibrary {
  if (!_library) {
    _library = new CuratedEvidenceLibrary();
  }
  return _library;
}
