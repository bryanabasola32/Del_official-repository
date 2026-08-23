/*
# DEL AI — Full Database Schema Recovery

## Summary
Reconstructs the complete DEL AI database schema exactly as it existed across 6 original migrations.
The Supabase project is currently empty. This migration restores all tables, columns, constraints,
indexes, and RLS policies in a single idempotent operation.

## Tables Restored (10 total)
1. `contacts` — Executive roster with client-provided fields + AI-generated intelligence fields
2. `persona_facts` — AI-generated persona facts per contact
3. `sources` — Source citations backing each persona fact
4. `events` — DELCA events with theme, industries, capacity, target companies
5. `event_scores` — Weighted match scores per contact-event pair with recommendation status
6. `invite_drafts` — AI-generated invitation drafts
7. `activity_log` — Immutable audit/delivery history
8. `analysis_runs` — Records each agent pipeline run with metadata
9. `ai_cache` — Caches AI results to avoid redundant API calls
10. `intelligence_recommendations` — AI-generated event recommendations per executive

## Columns per table (final state after all 6 original migrations)

### contacts
- id (uuid PK, default gen_random_uuid())
- name (text, NOT NULL)
- title (text, nullable)
- company (text, NOT NULL)
- email (text, nullable)
- phone (text, nullable)
- decision_making_role (text, CHECK IN budget-holder/influencer/unknown, default 'unknown')
- import_status (text, NOT NULL, CHECK IN imported/duplicate/missing_company/manual, default 'imported')
- persona_status (text, NOT NULL, CHECK IN pending/searching/retrieved/synthesizing/completed/needs_review/low_confidence, default 'pending')
- persona_confidence_level (text, CHECK IN high/medium/low, nullable)
- persona_confidence_pct (integer, nullable)
- last_researched_date (timestamptz, nullable)
- created_at (timestamptz, default now())
- updated_at (timestamptz, default now())
- industry (text, nullable) — client-provided
- linkedin (text, nullable) — client-provided
- persona_provided (text, nullable) — client-provided
- notes (text, nullable) — client-provided
- persona_type (text, nullable) — AI-generated
- decision_style (text, nullable) — AI-generated
- executive_summary (text, nullable) — AI-generated
- tech_readiness_level (text, nullable) — AI-generated
- tech_readiness_explanation (text, nullable) — AI-generated
- sources_verified_count (integer, nullable) — AI-generated
- intelligence_notes (text, nullable) — user-editable
- recommendation_status (text, default 'pending') — user-editable
- assigned_event_id (uuid, FK to events, ON DELETE SET NULL)

### persona_facts
- id (uuid PK)
- contact_id (uuid, NOT NULL, FK to contacts, ON DELETE CASCADE)
- field_type (text, NOT NULL, CHECK IN pain_point/initiative/tech_readiness/professional_interest/decision_making_role/industry/summary)
- value (text, NOT NULL)
- confidence_level (text, NOT NULL, CHECK IN verified/probable/unverified/insufficient_data)
- reasoning_note (text, nullable)
- timeframe (text, nullable)
- order_index (integer, default 0)
- created_at (timestamptz, default now())

### sources
- id (uuid PK)
- persona_fact_id (uuid, NOT NULL, FK to persona_facts, ON DELETE CASCADE)
- url (text, nullable)
- title (text, nullable)
- source_tier (integer, NOT NULL, CHECK IN 1,2,3)
- source_name (text, nullable)
- date_found (timestamptz, default now())
- snippet (text, nullable)
- created_at (timestamptz, default now())

### events
- id (uuid PK)
- event_name (text, NOT NULL)
- theme (text, nullable)
- date (date, nullable)
- venue (text, nullable)
- organizer (text, nullable)
- description (text, nullable)
- target_industries (text[], nullable)
- target_audience (text, nullable)
- primary_theme (text, nullable)
- status (text, NOT NULL, CHECK IN upcoming/active/past/archived, default 'upcoming')
- created_at (timestamptz, default now())
- updated_at (timestamptz, default now())
- max_capacity (integer, nullable)
- time (text, nullable)
- notes (text, nullable)
- target_companies (text[], nullable)

### event_scores
- id (uuid PK)
- contact_id (uuid, NOT NULL, FK to contacts, ON DELETE CASCADE)
- event_id (uuid, NOT NULL, FK to events, ON DELETE CASCADE)
- role_score (integer, default 0)
- industry_score (integer, default 0)
- painpoint_score (integer, default 0)
- techreadiness_score (integer, default 0)
- total_score (integer, default 0)
- confidence_capped (boolean, default false)
- reasoning (text, nullable)
- is_final_attendee (boolean, default false)
- recommendation_status (text, default 'pending')
- scored_at (timestamptz, default now())
- UNIQUE(contact_id, event_id)

### invite_drafts
- id (uuid PK)
- contact_id (uuid, NOT NULL, FK to contacts, ON DELETE CASCADE)
- event_id (uuid, NOT NULL, FK to events, ON DELETE CASCADE)
- subject (text, nullable)
- draft_text (text, NOT NULL)
- cited_fact_ids (uuid[], nullable)
- delivery_channel (text, CHECK IN email/copy_only/sms/teams, default 'email')
- status (text, NOT NULL, CHECK IN draft/sent_test/sent_live/skipped, default 'draft')
- created_at (timestamptz, default now())
- updated_at (timestamptz, default now())

### activity_log
- id (uuid PK)
- action_type (text, NOT NULL)
- related_contact_id (uuid, FK to contacts, ON DELETE SET NULL)
- related_event_id (uuid, FK to events, ON DELETE SET NULL)
- related_invite_id (uuid, FK to invite_drafts, ON DELETE SET NULL)
- status (text, nullable)
- send_mode (text, CHECK IN test/live, nullable)
- resend_delivery_id (text, nullable)
- metadata (jsonb, nullable)
- description (text, nullable)
- timestamp (timestamptz, default now())

### analysis_runs
- id (uuid PK)
- contact_id (uuid, FK to contacts, ON DELETE CASCADE)
- run_type (text, NOT NULL, CHECK IN researcher/verifier/synthesizer/scorer/copywriter/full_pipeline)
- status (text, NOT NULL, CHECK IN queued/running/completed/failed, default 'queued')
- llm_provider (text, nullable)
- search_provider (text, nullable)
- prompt_version (text, nullable)
- token_usage (integer, nullable)
- estimated_cost_usd (numeric(10,6), nullable)
- processing_time_ms (integer, nullable)
- cache_hit (boolean, default false)
- error_message (text, nullable)
- metadata (jsonb, nullable)
- started_at (timestamptz, default now())
- completed_at (timestamptz, nullable)

### ai_cache
- id (uuid PK)
- cache_key (text, UNIQUE, NOT NULL)
- result (jsonb, NOT NULL)
- llm_provider (text, nullable)
- expires_at (timestamptz, nullable)
- created_at (timestamptz, default now())

### intelligence_recommendations
- id (uuid PK)
- contact_id (uuid, NOT NULL, FK to contacts, ON DELETE CASCADE)
- event_id (uuid, NOT NULL, FK to events, ON DELETE CASCADE)
- reason (text, NOT NULL, default '')
- priority (text, NOT NULL, default 'medium')
- suitability_score (integer, NOT NULL, default 0)
- status (text, NOT NULL, default 'pending')
- created_at (timestamptz, default now())

## Security
- RLS enabled on ALL tables
- anon + authenticated can read/write (single-tenant prototype, no auth screen)
- 4 policies per table (SELECT, INSERT, UPDATE, DELETE)

## Indexes
- idx_contacts_company, idx_contacts_persona_status, idx_contacts_industry
- idx_persona_facts_contact_id, idx_persona_facts_field_type
- idx_sources_persona_fact_id
- idx_event_scores_contact_id, idx_event_scores_event_id, idx_event_scores_total_score
- idx_invite_drafts_contact_id, idx_invite_drafts_event_id
- idx_activity_log_timestamp, idx_activity_log_action_type
- idx_analysis_runs_contact_id
- idx_ai_cache_key
- idx_intel_recs_contact, idx_intel_recs_event

## Important Notes
1. This migration is fully idempotent — safe to re-run.
2. All tables use IF NOT EXISTS; all policies use DROP IF EXISTS before CREATE.
3. Column additions use DO $$ IF NOT EXISTS blocks.
4. The contacts.assigned_event_id FK references events(id) — events table is created first.
*/

-- =====================
-- CONTACTS
-- =====================
CREATE TABLE IF NOT EXISTS contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  title text,
  company text NOT NULL,
  email text,
  phone text,
  decision_making_role text CHECK (decision_making_role IN ('budget-holder', 'influencer', 'unknown')) DEFAULT 'unknown',
  import_status text NOT NULL DEFAULT 'imported' CHECK (import_status IN ('imported', 'duplicate', 'missing_company', 'manual')),
  persona_status text NOT NULL DEFAULT 'pending' CHECK (persona_status IN ('pending', 'searching', 'retrieved', 'synthesizing', 'completed', 'needs_review', 'low_confidence')),
  persona_confidence_level text CHECK (persona_confidence_level IN ('high', 'medium', 'low')),
  persona_confidence_pct integer,
  last_researched_date timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_contacts" ON contacts;
CREATE POLICY "anon_select_contacts" ON contacts FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_contacts" ON contacts;
CREATE POLICY "anon_insert_contacts" ON contacts FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_contacts" ON contacts;
CREATE POLICY "anon_update_contacts" ON contacts FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_contacts" ON contacts;
CREATE POLICY "anon_delete_contacts" ON contacts FOR DELETE TO anon, authenticated USING (true);

-- =====================
-- PERSONA FACTS
-- =====================
CREATE TABLE IF NOT EXISTS persona_facts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  field_type text NOT NULL CHECK (field_type IN ('pain_point', 'initiative', 'tech_readiness', 'professional_interest', 'decision_making_role', 'industry', 'summary')),
  value text NOT NULL,
  confidence_level text NOT NULL CHECK (confidence_level IN ('verified', 'probable', 'unverified', 'insufficient_data')),
  reasoning_note text,
  timeframe text,
  order_index integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE persona_facts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_persona_facts" ON persona_facts;
CREATE POLICY "anon_select_persona_facts" ON persona_facts FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_persona_facts" ON persona_facts;
CREATE POLICY "anon_insert_persona_facts" ON persona_facts FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_persona_facts" ON persona_facts;
CREATE POLICY "anon_update_persona_facts" ON persona_facts FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_persona_facts" ON persona_facts;
CREATE POLICY "anon_delete_persona_facts" ON persona_facts FOR DELETE TO anon, authenticated USING (true);

-- =====================
-- SOURCES
-- =====================
CREATE TABLE IF NOT EXISTS sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_fact_id uuid NOT NULL REFERENCES persona_facts(id) ON DELETE CASCADE,
  url text,
  title text,
  source_tier integer NOT NULL CHECK (source_tier IN (1, 2, 3)),
  source_name text,
  date_found timestamptz DEFAULT now(),
  snippet text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE sources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_sources" ON sources;
CREATE POLICY "anon_select_sources" ON sources FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_sources" ON sources;
CREATE POLICY "anon_insert_sources" ON sources FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_sources" ON sources;
CREATE POLICY "anon_update_sources" ON sources FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_sources" ON sources;
CREATE POLICY "anon_delete_sources" ON sources FOR DELETE TO anon, authenticated USING (true);

-- =====================
-- EVENTS
-- =====================
CREATE TABLE IF NOT EXISTS events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_name text NOT NULL,
  theme text,
  date date,
  venue text,
  organizer text,
  description text,
  target_industries text[],
  target_audience text,
  primary_theme text,
  status text NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'active', 'past', 'archived')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_events" ON events;
CREATE POLICY "anon_select_events" ON events FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_events" ON events;
CREATE POLICY "anon_insert_events" ON events FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_events" ON events;
CREATE POLICY "anon_update_events" ON events FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_events" ON events;
CREATE POLICY "anon_delete_events" ON events FOR DELETE TO anon, authenticated USING (true);

-- =====================
-- EVENT SCORES
-- =====================
CREATE TABLE IF NOT EXISTS event_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  role_score integer DEFAULT 0,
  industry_score integer DEFAULT 0,
  painpoint_score integer DEFAULT 0,
  techreadiness_score integer DEFAULT 0,
  total_score integer DEFAULT 0,
  confidence_capped boolean DEFAULT false,
  reasoning text,
  is_final_attendee boolean DEFAULT false,
  scored_at timestamptz DEFAULT now(),
  UNIQUE(contact_id, event_id)
);

ALTER TABLE event_scores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_event_scores" ON event_scores;
CREATE POLICY "anon_select_event_scores" ON event_scores FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_event_scores" ON event_scores;
CREATE POLICY "anon_insert_event_scores" ON event_scores FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_event_scores" ON event_scores;
CREATE POLICY "anon_update_event_scores" ON event_scores FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_event_scores" ON event_scores;
CREATE POLICY "anon_delete_event_scores" ON event_scores FOR DELETE TO anon, authenticated USING (true);

-- =====================
-- INVITE DRAFTS
-- =====================
CREATE TABLE IF NOT EXISTS invite_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  subject text,
  draft_text text NOT NULL,
  cited_fact_ids uuid[],
  delivery_channel text DEFAULT 'email' CHECK (delivery_channel IN ('email', 'copy_only', 'sms', 'teams')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent_test', 'sent_live', 'skipped')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE invite_drafts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_invite_drafts" ON invite_drafts;
CREATE POLICY "anon_select_invite_drafts" ON invite_drafts FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_invite_drafts" ON invite_drafts;
CREATE POLICY "anon_insert_invite_drafts" ON invite_drafts FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_invite_drafts" ON invite_drafts;
CREATE POLICY "anon_update_invite_drafts" ON invite_drafts FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_invite_drafts" ON invite_drafts;
CREATE POLICY "anon_delete_invite_drafts" ON invite_drafts FOR DELETE TO anon, authenticated USING (true);

-- =====================
-- ACTIVITY LOG
-- =====================
CREATE TABLE IF NOT EXISTS activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type text NOT NULL,
  related_contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL,
  related_event_id uuid REFERENCES events(id) ON DELETE SET NULL,
  related_invite_id uuid REFERENCES invite_drafts(id) ON DELETE SET NULL,
  status text,
  send_mode text CHECK (send_mode IN ('test', 'live')),
  resend_delivery_id text,
  metadata jsonb,
  description text,
  timestamp timestamptz DEFAULT now()
);

ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_activity_log" ON activity_log;
CREATE POLICY "anon_select_activity_log" ON activity_log FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_activity_log" ON activity_log;
CREATE POLICY "anon_insert_activity_log" ON activity_log FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_activity_log" ON activity_log;
CREATE POLICY "anon_update_activity_log" ON activity_log FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_activity_log" ON activity_log;
CREATE POLICY "anon_delete_activity_log" ON activity_log FOR DELETE TO anon, authenticated USING (true);

-- =====================
-- ANALYSIS RUNS
-- =====================
CREATE TABLE IF NOT EXISTS analysis_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid REFERENCES contacts(id) ON DELETE CASCADE,
  run_type text NOT NULL CHECK (run_type IN ('researcher', 'verifier', 'synthesizer', 'scorer', 'copywriter', 'full_pipeline')),
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'completed', 'failed')),
  llm_provider text,
  search_provider text,
  prompt_version text,
  token_usage integer,
  estimated_cost_usd numeric(10,6),
  processing_time_ms integer,
  cache_hit boolean DEFAULT false,
  error_message text,
  metadata jsonb,
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

ALTER TABLE analysis_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_analysis_runs" ON analysis_runs;
CREATE POLICY "anon_select_analysis_runs" ON analysis_runs FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_analysis_runs" ON analysis_runs;
CREATE POLICY "anon_insert_analysis_runs" ON analysis_runs FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_analysis_runs" ON analysis_runs;
CREATE POLICY "anon_update_analysis_runs" ON analysis_runs FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_analysis_runs" ON analysis_runs;
CREATE POLICY "anon_delete_analysis_runs" ON analysis_runs FOR DELETE TO anon, authenticated USING (true);

-- =====================
-- AI CACHE
-- =====================
CREATE TABLE IF NOT EXISTS ai_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key text UNIQUE NOT NULL,
  result jsonb NOT NULL,
  llm_provider text,
  expires_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE ai_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_ai_cache" ON ai_cache;
CREATE POLICY "anon_select_ai_cache" ON ai_cache FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_ai_cache" ON ai_cache;
CREATE POLICY "anon_insert_ai_cache" ON ai_cache FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_ai_cache" ON ai_cache;
CREATE POLICY "anon_update_ai_cache" ON ai_cache FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_ai_cache" ON ai_cache;
CREATE POLICY "anon_delete_ai_cache" ON ai_cache FOR DELETE TO anon, authenticated USING (true);

-- =====================
-- INTELLIGENCE RECOMMENDATIONS
-- =====================
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

-- =====================
-- ADDITIONAL COLUMNS (from migrations 3-6)
-- =====================

-- Migration 3: Executive client-provided fields
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

-- Migration 4: Intelligence repository fields on contacts
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

-- Migration 5: Event management fields
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'events' AND column_name = 'max_capacity') THEN
    ALTER TABLE events ADD COLUMN max_capacity integer;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'events' AND column_name = 'time') THEN
    ALTER TABLE events ADD COLUMN time text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'events' AND column_name = 'notes') THEN
    ALTER TABLE events ADD COLUMN notes text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'event_scores' AND column_name = 'recommendation_status') THEN
    ALTER TABLE event_scores ADD COLUMN recommendation_status text DEFAULT 'pending';
  END IF;
END $$;

-- Migration 6: Target companies on events
ALTER TABLE events ADD COLUMN IF NOT EXISTS target_companies text[];

-- =====================
-- INDEXES
-- =====================
CREATE INDEX IF NOT EXISTS idx_contacts_company ON contacts(company);
CREATE INDEX IF NOT EXISTS idx_contacts_persona_status ON contacts(persona_status);
CREATE INDEX IF NOT EXISTS idx_contacts_industry ON contacts(industry);
CREATE INDEX IF NOT EXISTS idx_persona_facts_contact_id ON persona_facts(contact_id);
CREATE INDEX IF NOT EXISTS idx_persona_facts_field_type ON persona_facts(field_type);
CREATE INDEX IF NOT EXISTS idx_sources_persona_fact_id ON sources(persona_fact_id);
CREATE INDEX IF NOT EXISTS idx_event_scores_contact_id ON event_scores(contact_id);
CREATE INDEX IF NOT EXISTS idx_event_scores_event_id ON event_scores(event_id);
CREATE INDEX IF NOT EXISTS idx_event_scores_total_score ON event_scores(total_score DESC);
CREATE INDEX IF NOT EXISTS idx_invite_drafts_contact_id ON invite_drafts(contact_id);
CREATE INDEX IF NOT EXISTS idx_invite_drafts_event_id ON invite_drafts(event_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_timestamp ON activity_log(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_activity_log_action_type ON activity_log(action_type);
CREATE INDEX IF NOT EXISTS idx_analysis_runs_contact_id ON analysis_runs(contact_id);
CREATE INDEX IF NOT EXISTS idx_ai_cache_key ON ai_cache(cache_key);
CREATE INDEX IF NOT EXISTS idx_intel_recs_contact ON intelligence_recommendations(contact_id);
CREATE INDEX IF NOT EXISTS idx_intel_recs_event ON intelligence_recommendations(event_id);