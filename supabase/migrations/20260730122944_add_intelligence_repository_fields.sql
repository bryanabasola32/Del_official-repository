/*
# Add Executive Intelligence Repository Fields

## Summary
Adds AI-generated intelligence fields to the contacts table and creates
an intelligence_recommendations table for event recommendations. These
store ONLY AI-generated intelligence — client-provided data remains in
the existing columns (industry, linkedin, persona_provided, notes).

## Changes to `contacts` table
1. `persona_type` (text, nullable) — AI-generated persona archetype
   (e.g. "Strategic Innovator", "Growth-Oriented Executive")
2. `decision_style` (text, nullable) — AI-generated decision-making style
   (e.g. "Data-driven", "Consensus Builder")
3. `executive_summary` (text, nullable) — AI-generated executive summary
4. `tech_readiness_level` (text, nullable) — High/Medium/Low badge
5. `tech_readiness_explanation` (text, nullable) — Explanation for tech readiness
6. `sources_verified_count` (integer, nullable) — Number of verified sources
7. `intelligence_notes` (text, nullable) — User notes on the intelligence (editable)
8. `recommendation_status` (text, nullable) — pending/approved/rejected/assigned
9. `assigned_event_id` (uuid, nullable) — FK to events table when assigned

## New table: `intelligence_recommendations`
Stores AI-generated event recommendations per executive.
- `id` (uuid PK)
- `contact_id` (uuid FK to contacts)
- `event_id` (uuid FK to events)
- `reason` (text) — why this event was recommended
- `priority` (text) — high/medium/low
- `suitability_score` (integer) — 0-100 match score
- `status` (text) — pending/approved/rejected/assigned
- `created_at` (timestamp)

## Security
- RLS enabled on intelligence_recommendations with anon+authenticated CRUD
  (single-tenant app, no auth screen)
- Existing contacts policies already cover the new columns

## Important Notes
1. All new columns are nullable — existing rows unaffected
2. These columns store ONLY AI-generated intelligence
3. The `intelligence_notes` field is the ONLY user-editable intelligence field
4. `recommendation_status` and `assigned_event_id` are user-editable for
   approve/reject/assign workflows
*/

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contacts' AND column_name = 'persona_type') THEN
    ALTER TABLE contacts ADD COLUMN persona_type text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contacts' AND column_name = 'decision_style') THEN
    ALTER TABLE contacts ADD COLUMN decision_style text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contacts' AND column_name = 'executive_summary') THEN
    ALTER TABLE contacts ADD COLUMN executive_summary text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contacts' AND column_name = 'tech_readiness_level') THEN
    ALTER TABLE contacts ADD COLUMN tech_readiness_level text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contacts' AND column_name = 'tech_readiness_explanation') THEN
    ALTER TABLE contacts ADD COLUMN tech_readiness_explanation text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contacts' AND column_name = 'sources_verified_count') THEN
    ALTER TABLE contacts ADD COLUMN sources_verified_count integer;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contacts' AND column_name = 'intelligence_notes') THEN
    ALTER TABLE contacts ADD COLUMN intelligence_notes text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contacts' AND column_name = 'recommendation_status') THEN
    ALTER TABLE contacts ADD COLUMN recommendation_status text DEFAULT 'pending';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contacts' AND column_name = 'assigned_event_id') THEN
    ALTER TABLE contacts ADD COLUMN assigned_event_id uuid REFERENCES events(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS intelligence_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  reason text NOT NULL DEFAULT '',
  priority text NOT NULL DEFAULT 'medium',
  suitability_score integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE intelligence_recommendations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_intel_recs" ON intelligence_recommendations;
CREATE POLICY "anon_select_intel_recs" ON intelligence_recommendations FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_intel_recs" ON intelligence_recommendations;
CREATE POLICY "anon_insert_intel_recs" ON intelligence_recommendations FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_intel_recs" ON intelligence_recommendations;
CREATE POLICY "anon_update_intel_recs" ON intelligence_recommendations FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_intel_recs" ON intelligence_recommendations;
CREATE POLICY "anon_delete_intel_recs" ON intelligence_recommendations FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_intel_recs_contact ON intelligence_recommendations(contact_id);
CREATE INDEX IF NOT EXISTS idx_intel_recs_event ON intelligence_recommendations(event_id);
