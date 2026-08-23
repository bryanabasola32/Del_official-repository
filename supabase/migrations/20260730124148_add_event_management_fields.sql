/*
# Add Event Management Fields

## Summary
Adds fields needed for the Sprint 4 Event Management workflow:
1. `max_capacity` and `time` and `notes` columns on the events table
2. `recommendation_status` column on event_scores for approve/reject workflow

## Changes to `events` table
- `max_capacity` (integer, nullable) — maximum capacity
- `time` (text, nullable) — event time (e.g. "9:00 AM")
- `notes` (text, nullable) — event notes

## Changes to `event_scores` table
- `recommendation_status` (text, nullable, default 'pending') — pending/approved/rejected
  Tracks whether the event manager approved or rejected this recommendation.

## Security
- Existing RLS policies on events and event_scores already cover these columns
*/

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
