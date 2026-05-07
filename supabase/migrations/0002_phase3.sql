-- Kill Filter — Phase 3 schema (Whop daily/weekly quota).
-- Public IP quota stays in 0001_phase1.sql. This adds per-Whop-user
-- quota tracking. We store one row per (whop_user_id, day); the weekly
-- check aggregates across the current ISO week (Monday UTC start).

create table if not exists whop_user_quota (
  whop_user_id text not null,
  day date not null,
  runs_used int not null default 0,
  primary key (whop_user_id, day)
);

create index if not exists idx_whop_user_quota_user_day
  on whop_user_quota(whop_user_id, day desc);

alter table whop_user_quota enable row level security;
