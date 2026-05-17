-- ============================================================
-- 麦穗喜乐 — 009 Rename role 'leader' → 'group_leader'
--
-- Finalises the strict 3-tier hierarchy:
--   church_admin  → Pastor / Church controller
--   group_leader  → Fellowship group leader
--   member        → Regular user
--   super_admin   → System maintainer
--
-- Steps:
--   1. Widen constraint temporarily, migrate data, then tighten
--   2. Fix RLS: members-only may submit pending proposals
-- ============================================================

-- ── 1. Widen constraint to accept both old and new value ──────
ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_role_check;

ALTER TABLE public.users
  ADD CONSTRAINT users_role_check
    CHECK (role IN ('member', 'leader', 'group_leader', 'church_admin', 'super_admin'));

-- ── 2. Migrate existing data ──────────────────────────────────
UPDATE public.users
  SET role = 'group_leader'
  WHERE role = 'leader';

-- ── 3. Remove old value from constraint ──────────────────────
ALTER TABLE public.users
  DROP CONSTRAINT users_role_check;

ALTER TABLE public.users
  ADD CONSTRAINT users_role_check
    CHECK (role IN ('member', 'group_leader', 'church_admin', 'super_admin'));

-- ── 4. Tighten fellowship submit policy ───────────────────────
-- Old: NOT IN ('church_admin', 'super_admin') — inadvertently let
--      group_leaders submit redundant pending proposals.
-- New: only 'member' role may propose a new fellowship.

DROP POLICY IF EXISTS "fellowships: member submit pending" ON public.fellowships;

CREATE POLICY "fellowships: member submit pending"
  ON public.fellowships FOR INSERT
  WITH CHECK (
    leader_id = auth.uid()
    AND status = 'pending'
    AND public.current_user_role() = 'member'
  );
