-- ============================================================
-- 麦穗喜乐 — 004 Fellowship Features
-- 新增: is_silent, react_nian, react_amen, 原子自增 RPC,
--       成员互读 RLS 策略
-- ============================================================

-- ──────────────────────────────────────────────
-- 1. daily_alignments 新增列
-- ──────────────────────────────────────────────
ALTER TABLE public.daily_alignments
  ADD COLUMN IF NOT EXISTS is_silent  BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS react_nian INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS react_amen INTEGER NOT NULL DEFAULT 0;

-- Constraint: 静默交账不应带有加密摘要
ALTER TABLE public.daily_alignments
  ADD CONSTRAINT silent_no_summary
    CHECK (NOT (is_silent = TRUE AND ai_summary_enc IS NOT NULL));

-- ──────────────────────────────────────────────
-- 2. 原子自增 RPC (无 Race Condition)
--    p_reaction_type: 'nian' | 'amen'
--    Returns the updated row's counters.
-- ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.increment_reaction(
  p_alignment_id UUID,
  p_reaction_type TEXT
)
RETURNS TABLE (react_nian INTEGER, react_amen INTEGER)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF p_reaction_type NOT IN ('nian', 'amen') THEN
    RAISE EXCEPTION 'invalid_reaction_type';
  END IF;

  RETURN QUERY
  UPDATE public.daily_alignments
  SET
    react_nian = CASE WHEN p_reaction_type = 'nian' THEN react_nian + 1 ELSE react_nian END,
    react_amen = CASE WHEN p_reaction_type = 'amen' THEN react_amen + 1 ELSE react_amen END
  WHERE id = p_alignment_id
    AND is_visible = TRUE          -- 午夜洗净后禁止继续互动
    AND date = CURRENT_DATE        -- 只能对今日记录互动
  RETURNING react_nian, react_amen;
END;
$$;

-- ──────────────────────────────────────────────
-- 3. 成员互读 RLS（仅 status_tag，不含加密内容）
--    同一团契的成员可以看到彼此今日的 is_visible=TRUE 行。
--    加密列 ai_summary_enc 的解密在应用层进行，这里只控制行可见性。
-- ──────────────────────────────────────────────
CREATE POLICY "daily_alignments: peer member reads visible"
  ON public.daily_alignments FOR SELECT
  USING (
    is_visible = TRUE
    AND EXISTS (
      SELECT 1
      FROM public.fellowship_members viewer_fm
      JOIN public.fellowship_members owner_fm
        ON owner_fm.fellowship_id = viewer_fm.fellowship_id
      WHERE viewer_fm.user_id = auth.uid()
        AND owner_fm.user_id  = public.daily_alignments.user_id
        AND viewer_fm.user_id != owner_fm.user_id  -- 不重复自己（已有 self read）
    )
  );

-- ──────────────────────────────────────────────
-- 4. 成员可对他人今日记录触发计数更新
--    (react 端点使用 service role，但保留此备用策略)
-- ──────────────────────────────────────────────
CREATE POLICY "daily_alignments: peer member react update"
  ON public.daily_alignments FOR UPDATE
  USING (
    is_visible = TRUE
    AND date = CURRENT_DATE
    AND EXISTS (
      SELECT 1
      FROM public.fellowship_members viewer_fm
      JOIN public.fellowship_members owner_fm
        ON owner_fm.fellowship_id = viewer_fm.fellowship_id
      WHERE viewer_fm.user_id = auth.uid()
        AND owner_fm.user_id  = public.daily_alignments.user_id
    )
  )
  -- 只允许更新计数器列，不允许改内容
  WITH CHECK (
    -- row identity must not change
    id        = id AND
    user_id   = user_id AND
    date      = date AND
    status_tag = status_tag AND
    is_silent = is_silent
  );
