-- ============================================================
-- 麦穗喜乐 — 010 Spiritual Logs + Auth Signup Trigger
--
-- 1. spiritual_logs: persists AI comfort + verse per submission
--    for the Growth Timeline page (non-encrypted, UI-facing data)
-- 2. handle_new_user trigger: auto-creates public.users row
--    whenever a new Supabase Auth user signs up, preventing RLS
--    blocks for new accounts with no profile row
-- ============================================================

-- ── 1. spiritual_logs ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.spiritual_logs (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  mood        TEXT,
  ai_comfort  TEXT,
  bible_verse TEXT,
  bible_ref   TEXT,
  client_date TEXT        NOT NULL,   -- YYYY-MM-DD in user's local timezone
  created_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.spiritual_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "spiritual_logs: self read" ON public.spiritual_logs;
CREATE POLICY "spiritual_logs: self read"
  ON public.spiritual_logs FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "spiritual_logs: self insert" ON public.spiritual_logs;
CREATE POLICY "spiritual_logs: self insert"
  ON public.spiritual_logs FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- ── 2. Auth signup trigger ───────────────────────────────────
-- Fires after INSERT on auth.users (new sign-up).
-- Creates a matching public.users row with role='member'.
-- ON CONFLICT DO NOTHING ensures idempotency if the row already exists.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, display_name, role)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'display_name',
      split_part(NEW.email, '@', 1)
    ),
    'member'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
