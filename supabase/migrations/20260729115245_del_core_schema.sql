/*
# Del AI — Core Database Schema

## Summary
Creates the full Del AI platform schema for DELCA VisionTech.
All tables use RLS with anon+authenticated access (single-tenant prototype with optional auth).

## Tables Created
1. `contacts` — Executive roster (imported or manually added)
2. `persona_facts` — Enriched AI-generated facts per contact
3. `sources` — Source citations backing each persona fact
4. `events` — DELCA events with theme and target industries
5. `event_scores` — Weighted match scores per contact-event pair
6. `invite_drafts` — AI-generated invitation drafts
7. `activity_log` — Immutable audit/delivery history
8. `analysis_runs` — Records each agent pipeline run with metadata
9. `ai_cache` — Caches AI results to avoid redundant API calls

## Security
- RLS enabled on all tables
- anon + authenticated can read/write (prototype single-tenant mode)
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

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_contacts_company ON contacts(company);
CREATE INDEX IF NOT EXISTS idx_contacts_persona_status ON contacts(persona_status);
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
