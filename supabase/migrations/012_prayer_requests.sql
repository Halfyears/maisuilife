-- ── 代祷需求 ──────────────────────────────────────────────────────
-- 每位成员可以发布代祷需求，其他人可以承诺每日代祷并记录次数。

create table if not exists prayer_requests (
  id            uuid        primary key default gen_random_uuid(),
  fellowship_id uuid        not null references fellowships(id) on delete cascade,
  user_id       uuid        not null references auth.users(id) on delete cascade,
  display_name  text        not null default '',   -- 发布时快照，避免后续改名影响
  is_anonymous  boolean     not null default false,
  title         text        not null,
  content       text,
  is_resolved   boolean     not null default false,
  created_at    timestamptz not null default now()
);

-- ── 代祷承诺与次数记录 ──────────────────────────────────────────────
create table if not exists prayer_commitments (
  id           uuid        primary key default gen_random_uuid(),
  request_id   uuid        not null references prayer_requests(id) on delete cascade,
  user_id      uuid        not null references auth.users(id) on delete cascade,
  total_count  int         not null default 1,
  last_prayed  timestamptz not null default now(),
  created_at   timestamptz not null default now(),
  unique(request_id, user_id)
);

alter table prayer_requests    enable row level security;
alter table prayer_commitments enable row level security;

-- ── RLS: 团契成员可读取本团契的代祷需求 ───────────────────────────
create policy "fellowship members read prayer_requests"
  on prayer_requests for select
  using (
    exists (
      select 1 from fellowship_members fm
      where fm.fellowship_id = prayer_requests.fellowship_id
        and fm.user_id = auth.uid()
    )
  );

-- ── RLS: 成员可在自己所属团契发布需求 ─────────────────────────────
create policy "members insert prayer_requests"
  on prayer_requests for insert
  with check (
    user_id = auth.uid() and
    exists (
      select 1 from fellowship_members fm
      where fm.fellowship_id = prayer_requests.fellowship_id
        and fm.user_id = auth.uid()
    )
  );

-- ── RLS: 发布者可更新自己的需求（标记已蒙恩等） ────────────────────
create policy "creator update prayer_requests"
  on prayer_requests for update
  using (user_id = auth.uid());

-- ── RLS: 成员可读取同团契的代祷承诺 ───────────────────────────────
create policy "members read prayer_commitments"
  on prayer_commitments for select
  using (
    exists (
      select 1 from prayer_requests pr
      join fellowship_members fm on fm.fellowship_id = pr.fellowship_id
      where pr.id = prayer_commitments.request_id
        and fm.user_id = auth.uid()
    )
  );

-- ── RLS: 成员可创建/更新自己的代祷承诺 ───────────────────────────
create policy "users insert prayer_commitments"
  on prayer_commitments for insert
  with check (user_id = auth.uid());

create policy "users update own prayer_commitments"
  on prayer_commitments for update
  using (user_id = auth.uid());
