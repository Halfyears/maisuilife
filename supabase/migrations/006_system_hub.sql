-- ============================================================
-- 麦穗喜乐 — 006 System Hub & Admin Infrastructure
-- ============================================================

-- ──────────────────────────────────────────────
-- 1. users: 扩展角色枚举支持 super_admin
-- ──────────────────────────────────────────────
ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_role_check;

ALTER TABLE public.users
  ADD CONSTRAINT users_role_check
    CHECK (role IN ('member', 'leader', 'super_admin'));

-- ──────────────────────────────────────────────
-- 2. system_configs — 全局键值配置表
--    key: 唯一字符串
--    value: JSONB — 结构因 key 而异
--    只有 super_admin 可写（应用层 + RLS 双重保障）
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.system_configs (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  key        TEXT        NOT NULL UNIQUE,
  value      JSONB       NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID        REFERENCES auth.users(id)
);

-- RLS
ALTER TABLE public.system_configs ENABLE ROW LEVEL SECURITY;

-- 所有已认证用户可读（AI 熔断开关由 STT 路由读取）
CREATE POLICY "system_configs: authenticated read"
  ON public.system_configs FOR SELECT
  TO authenticated
  USING (true);

-- 只有 super_admin 可写
CREATE POLICY "system_configs: super_admin write"
  ON public.system_configs FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

-- ──────────────────────────────────────────────
-- 3. 种子数据 — 必要的配置条目
-- ──────────────────────────────────────────────
INSERT INTO public.system_configs (key, value) VALUES

  -- AI 熔断开关 (circuit breaker)
  -- active=false 时，所有 /api/stt 请求立即拒绝
  ('ai_circuit_breaker', '{"active": true, "disabled_at": null, "disabled_reason": ""}'::jsonb),

  -- 全局公告（显示在用户 App 首页）
  ('global_notice', '{"enabled": false, "text": "", "type": "info"}'::jsonb),

  -- 捐献设置
  ('donation_settings', '{"amount": 50, "currency": "HKD", "link": "", "enabled": false}'::jsonb),

  -- 支付链接
  ('payment_links', '{"wechat_qr": "", "paypal": "", "stripe": ""}'::jsonb),

  -- 成本追踪参考（单价，用于前端估算）
  ('cost_rates', '{
    "gemini_per_alignment_usd": 0.0002,
    "whisper_per_alignment_usd": 0.0013,
    "note": "Estimated: Gemini 1.5 Flash ~800 in+200 out tokens; Groq Whisper ~2min audio"
  }'::jsonb)

ON CONFLICT (key) DO NOTHING;

-- ──────────────────────────────────────────────
-- 4. updated_at 自动触发器
-- ──────────────────────────────────────────────
CREATE TRIGGER system_configs_touch_updated_at
  BEFORE UPDATE ON public.system_configs
  FOR EACH ROW EXECUTE PROCEDURE public.touch_updated_at();

-- ──────────────────────────────────────────────
-- 5. 管理员聚合视图 (统计用，绕开 RLS 用 service_role)
-- ──────────────────────────────────────────────
-- 本月非静默对齐数（成本基数）
CREATE OR REPLACE VIEW public.admin_cost_basis AS
  SELECT
    date_trunc('month', created_at) AS month,
    COUNT(*) FILTER (WHERE is_silent = FALSE) AS billable_alignments,
    COUNT(*) AS total_alignments
  FROM public.daily_alignments
  GROUP BY 1;

-- 今日全网 status_tag 分布（属灵天气）
CREATE OR REPLACE VIEW public.admin_spiritual_weather AS
  SELECT
    status_tag,
    COUNT(*) AS count,
    ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 1) AS pct
  FROM public.daily_alignments
  WHERE date = CURRENT_DATE
    AND is_visible = TRUE
    AND is_silent = FALSE
  GROUP BY status_tag
  ORDER BY count DESC;
