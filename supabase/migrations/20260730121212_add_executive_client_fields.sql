/*
# Add Executive Client-Provided Fields

## Summary
Adds fields to the `contacts` table that store ONLY client-provided information,
separate from AI-generated intelligence. These fields let the Executive List serve
as the primary input database for DEL's intelligence pipeline.

## Changes to `contacts` table
1. `industry` (text, nullable) — client-provided industry classification
2. `linkedin` (text, nullable) — client-provided LinkedIn profile URL
3. `persona_provided` (text, nullable) — persona description supplied by the client
4. `notes` (text, nullable) — free-form client notes

## Security
- No RLS policy changes — existing anon+authenticated CRUD policies already cover these new columns.
- These columns store ONLY client-provided data; AI-generated intelligence lives in `persona_facts`.

## Important Notes
1. All new columns are nullable so existing rows are unaffected.
2. No AI-generated fields (pain points, tech readiness, confidence, etc.) are added here —
   those belong to the `persona_facts` table and Executive Intelligence module.
*/

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contacts' AND column_name = 'industry') THEN
    ALTER TABLE contacts ADD COLUMN industry text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contacts' AND column_name = 'linkedin') THEN
    ALTER TABLE contacts ADD COLUMN linkedin text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contacts' AND column_name = 'persona_provided') THEN
    ALTER TABLE contacts ADD COLUMN persona_provided text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contacts' AND column_name = 'notes') THEN
    ALTER TABLE contacts ADD COLUMN notes text;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_contacts_industry ON contacts(industry);
