-- ============================================================
-- 麦穗喜乐 (Maisui Joy) — 001 Core Schema
-- ============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_cron";     -- enable via Supabase Dashboard → Extensions

-- ──────────────────────────────────────────────
-- 1. users  (mirrors auth.users)
-- ──────────────────────────────────────────────
CREATE TABLE public.users (
  id            UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name  TEXT        NOT NULL,
  role          TEXT        NOT NULL DEFAULT 'member'
                            CHECK (role IN ('member', 'leader')),
  -- settings JSON: { "elder_mode": boolean }
  settings      JSONB       NOT NULL DEFAULT '{"elder_mode": false}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-populate users row on sign-up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.users (id, display_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Keep updated_at fresh
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

CREATE TRIGGER users_touch_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE PROCEDURE public.touch_updated_at();

-- ──────────────────────────────────────────────
-- 2. fellowships  (小组)
-- ──────────────────────────────────────────────
CREATE TABLE public.fellowships (
  id           UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT    NOT NULL,
  -- 6-digit alphanumeric invite code, unique, uppercase
  invite_code  CHAR(6) NOT NULL UNIQUE,
  leader_id    UUID    NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Generate a random 6-char uppercase invite code
CREATE OR REPLACE FUNCTION public.generate_invite_code()
RETURNS CHAR(6) LANGUAGE plpgsql AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- no ambiguous chars
  code  TEXT := '';
  i     INT;
BEGIN
  FOR i IN 1..6 LOOP
    code := code || substr(chars, (floor(random() * length(chars)) + 1)::INT, 1);
  END LOOP;
  RETURN code;
END;
$$;

-- Auto-assign invite_code on insert if not provided
CREATE OR REPLACE FUNCTION public.assign_invite_code()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE attempts INT := 0;
BEGIN
  WHILE NEW.invite_code IS NULL OR EXISTS (
    SELECT 1 FROM public.fellowships WHERE invite_code = NEW.invite_code
  ) LOOP
    NEW.invite_code := public.generate_invite_code();
    attempts := attempts + 1;
    IF attempts > 20 THEN RAISE EXCEPTION 'invite code collision loop'; END IF;
  END LOOP;
  RETURN NEW;
END;
$$;

CREATE TRIGGER fellowships_assign_invite_code
  BEFORE INSERT ON public.fellowships
  FOR EACH ROW EXECUTE PROCEDURE public.assign_invite_code();

-- ──────────────────────────────────────────────
-- 3. fellowship_members  (小组成员 N:N)
-- ──────────────────────────────────────────────
CREATE TABLE public.fellowship_members (
  fellowship_id  UUID NOT NULL REFERENCES public.fellowships(id) ON DELETE CASCADE,
  user_id        UUID NOT NULL REFERENCES public.users(id)       ON DELETE CASCADE,
  -- Pseudonym visible to the group leader only (隐私层 Layer 2)
  layer2_label   TEXT NOT NULL DEFAULT '',
  joined_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (fellowship_id, user_id)
);

-- ──────────────────────────────────────────────
-- 4. daily_alignments  (每日对齐)
--    ai_summary_enc: AES-256-GCM encrypted in application layer,
--    stored as BYTEA.  Key lives in server env only.
-- ──────────────────────────────────────────────
CREATE TABLE public.daily_alignments (
  id              UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID    NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  -- e.g. "平安" | "负担" | "感恩" | "寻求" | "疲惫"
  status_tag      TEXT    NOT NULL,
  theme_tags      TEXT[]  NOT NULL DEFAULT '{}',
  -- Encrypted 140-char AI summary (application-level AES-256-GCM)
  ai_summary_enc  BYTEA,
  -- 安全红线: set FALSE by midnight cron → evicts from all public views
  is_visible      BOOLEAN NOT NULL DEFAULT TRUE,
  date            DATE    NOT NULL DEFAULT CURRENT_DATE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, date)
);

-- ──────────────────────────────────────────────
-- 5. journeys  (灵程日记, 7-day TTL, physical delete enforced)
-- ──────────────────────────────────────────────
CREATE TABLE public.journeys (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  alignment_id   UUID REFERENCES public.daily_alignments(id) ON DELETE SET NULL,
  -- Encrypted journal text (application-level AES-256-GCM)
  content_enc    BYTEA NOT NULL,
  expires_at     TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX journeys_expires_at_idx ON public.journeys (expires_at);

-- ──────────────────────────────────────────────
-- 6. Public views (hide non-visible data)
-- ──────────────────────────────────────────────
CREATE VIEW public.visible_alignments AS
  SELECT * FROM public.daily_alignments WHERE is_visible = TRUE;
