-- ============================================================
-- 007 Fix RLS Infinite Recursion on fellowships <-> fellowship_members
--
-- Root cause:
--   "fellowships: member read"          queries fellowship_members
--   "fellowship_members: self or leader read" queries fellowships
--   → mutual recursion → PostgreSQL error: infinite recursion
--
-- Fix: two SECURITY DEFINER helper functions bypass RLS when
--   doing the cross-table lookup, breaking the cycle.
-- ============================================================

-- ── 1. Helper: is current user the leader of a fellowship? ──
--    SECURITY DEFINER → runs as owner, bypasses fellowship RLS.
CREATE OR REPLACE FUNCTION public.is_fellowship_leader(p_fellowship_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.fellowships
    WHERE id = p_fellowship_id
      AND leader_id = auth.uid()
  );
$$;

-- ── 2. Helper: is current user a member of a fellowship? ────
--    SECURITY DEFINER → runs as owner, bypasses fellowship_members RLS.
CREATE OR REPLACE FUNCTION public.is_fellowship_member(p_fellowship_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.fellowship_members
    WHERE fellowship_id = p_fellowship_id
      AND user_id = auth.uid()
  );
$$;

-- ── 3. Rebuild fellowship policies using helper functions ────

DROP POLICY IF EXISTS "fellowships: member read"     ON public.fellowships;
DROP POLICY IF EXISTS "fellowships: leader update"   ON public.fellowships;

CREATE POLICY "fellowships: member read"
  ON public.fellowships FOR SELECT
  USING (
    leader_id = auth.uid()
    OR public.is_fellowship_member(id)
  );

-- UPDATE: no change needed but re-create to be explicit
CREATE POLICY "fellowships: leader update"
  ON public.fellowships FOR UPDATE
  USING (leader_id = auth.uid());

-- ── 4. Rebuild fellowship_members policies ───────────────────

DROP POLICY IF EXISTS "fellowship_members: self or leader read"  ON public.fellowship_members;
DROP POLICY IF EXISTS "fellowship_members: leader update label"  ON public.fellowship_members;

CREATE POLICY "fellowship_members: self or leader read"
  ON public.fellowship_members FOR SELECT
  USING (
    user_id = auth.uid()
    OR public.is_fellowship_leader(fellowship_id)
  );

CREATE POLICY "fellowship_members: leader update label"
  ON public.fellowship_members FOR UPDATE
  USING (public.is_fellowship_leader(fellowship_id));

-- ── 5. Rebuild users: leader reads members policy ────────────
--    Also uses fellowship_members; now safe because
--    fellowship_members SELECT uses is_fellowship_leader() (SECURITY DEFINER).

DROP POLICY IF EXISTS "users: leader reads members" ON public.users;

CREATE POLICY "users: leader reads members"
  ON public.users FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.fellowship_members fm
      WHERE fm.user_id = public.users.id
        AND public.is_fellowship_leader(fm.fellowship_id)
    )
  );
