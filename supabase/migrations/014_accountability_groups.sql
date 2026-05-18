-- ── 同行小组 ──────────────────────────────────────────────────────────────────

-- Drop old incorrectly-structured table if it exists from a failed migration
drop table if exists accountability_checkins;
drop table if exists accountability_group_members;
drop table if exists accountability_groups;

create table accountability_groups (
  id                    uuid        primary key default gen_random_uuid(),
  name                  text        not null,
  organizer_id          uuid        not null references auth.users(id) on delete cascade,
  invite_code           text        not null unique,
  goal_title            text,
  goal_description      text,
  goal_category         text        not null default 'custom',
  schedule_days_of_week integer[]   not null default '{}',
  schedule_time         text,
  start_date            date,
  end_date              date,
  created_at            timestamptz not null default now()
);

create table accountability_group_members (
  group_id     uuid  not null references accountability_groups(id) on delete cascade,
  user_id      uuid  not null references auth.users(id) on delete cascade,
  display_name text  not null,
  joined_at    timestamptz not null default now(),
  primary key (group_id, user_id)
);

create table accountability_checkins (
  id           uuid        primary key default gen_random_uuid(),
  group_id     uuid        not null references accountability_groups(id) on delete cascade,
  user_id      uuid        not null references auth.users(id) on delete cascade,
  checkin_date date        not null,
  status       text        not null check (status in ('done', 'missed', 'postponed')),
  note         text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (group_id, user_id, checkin_date)
);

-- Indexes for common query patterns
create index accountability_checkins_group_date
  on accountability_checkins(group_id, checkin_date);

create index accountability_checkins_user
  on accountability_checkins(user_id);

create index accountability_group_members_user
  on accountability_group_members(user_id);
