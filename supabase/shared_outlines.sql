-- ═══════════════════════════════════════════════════════════
-- shared_outlines — 跨团契备课共享缓存表
-- 同一主题/经文 + 同层级 → 全局唯一一份，多团契复用
-- Run this in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════

create table if not exists public.shared_outlines (
  id               uuid        default gen_random_uuid() primary key,
  meeting_type     text        not null check (meeting_type in ('theme', 'scripture')),
  input_query      text        not null,       -- 原始输入（展示用）
  query_normalized text        not null,       -- 规范化（查找用）：trim + lower
  tier             text        not null default 'free' check (tier in ('free', 'premium')),
  outline          jsonb       not null,        -- 完整 MeetingOutline JSON
  use_count        integer     not null default 1,
  generated_at     timestamptz not null default now(),
  last_used_at     timestamptz not null default now(),

  -- 唯一约束：同主题 + 同类型 + 同层级，只保留一份
  unique (meeting_type, query_normalized, tier)
);

create index if not exists idx_shared_outlines_lookup
  on public.shared_outlines (meeting_type, query_normalized, tier);

-- 不开 RLS — 仅通过 admin client (service role) 访问，无需策略

-- 原子递增使用次数（避免并发 race condition）
create or replace function public.increment_shared_use_count(p_id uuid)
returns void language sql security definer as $$
  update public.shared_outlines
  set use_count    = use_count + 1,
      last_used_at = now()
  where id = p_id;
$$;
