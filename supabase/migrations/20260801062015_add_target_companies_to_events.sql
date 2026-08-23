/*
# Add target_companies column to events table

1. Changes
- Adds `target_companies` (text[]) column to the `events` table.
- This column stores the list of target company names parsed from
  spreadsheet imports (e.g. "Ayala Land, Vista Land, Filinvest" becomes
  ["Ayala Land", "Vista Land", "Filinvest"]).
- Supports future Executive Recommendation matching by allowing
  event-to-executive company alignment.
- Nullable: existing events don't need this field populated.
2. Security
- No RLS policy changes — events table already has policies.
- The new column inherits existing access controls.
*/

ALTER TABLE events ADD COLUMN IF NOT EXISTS target_companies text[];
