-- Migration 025: add contact_info to churches
ALTER TABLE churches ADD COLUMN IF NOT EXISTS contact_info text NOT NULL DEFAULT '';
