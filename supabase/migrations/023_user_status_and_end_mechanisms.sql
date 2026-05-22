-- ── 023: 用户状态 + 教会/团契/同行结束机制 ───────────────────────────────────

-- 1. users: is_active (默认激活)
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- 2. accountability_groups: status
ALTER TABLE public.accountability_groups
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';
ALTER TABLE public.accountability_groups
  DROP CONSTRAINT IF EXISTS accountability_groups_status_check;
ALTER TABLE public.accountability_groups
  ADD CONSTRAINT accountability_groups_status_check
  CHECK (status IN ('active', 'ended'));

-- 3. fellowships: 扩展 status 约束以支持 ended
ALTER TABLE public.fellowships
  DROP CONSTRAINT IF EXISTS fellowships_status_check;
ALTER TABLE public.fellowships
  ADD CONSTRAINT fellowships_status_check
  CHECK (status IN ('pending', 'approved', 'rejected', 'suspended', 'ended', 'archived'));

-- 4. churches: status
ALTER TABLE public.churches
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';
ALTER TABLE public.churches
  DROP CONSTRAINT IF EXISTS churches_status_check;
ALTER TABLE public.churches
  ADD CONSTRAINT churches_status_check
  CHECK (status IN ('active', 'ended'));
