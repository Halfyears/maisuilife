-- 024: 守望祷告记录 — 持久化每次祷告提交
-- 原 vigil_presences 继续用于「今日守望人数」统计（每人每天1条）
-- 新增 vigil_prayers 用于祷告日志（每次提交1条，永不清空）

CREATE TABLE IF NOT EXISTS accountability_vigil_prayers (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id     uuid        NOT NULL REFERENCES accountability_groups(id) ON DELETE CASCADE,
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text        NOT NULL,
  note         text        CHECK (char_length(note) <= 200),
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS vigil_prayers_group_time
  ON accountability_vigil_prayers(group_id, created_at DESC);
