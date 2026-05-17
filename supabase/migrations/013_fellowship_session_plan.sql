-- ── 团契备课计划 ──────────────────────────────────────────────────────
create table if not exists fellowship_session_plans (
  id           uuid        primary key default gen_random_uuid(),
  fellowship_id uuid       not null references fellowships(id) on delete cascade,
  theme        text,
  scripture_ref  text,
  scripture_text text,
  updated_at   timestamptz not null default now(),
  unique(fellowship_id)
);

alter table fellowship_session_plans enable row level security;

create policy "leader can manage session plan"
  on fellowship_session_plans for all
  using (
    fellowship_id in (select id from fellowships where leader_id = auth.uid())
  );

-- ── 团契音乐排单 ──────────────────────────────────────────────────────
-- songs 字段格式: [{"title": "...", "url": "..."}]
create table if not exists fellowship_music_slots (
  id           uuid        primary key default gen_random_uuid(),
  fellowship_id uuid       not null references fellowships(id) on delete cascade,
  slot_name    text        not null,
  slot_order   int         not null default 0,
  songs        jsonb       not null default '[]'::jsonb,
  is_fixed     boolean     not null default false,
  created_at   timestamptz not null default now()
);

alter table fellowship_music_slots enable row level security;

create policy "leader can manage music slots"
  on fellowship_music_slots for all
  using (
    fellowship_id in (select id from fellowships where leader_id = auth.uid())
  );
