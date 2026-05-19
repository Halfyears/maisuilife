-- 020: fellowship_vaults (persistent wheat store) + member_spiritual_interactions

-- ── 1. fellowship_vaults ─────────────────────────────────────────────────────
-- One row per fellowship; persists cumulative wheat across sessions.
-- distinct from fellowships.wheat_count (lifetime total) — vault can be cleared.
create table if not exists public.fellowship_vaults (
  id                  uuid        primary key default gen_random_uuid(),
  fellowship_id       uuid        not null unique references public.fellowships(id) on delete cascade,
  current_wheat_count int         not null default 0 check (current_wheat_count >= 0),
  last_cleared_at     timestamptz
);

alter table public.fellowship_vaults enable row level security;

create policy "fellowship_vaults: members and leader read"
  on public.fellowship_vaults for select
  using (
    public.is_fellowship_member(fellowship_id)
    or public.is_fellowship_leader(fellowship_id)
  );

-- ── 2. member_spiritual_interactions ─────────────────────────────────────────
-- Individual reaction records per user per alignment.
-- Enables analytics and per-user dedup in the future.
-- Direct read is restricted to server-side (admin client) only.
create table if not exists public.member_spiritual_interactions (
  id            uuid        primary key default gen_random_uuid(),
  alignment_id  uuid        not null references public.daily_alignments(id) on delete cascade,
  interactor_id uuid        not null references public.users(id),
  action_type   text        not null check (action_type in ('amen', 'nian')),
  created_at    timestamptz not null default now()
);

create index if not exists msi_alignment_idx
  on public.member_spiritual_interactions(alignment_id);

create index if not exists msi_interactor_idx
  on public.member_spiritual_interactions(interactor_id);

alter table public.member_spiritual_interactions enable row level security;

-- No SELECT policy — read is server-side only via service role.
-- INSERT policy allows authenticated users to insert their own rows
-- (used as fallback; primary path uses admin client).
create policy "member_spiritual_interactions: self insert"
  on public.member_spiritual_interactions for insert
  with check (interactor_id = auth.uid());

-- ── 3. RPC: upsert vault and increment wheat count ───────────────────────────
create or replace function public.increment_vault_wheat(p_fellowship_id uuid)
returns void language plpgsql security definer as $$
begin
  insert into public.fellowship_vaults (fellowship_id, current_wheat_count)
  values (p_fellowship_id, 1)
  on conflict (fellowship_id)
  do update set current_wheat_count = fellowship_vaults.current_wheat_count + 1;
end;
$$;
