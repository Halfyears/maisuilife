-- ═══════════════════════════════════════════════════════════
-- fellowship_outlines — 团契备课历史记录表
-- Run this in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════

create table if not exists public.fellowship_outlines (
  id            uuid        default gen_random_uuid() primary key,
  fellowship_id uuid        not null references public.fellowships(id) on delete cascade,
  created_by    uuid        references public.users(id) on delete set null,
  meeting_type  text        not null check (meeting_type in ('theme', 'scripture')),
  input_query   text        not null,
  tier          text        not null default 'free' check (tier in ('free', 'premium')),
  outline       jsonb       not null,
  generated_at  timestamptz not null default now()
);

create index if not exists idx_fellowship_outlines_fellowship_id
  on public.fellowship_outlines (fellowship_id, generated_at desc);

-- RLS
alter table public.fellowship_outlines enable row level security;

-- Leaders can view their own fellowship's outlines
create policy "outlines_select" on public.fellowship_outlines
  for select using (
    fellowship_id in (
      select id from public.fellowships where leader_id = auth.uid()
    )
    or exists (
      select 1 from public.users
      where id = auth.uid() and role in ('church_admin', 'super_admin')
    )
  );

-- Service role (admin client) handles inserts — no client-side insert policy needed
