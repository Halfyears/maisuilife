-- ============================================================
-- 麦穗喜乐 — 005 Pastoral System & Leader Console
-- ============================================================

-- ──────────────────────────────────────────────
-- 1. daily_alignments: 紧急代祷标记
-- ──────────────────────────────────────────────
ALTER TABLE public.daily_alignments
  ADD COLUMN IF NOT EXISTS is_urgent BOOLEAN NOT NULL DEFAULT FALSE;

-- ──────────────────────────────────────────────
-- 2. fellowships: 会议模式 + YouTube 锚点
-- ──────────────────────────────────────────────
ALTER TABLE public.fellowships
  ADD COLUMN IF NOT EXISTS meeting_mode TEXT NOT NULL DEFAULT 'in-person'
    CHECK (meeting_mode IN ('in-person', 'online')),
  ADD COLUMN IF NOT EXISTS yt_link TEXT CHECK (
    yt_link IS NULL OR yt_link ~ '^https://(www\.)?youtube\.com/|^https://youtu\.be/'
  );

-- ──────────────────────────────────────────────
-- 3. urgent_flags — 匿名代祷信号
--
--  安全红线：组长通过 API 只能看到本表的 id 和 created_at，
--  user_id 由服务端持有，仅在 pastoral_request 被 APPROVED 后
--  通过 pastoral_requests.member_id → users.display_name 路径公开。
--
--  组长无法直接 SELECT 此表（RLS 阻断）。
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.urgent_flags (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  alignment_id   UUID        NOT NULL REFERENCES public.daily_alignments(id) ON DELETE CASCADE,
  fellowship_id  UUID        NOT NULL REFERENCES public.fellowships(id)      ON DELETE CASCADE,
  -- user_id: 内部路由用，绝不直接暴露给组长
  user_id        UUID        NOT NULL REFERENCES public.users(id)            ON DELETE CASCADE,
  flagged_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (alignment_id)
);

-- RLS: 成员只能看自己的旗帜；组长完全看不到此表（API 用 service_role）
ALTER TABLE public.urgent_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "urgent_flags: self only"
  ON public.urgent_flags FOR ALL
  USING (user_id = auth.uid());

-- ──────────────────────────────────────────────
-- 4. pastoral_requests — 三段式授权状态机
--
--  ┌─ Level 1 ──┐  组员提交 is_urgent=true → urgent_flags 记录
--  └────────────┘
--        ↓ 组长点击 [请求关怀]
--  ┌─ Level 2 ──┐  pastoral_requests 创建 status='PENDING'
--  └────────────┘
--        ↓ 组员响应弹窗
--  ┌─ Level 3 ──┐  status='APPROVED' → 组长可见 display_name
--  └────────────┘  status='DENIED'   → 请求关闭，人名永不公开
--
--  人名红线：member_id 存于此表，但 API 层仅在 APPROVED 时
--            查询 users.display_name，且绝不将 member_id 返回。
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pastoral_requests (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  urgent_flag_id  UUID        NOT NULL REFERENCES public.urgent_flags(id) ON DELETE CASCADE,
  fellowship_id   UUID        NOT NULL REFERENCES public.fellowships(id),
  leader_id       UUID        NOT NULL REFERENCES public.users(id),
  -- member_id: internal only — NEVER returned to leader until APPROVED
  member_id       UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status          TEXT        NOT NULL DEFAULT 'PENDING'
                              CHECK (status IN ('PENDING', 'APPROVED', 'DENIED')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  responded_at    TIMESTAMPTZ,
  UNIQUE (urgent_flag_id)   -- one request per urgent flag
);

-- RLS: 组长看自己发起的请求；成员看发给自己的请求
ALTER TABLE public.pastoral_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pastoral_requests: leader reads own"
  ON public.pastoral_requests FOR SELECT
  USING (leader_id = auth.uid());

CREATE POLICY "pastoral_requests: leader inserts"
  ON public.pastoral_requests FOR INSERT
  WITH CHECK (leader_id = auth.uid());

-- 组员可以读和更新发给自己的请求（用于弹窗响应）
CREATE POLICY "pastoral_requests: member reads own"
  ON public.pastoral_requests FOR SELECT
  USING (member_id = auth.uid());

CREATE POLICY "pastoral_requests: member responds"
  ON public.pastoral_requests FOR UPDATE
  USING (member_id = auth.uid() AND status = 'PENDING')
  WITH CHECK (
    -- 成员只能修改 status 和 responded_at，不能改其他列
    status IN ('APPROVED', 'DENIED')
  );

-- ──────────────────────────────────────────────
-- 5. 原子函数：创建 urgent_flag（调用时须已有 alignment）
-- ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.flag_urgent(
  p_alignment_id UUID,
  p_fellowship_id UUID
)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_flag_id UUID;
  v_user_id UUID;
BEGIN
  -- Verify caller owns the alignment
  SELECT user_id INTO v_user_id
  FROM public.daily_alignments
  WHERE id = p_alignment_id AND user_id = auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'alignment_not_found_or_not_owner';
  END IF;

  -- Verify caller is a member of the fellowship
  IF NOT EXISTS (
    SELECT 1 FROM public.fellowship_members
    WHERE fellowship_id = p_fellowship_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'not_a_fellowship_member';
  END IF;

  INSERT INTO public.urgent_flags (alignment_id, fellowship_id, user_id)
  VALUES (p_alignment_id, p_fellowship_id, auth.uid())
  ON CONFLICT (alignment_id) DO NOTHING
  RETURNING id INTO v_flag_id;

  RETURN v_flag_id;
END;
$$;
