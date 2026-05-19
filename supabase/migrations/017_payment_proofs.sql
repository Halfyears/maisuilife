-- payment_proofs: user-submitted transfer evidence for manual reconciliation
create table if not exists public.payment_proofs (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.users(id) on delete cascade,
  channel      text not null check (channel in ('zelle','venmo','paypal','wechat_pay','alipay')),
  amount       numeric(10,2) not null check (amount > 0),
  currency     text not null default 'USD',
  user_memo    text,
  status       text not null default 'pending_review'
               check (status in ('pending_review','approved','rejected')),
  admin_note   text,
  reviewed_by  uuid references public.users(id),
  reviewed_at  timestamptz,
  created_at   timestamptz not null default now()
);

alter table public.payment_proofs enable row level security;

-- users: select & insert their own rows
create policy "payment_proofs_user_select" on public.payment_proofs
  for select using (user_id = auth.uid());

create policy "payment_proofs_user_insert" on public.payment_proofs
  for insert with check (user_id = auth.uid());

-- admins (super_admin / church_admin): full access
create policy "payment_proofs_admin_all" on public.payment_proofs
  for all using (
    exists (
      select 1 from public.users
      where id = auth.uid() and role in ('super_admin','church_admin')
    )
  );

create index payment_proofs_status_idx  on public.payment_proofs (status, created_at desc);
create index payment_proofs_user_idx    on public.payment_proofs (user_id, created_at desc);
