-- ============================================================
-- 麦穗喜乐 — 003 安全红线 Cron Jobs
--
-- Requires pg_cron extension enabled in Supabase Dashboard.
-- All times are UTC; adjust offset for your target timezone.
-- ============================================================

-- ──────────────────────────────────────────────
-- 红线 A: 午夜洗净 (Midnight Purge)
-- 每天 UTC 16:00 = 北京时间 00:00 (UTC+8)
-- 将所有 daily_alignments.is_visible 设为 FALSE
-- 效果: 领袖视图中今日状态从公共视图蒸发
-- ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.midnight_purge_alignments()
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.daily_alignments
  SET is_visible = FALSE
  WHERE is_visible = TRUE
    AND date = CURRENT_DATE;  -- only today's records
END;
$$;

-- Schedule: every day at 16:00 UTC (= 00:00 CST/HKT)
SELECT cron.schedule(
  'midnight-purge-alignments',
  '0 16 * * *',
  'SELECT public.midnight_purge_alignments()'
);

-- ──────────────────────────────────────────────
-- 红线 B: 匿名同行 (7-Day Physical Delete)
-- 每天 UTC 00:00 清除所有过期 journeys
-- ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.purge_expired_journeys()
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE deleted_count INT;
BEGIN
  DELETE FROM public.journeys
  WHERE expires_at <= NOW();

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  -- Log count for audit; no content is logged
  INSERT INTO public.purge_audit_log (operation, row_count, executed_at)
  VALUES ('purge_expired_journeys', deleted_count, NOW());
END;
$$;

-- Audit log table (append-only, no personal data)
CREATE TABLE IF NOT EXISTS public.purge_audit_log (
  id          BIGSERIAL   PRIMARY KEY,
  operation   TEXT        NOT NULL,
  row_count   INT         NOT NULL,
  executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Only service role can read audit log
ALTER TABLE public.purge_audit_log ENABLE ROW LEVEL SECURITY;
-- No SELECT policy → only service_role bypass can read

-- Schedule: every day at 00:00 UTC
SELECT cron.schedule(
  'purge-expired-journeys',
  '0 0 * * *',
  'SELECT public.purge_expired_journeys()'
);

-- ──────────────────────────────────────────────
-- Helper RPC: join fellowship by invite code
-- Runs as security definer to validate code then insert member
-- ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.join_fellowship_by_code(p_invite_code TEXT)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_fellowship_id UUID;
BEGIN
  SELECT id INTO v_fellowship_id
  FROM public.fellowships
  WHERE invite_code = UPPER(TRIM(p_invite_code));

  IF v_fellowship_id IS NULL THEN
    RAISE EXCEPTION 'invalid_invite_code';
  END IF;

  INSERT INTO public.fellowship_members (fellowship_id, user_id)
  VALUES (v_fellowship_id, auth.uid())
  ON CONFLICT (fellowship_id, user_id) DO NOTHING;

  RETURN v_fellowship_id;
END;
$$;
