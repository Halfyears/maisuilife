-- ── 同行小组状态字段 ──────────────────────────────────────────────────────────
-- 为 accountability_groups 表添加 status 字段（active / ended / deleted）
-- 以便"结束小组"操作能正确折叠显示，区别于每日打卡完成状态

ALTER TABLE accountability_groups
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'ended', 'deleted'));

-- 与 deleted_at 对齐：已软删除的记录将 status 置为 'deleted'
-- 这里仅对现有记录做一次性补全（无论 status 是否已有值）
UPDATE accountability_groups
  SET status = 'deleted'
  WHERE deleted_at IS NOT NULL AND status = 'active';

-- 索引：常用查询只看 active / ended 两种状态
CREATE INDEX IF NOT EXISTS idx_ag_status
  ON accountability_groups (status)
  WHERE deleted_at IS NULL;
