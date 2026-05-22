-- Migration 027: upgrade notification_prefs to rich object array
-- Each item: { id, label, enabled, time, freq }

-- Update default for new rows
ALTER TABLE users
  ALTER COLUMN notification_prefs
  SET DEFAULT '[
    {"id":"morning","label":"晨间内室","enabled":true,"time":"07:00","freq":"daily"},
    {"id":"checkin","label":"同行打卡","enabled":true,"time":"20:00","freq":"daily"},
    {"id":"vigil",  "label":"守望消息","enabled":true,"time":"",    "freq":"realtime"},
    {"id":"sunday", "label":"主日报告","enabled":true,"time":"09:00","freq":"weekly"},
    {"id":"monthly","label":"月度报告","enabled":true,"time":"08:00","freq":"monthly"}
  ]'::jsonb;

-- Migrate existing rows that still have the old boolean-map format (or empty object)
UPDATE users
SET notification_prefs = '[
  {"id":"morning","label":"晨间内室","enabled":true,"time":"07:00","freq":"daily"},
  {"id":"checkin","label":"同行打卡","enabled":true,"time":"20:00","freq":"daily"},
  {"id":"vigil",  "label":"守望消息","enabled":true,"time":"",    "freq":"realtime"},
  {"id":"sunday", "label":"主日报告","enabled":true,"time":"09:00","freq":"weekly"},
  {"id":"monthly","label":"月度报告","enabled":true,"time":"08:00","freq":"monthly"}
]'::jsonb
WHERE jsonb_typeof(notification_prefs) = 'object';
