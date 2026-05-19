-- Add daily_scripture to system_configs defaults
insert into public.system_configs (key, value) values
  ('daily_scripture', '{"verse": "", "ref": ""}')
on conflict (key) do nothing;
