-- 029_soft_delete.sql
-- 为教会、团契、同行小组添加软删除字段，防止误操作导致数据不可恢复

ALTER TABLE churches              ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE fellowships           ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE accountability_groups ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- 局部索引：加速正常查询（只索引未删除的行）
CREATE INDEX IF NOT EXISTS idx_churches_not_deleted
  ON churches (id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_fellowships_not_deleted
  ON fellowships (id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_accountability_groups_not_deleted
  ON accountability_groups (id) WHERE deleted_at IS NULL;

-- 超管查看已删除记录时走此索引
CREATE INDEX IF NOT EXISTS idx_churches_deleted
  ON churches (deleted_at) WHERE deleted_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_fellowships_deleted
  ON fellowships (deleted_at) WHERE deleted_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_accountability_groups_deleted
  ON accountability_groups (deleted_at) WHERE deleted_at IS NOT NULL;
