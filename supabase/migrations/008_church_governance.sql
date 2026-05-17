-- ============================================================
-- 麦穗喜乐 — 008 Church Governance & Fellowship Approval Flow
--
-- Adds:
--   • church_admin role
--   • fellowships.status / meeting_address / leader_contact / church_id / approved_*
--   • current_user_role() SECURITY DEFINER helper (breaks any role-check recursion)
--   • RLS policy set for church_admin full governance
-- ============================================================

-- ── 1. Expand role constraint ─────────────────────────────────
ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_role_check;

ALTER TABLE public.users
  ADD CONSTRAINT users_role_check
    CHECK (role IN ('member', 'leader', 'church_admin', 'super_admin'));

-- ── 2. fellowships: new governance columns ────────────────────
ALTER TABLE public.fellowships
  ADD COLUMN IF NOT EXISTS status         TEXT        NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'archived')),
  ADD COLUMN IF NOT EXISTS meeting_address TEXT,
  ADD COLUMN IF NOT EXISTS leader_contact  TEXT,
  ADD COLUMN IF NOT EXISTS church_id       UUID        REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approved_by     UUID        REFERENCES public.users(id) ON DELETE SET NULL;

-- Existing fellowships were created without the approval flow — mark them approved
UPDATE public.fellowships
  SET status = 'approved'
  WHERE status = 'pending';

-- ── 3. current_user_role() — SECURITY DEFINER, no RLS on users
--    Used in fellowship RLS policies to avoid cross-table recursion.
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT role FROM public.users WHERE id = auth.uid();
$$;

-- ── 4. fellowships RLS overhaul ───────────────────────────────

-- Church/super admins see everything
DROP POLICY IF EXISTS "fellowships: church_admin full read" ON public.fellowships;
CREATE POLICY "fellowships: church_admin full read"
  ON public.fellowships FOR SELECT
  USING (public.current_user_role() IN ('church_admin', 'super_admin'));

-- Regular users see only approved fellowships they belong to
DROP POLICY IF EXISTS "fellowships: member read" ON public.fellowships;
DROP POLICY IF EXISTS "fellowships: member read approved" ON public.fellowships;
CREATE POLICY "fellowships: member read approved"
  ON public.fellowships FOR SELECT
  USING (
    status = 'approved'
    AND (leader_id = auth.uid() OR public.is_fellowship_member(id))
  );

-- Members may submit a pending proposal (leader_id = self, status must be 'pending')
DROP POLICY IF EXISTS "fellowships: leader insert" ON public.fellowships;
DROP POLICY IF EXISTS "fellowships: member submit pending" ON public.fellowships;
CREATE POLICY "fellowships: member submit pending"
  ON public.fellowships FOR INSERT
  WITH CHECK (
    leader_id = auth.uid()
    AND status = 'pending'
    AND public.current_user_role() NOT IN ('church_admin', 'super_admin')
  );

-- Church / super admins may insert with any status and any leader
DROP POLICY IF EXISTS "fellowships: church_admin insert" ON public.fellowships;
CREATE POLICY "fellowships: church_admin insert"
  ON public.fellowships FOR INSERT
  WITH CHECK (
    public.current_user_role() IN ('church_admin', 'super_admin')
  );

-- Church / super admins may update any fellowship
DROP POLICY IF EXISTS "fellowships: church_admin update all" ON public.fellowships;
CREATE POLICY "fellowships: church_admin update all"
  ON public.fellowships FOR UPDATE
  USING (public.current_user_role() IN ('church_admin', 'super_admin'));

-- ── 5. users: church_admin can read all profiles ──────────────
--    (needed for leader-selector dropdown in hub)
DROP POLICY IF EXISTS "users: church_admin read all" ON public.users;
CREATE POLICY "users: church_admin read all"
  ON public.users FOR SELECT
  USING (public.current_user_role() IN ('church_admin', 'super_admin'));

-- ── 6. fellowship_members: church_admin can read all rows ─────
DROP POLICY IF EXISTS "fellowship_members: church_admin read" ON public.fellowship_members;
CREATE POLICY "fellowship_members: church_admin read"
  ON public.fellowship_members FOR SELECT
  USING (public.current_user_role() IN ('church_admin', 'super_admin'));
