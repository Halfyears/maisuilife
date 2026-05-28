-- 030_member_status.sql
-- 为 accountability_group_members 添加退出/移除状态字段
-- 软删除：status 标记成员状态，原有打卡记录完整保留

ALTER TABLE accountability_group_members
  ADD COLUMN IF NOT EXISTS status      VARCHAR(20) NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS left_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS removed_at  TIMESTAMPTZ;

-- 活跃成员查询索引（最常用路径）
CREATE INDEX IF NOT EXISTS idx_agm_active
  ON accountability_group_members (group_id, user_id)
  WHERE status = 'active';

-- 状态约束
ALTER TABLE accountability_group_members
  DROP CONSTRAINT IF EXISTS chk_agm_status,
  ADD CONSTRAINT chk_agm_status
    CHECK (status IN ('active', 'left', 'removed'));
