/*
# Add conversations and messages tables for DEL AI chat persistence

1. New Tables
- `conversations` — stores chat sessions for each authenticated user
  - id (uuid, PK)
  - user_id (uuid, NOT NULL, DEFAULT auth.uid(), references auth.users)
  - title (text, not null) — auto-generated from first message or user-renamed
  - executive_id (uuid, nullable, references contacts) — linked executive if any
  - research_job_id (uuid, nullable) — linked research job if any
  - report_ids (text[], nullable) — array of intelligence report IDs referenced
  - created_at (timestamptz, default now())
  - updated_at (timestamptz, default now())
- `chat_messages` — stores individual messages within a conversation
  - id (uuid, PK)
  - conversation_id (uuid, NOT NULL, references conversations ON DELETE CASCADE)
  - user_id (uuid, NOT NULL, DEFAULT auth.uid(), references auth.users)
  - role (text, not null) — 'user' | 'assistant'
  - content (text, not null) — the message text
  - metadata (jsonb, nullable) — structured data: thinking stages, provider info, citations, executive references, etc.
  - created_at (timestamptz, default now())

2. Security
- Enable RLS on both tables.
- Owner-scoped CRUD: each authenticated user can only access their own conversations and messages.
- user_id defaults to auth.uid() so inserts that omit it still succeed.
- chat_messages policies check ownership via the parent conversation.

3. Indexes
- conversations(user_id, updated_at DESC) — for listing recent chats
- chat_messages(conversation_id, created_at ASC) — for loading message history
*/

CREATE TABLE IF NOT EXISTS conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'New Conversation',
  executive_id uuid REFERENCES contacts(id) ON DELETE SET NULL,
  research_job_id uuid,
  report_ids text[] DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_conversations" ON conversations;
CREATE POLICY "select_own_conversations" ON conversations FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_conversations" ON conversations;
CREATE POLICY "insert_own_conversations" ON conversations FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_conversations" ON conversations;
CREATE POLICY "update_own_conversations" ON conversations FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_conversations" ON conversations;
CREATE POLICY "delete_own_conversations" ON conversations FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_conversations_user_updated ON conversations(user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_messages" ON chat_messages;
CREATE POLICY "select_own_messages" ON chat_messages FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_messages" ON chat_messages;
CREATE POLICY "insert_own_messages" ON chat_messages FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_messages" ON chat_messages;
CREATE POLICY "update_own_messages" ON chat_messages FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_messages" ON chat_messages;
CREATE POLICY "delete_own_messages" ON chat_messages FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_created ON chat_messages(conversation_id, created_at ASC);
