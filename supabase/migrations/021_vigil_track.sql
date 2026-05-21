-- 021_vigil_track.sql
-- Adds 守望互助 (vigil) track to the accountability system.
-- Safe to run multiple times (IF NOT EXISTS / DO NOTHING guards throughout).

-- 1. Add group_type to accountability_groups (default 'daily' preserves all existing rows)
ALTER TABLE accountability_groups
  ADD COLUMN IF NOT EXISTS group_type TEXT NOT NULL DEFAULT 'daily'
  CHECK (group_type IN ('daily', 'vigil'));

-- 2. Vigil presences — one record per member per day per group
CREATE TABLE IF NOT EXISTS accountability_vigil_presences (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id      UUID        NOT NULL REFERENCES accountability_groups(id) ON DELETE CASCADE,
  user_id       UUID        NOT NULL REFERENCES auth.users(id),
  presence_date DATE        NOT NULL DEFAULT CURRENT_DATE,
  note          TEXT        CHECK (char_length(note) <= 100),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (group_id, user_id, presence_date)
);

CREATE INDEX IF NOT EXISTS vigil_presences_group_date ON accountability_vigil_presences(group_id, presence_date);
CREATE INDEX IF NOT EXISTS vigil_presences_user       ON accountability_vigil_presences(user_id);
