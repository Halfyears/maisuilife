-- Insert default system_configs rows if they don't already exist

insert into system_configs (key, value) values
  ('church_name', '{"name": ""}')
on conflict (key) do nothing;

insert into system_configs (key, value) values
  ('donation_settings', '{
    "title": "感恩奉献",
    "description": "",
    "amounts": [20, 50, 100, 200],
    "default_amount": 50,
    "currency": "USD",
    "show_on": []
  }')
on conflict (key) do nothing;

insert into system_configs (key, value) values
  ('payment_links', '{
    "wechat_pay": "",
    "alipay": "",
    "paypal": "",
    "venmo": "",
    "zelle": "",
    "label": "感恩奉献"
  }')
on conflict (key) do nothing;
