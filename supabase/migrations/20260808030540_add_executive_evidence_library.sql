/*
# Add Executive Evidence Library (Plan B)

1. New Table
- `executive_evidence_library` — stores curated evidence packages that serve as
  an enrichment fallback when live research produces insufficient evidence.
  - `id` (uuid, PK)
  - `contact_id` (uuid, NOT NULL, references contacts(id) ON DELETE CASCADE)
  - `version` (integer, NOT NULL, default 1) — increments for each new import
  - `status` (text, NOT NULL, default 'active') — 'draft' | 'active' | 'archived'
  - `evidence_package` (jsonb, NOT NULL) — the full normalized EvidencePackage JSON
  - `evidence_trust_score` (integer, NOT NULL, default 0) — trust score at import time
  - `evidence_completeness` (integer, NOT NULL, default 0) — completeness score
  - `source_count` (integer, NOT NULL, default 0) — number of sources in the package
  - `fact_count` (integer, NOT NULL, default 0) — number of facts in the package
  - `provider` (text, NOT NULL, default 'curated') — always 'curated' for Plan B
  - `imported_at` (timestamptz, NOT NULL, default now())
  - `updated_at` (timestamptz, NOT NULL, default now())
  - `notes` (text, nullable) — optional importer notes
  - UNIQUE(contact_id, version) — prevents duplicate active versions

2. Security
- Enable RLS on `executive_evidence_library`.
- Follow existing DEL convention: `TO anon, authenticated` for all CRUD operations.
  The DEL app uses the anon-key client (single-tenant pattern), so anon must have access.

3. Indexes
- `idx_evidence_library_contact_status` — fast lookup of active package by contact
- `idx_evidence_library_contact_version` — version queries
- `idx_evidence_library_status` — filtering by status

4. Important Notes
- This table is ADDITIVE — it does not modify any existing DEL tables.
- The UNIQUE(contact_id, version) constraint ensures no duplicate active versions.
- Versioning is handled at the application layer: importing a new version archives
  the previous active version before inserting the new one.
- The `evidence_package` jsonb column stores the full normalized EvidencePackage
  object so it can be reconstructed without additional queries.
*/

CREATE TABLE IF NOT EXISTS executive_evidence_library (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  version integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'active', 'archived')),
  evidence_package jsonb NOT NULL,
  evidence_trust_score integer NOT NULL DEFAULT 0,
  evidence_completeness integer NOT NULL DEFAULT 0,
  source_count integer NOT NULL DEFAULT 0,
  fact_count integer NOT NULL DEFAULT 0,
  provider text NOT NULL DEFAULT 'curated',
  imported_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  notes text,
  UNIQUE(contact_id, version)
);

ALTER TABLE executive_evidence_library ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_evidence_library" ON executive_evidence_library;
CREATE POLICY "anon_select_evidence_library" ON executive_evidence_library FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_evidence_library" ON executive_evidence_library;
CREATE POLICY "anon_insert_evidence_library" ON executive_evidence_library FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_evidence_library" ON executive_evidence_library;
CREATE POLICY "anon_update_evidence_library" ON executive_evidence_library FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_evidence_library" ON executive_evidence_library;
CREATE POLICY "anon_delete_evidence_library" ON executive_evidence_library FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_evidence_library_contact_status
  ON executive_evidence_library(contact_id, status);

CREATE INDEX IF NOT EXISTS idx_evidence_library_contact_version
  ON executive_evidence_library(contact_id, version DESC);

CREATE INDEX IF NOT EXISTS idx_evidence_library_status
  ON executive_evidence_library(status);
