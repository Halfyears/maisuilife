-- Push notification subscriptions (Web Push API)
create table if not exists push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  endpoint   text not null,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz default now(),
  -- One subscription per endpoint per user
  unique (user_id, endpoint)
);

alter table push_subscriptions enable row level security;

-- Users can manage only their own subscriptions
create policy "push_subs_select_own" on push_subscriptions
  for select using (auth.uid() = user_id);

create policy "push_subs_insert_own" on push_subscriptions
  for insert with check (auth.uid() = user_id);

create policy "push_subs_delete_own" on push_subscriptions
  for delete using (auth.uid() = user_id);

-- Index for fast user lookup
create index if not exists push_subscriptions_user_idx on push_subscriptions(user_id);
