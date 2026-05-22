-- ============================================================
-- 麦穗喜乐 — 022 Churches & Fellowship Leader Appointment Flow
--
-- Adds:
--   • churches table (multi-church support)
--   • church_members table
--   • Update fellowships.church_id FK → churches
--   • Make fellowships.leader_id nullable
--   • Add leader_pending_id + leader_appointment_token for confirmation flow
-- ============================================================

-- ── 1. churches table ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.churches (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT        NOT NULL,
  invite_code CHAR(6)     NOT NULL UNIQUE,
  address     TEXT,
  city        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Reuse generate_invite_code() for churches
CREATE OR REPLACE FUNCTION public.assign_church_invite_code()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE attempts INT := 0;
BEGIN
  WHILE NEW.invite_code IS NULL OR EXISTS (
    SELECT 1 FROM public.churches WHERE invite_code = NEW.invite_code
  ) LOOP
    NEW.invite_code := public.generate_invite_code();
    attempts := attempts + 1;
    IF attempts > 20 THEN RAISE EXCEPTION 'church invite code collision'; END IF;
  END LOOP;
  RETURN NEW;
END;
$$;

CREATE TRIGGER churches_assign_invite_code
  BEFORE INSERT ON public.churches
  FOR EACH ROW EXECUTE PROCEDURE public.assign_church_invite_code();

-- RLS
ALTER TABLE public.churches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "churches: anyone can read"
  ON public.churches FOR SELECT USING (true);

CREATE POLICY "churches: church_admin insert"
  ON public.churches FOR INSERT
  WITH CHECK (public.current_user_role() IN ('church_admin', 'super_admin'));

CREATE POLICY "churches: church_admin update"
  ON public.churches FOR UPDATE
  USING (public.current_user_role() IN ('church_admin', 'super_admin'));

-- ── 2. church_members table ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.church_members (
  church_id  UUID        NOT NULL REFERENCES public.churches(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  joined_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (church_id, user_id)
);

ALTER TABLE public.church_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "church_members: read own"
  ON public.church_members FOR SELECT
  USING (user_id = auth.uid() OR public.current_user_role() IN ('church_admin', 'super_admin'));

CREATE POLICY "church_members: insert self"
  ON public.church_members FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "church_members: admin delete"
  ON public.church_members FOR DELETE
  USING (public.current_user_role() IN ('church_admin', 'super_admin'));

-- ── 3. Update fellowships.church_id FK → churches ─────────────
--    The column was previously defined as FK to users(id) (wrong).
--    Drop that constraint and recreate pointing to churches.
ALTER TABLE public.fellowships
  DROP CONSTRAINT IF EXISTS fellowships_church_id_fkey;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'fellowships' AND column_name = 'church_id'
  ) THEN
    ALTER TABLE public.fellowships
      ADD COLUMN church_id UUID REFERENCES public.churches(id) ON DELETE SET NULL;
  ELSE
    -- Column already exists (was FK to users — stale user IDs).
    -- Null out old values so the new FK to churches is valid.
    UPDATE public.fellowships SET church_id = NULL;
    ALTER TABLE public.fellowships
      ADD CONSTRAINT fellowships_church_id_fkey
        FOREIGN KEY (church_id) REFERENCES public.churches(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ── 4. Make leader_id nullable (fellowship can exist without leader) ──
ALTER TABLE public.fellowships
  ALTER COLUMN leader_id DROP NOT NULL;

-- ── 5. Leader appointment columns ─────────────────────────────
ALTER TABLE public.fellowships
  ADD COLUMN IF NOT EXISTS leader_pending_id
    UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS leader_appointment_token
    UUID DEFAULT NULL;

-- ── 6. Seed: migrate system_configs church_name → churches ────
--    If a church name is configured, create a church record.
INSERT INTO public.churches (name, invite_code)
SELECT
  (value->>'name')::TEXT,
  public.generate_invite_code()
FROM public.system_configs
WHERE key = 'church_name'
  AND value->>'name' IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.churches LIMIT 1)
ON CONFLICT DO NOTHING;
