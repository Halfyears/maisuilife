-- 019: Fellowship gathering session (签到 → 收割 → 麦穗)

-- ── 1. Lifetime wheat count on fellowships ────────────────────────────────
alter table public.fellowships
  add column if not exists wheat_count int not null default 0;

-- ── 2. Active gathering session (one at a time per fellowship) ────────────
create table if not exists public.fellowship_sessions (
  id              uuid        primary key default gen_random_uuid(),
  fellowship_id   uuid        not null references public.fellowships(id) on delete cascade,
  organizer_id    uuid        not null references public.users(id),
  expected_count  int         not null default 0 check (expected_count >= 1),
  checkin_count   int         not null default 0,
  wheat_total     int         not null default 0,
  amen_count      int         not null default 0,
  state           text        not null default 'checkin'
                              check (state in ('checkin','harvest','closed')),
  scripture_cards jsonb,
  started_at      timestamptz not null default now(),
  harvested_at    timestamptz,
  closed_at       timestamptz
);

alter table public.fellowship_sessions enable row level security;

create policy "fellowship_sessions: members read"
  on public.fellowship_sessions for select
  using (
    exists (
      select 1 from public.fellowship_members fm
      where fm.fellowship_id = fellowship_sessions.fellowship_id
        and fm.user_id = auth.uid()
    )
  );

-- ── 3. Per-session check-ins ──────────────────────────────────────────────
create table if not exists public.session_checkins (
  id            uuid        primary key default gen_random_uuid(),
  session_id    uuid        not null references public.fellowship_sessions(id) on delete cascade,
  user_id       uuid        not null references public.users(id),
  anon_label    text        not null default '同行者',
  checked_in_at timestamptz not null default now(),
  unique(session_id, user_id)
);

alter table public.session_checkins enable row level security;

create policy "session_checkins: members read"
  on public.session_checkins for select
  using (
    exists (
      select 1 from public.fellowship_sessions s
      join public.fellowship_members m on m.fellowship_id = s.fellowship_id
      where s.id = session_checkins.session_id
        and m.user_id = auth.uid()
    )
  );

create index if not exists session_checkins_session_idx
  on public.session_checkins(session_id);

create index if not exists fellowship_sessions_active_idx
  on public.fellowship_sessions(fellowship_id)
  where state in ('checkin','harvest');

-- ── 4. Atomic wheat counter increment (called from API, bypasses RLS) ─────
create or replace function public.increment_wheat_count(p_fellowship_id uuid)
returns void language plpgsql security definer as $$
begin
  update public.fellowships
  set wheat_count = wheat_count + 1
  where id = p_fellowship_id;
end;
$$;
