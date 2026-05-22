-- Migration 026: per-user notification preferences
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS notification_prefs jsonb NOT NULL
  DEFAULT '{"morning":true,"checkin":true,"vigil":true,"sunday":true,"monthly":true}';
