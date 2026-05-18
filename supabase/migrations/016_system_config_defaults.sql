-- 确保 system_configs 表存在（006 migration 未执行时的兜底）
create table if not exists public.system_configs (
  id         uuid        primary key default gen_random_uuid(),
  key        text        not null unique,
  value      jsonb       not null,
  updated_at timestamptz not null default now(),
  updated_by uuid        references auth.users(id)
);

alter table public.system_configs enable row level security;

-- 只有已认证用户可读（幂等，重复执行不报错）
do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'system_configs' and policyname = 'system_configs: authenticated read'
  ) then
    execute $p$
      create policy "system_configs: authenticated read"
        on public.system_configs for select
        to authenticated using (true)
    $p$;
  end if;
end $$;

-- Insert / update default config rows
insert into public.system_configs (key, value) values
  ('church_name', '{"name": ""}')
on conflict (key) do nothing;

insert into public.system_configs (key, value) values
  ('ai_circuit_breaker', '{"active": true, "disabled_at": null, "disabled_reason": ""}')
on conflict (key) do nothing;

insert into public.system_configs (key, value) values
  ('donation_settings', '{
    "title": "感恩奉献",
    "description": "",
    "amounts": [20, 50, 100, 200],
    "default_amount": 50,
    "currency": "USD",
    "show_on": []
  }')
on conflict (key) do nothing;

insert into public.system_configs (key, value) values
  ('payment_links', '{
    "wechat_pay": "",
    "alipay": "",
    "paypal": "",
    "venmo": "",
    "zelle": "",
    "label": "感恩奉献"
  }')
on conflict (key) do nothing;
