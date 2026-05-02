-- Kill Filter — Phase 1 schema (public surface only).
-- Whop tables (whop_users, daily_quota, weekly_quota) land in Phase 2.

-- Persisted scoring runs. Doubles as the cache: SELECT WHERE user_key, idea_hash.
create table if not exists runs (
  id uuid primary key default gen_random_uuid(),
  surface text not null check (surface in ('public', 'whop')),
  user_key text not null,                  -- ip_hash for public, whop_user_id for whop
  idea_hash text not null,                 -- sha256 of normalized idea object
  idea_normalized jsonb not null,
  scores jsonb not null,
  verdict text not null check (verdict in ('KILL', 'REWORK', 'KEEP')),
  rule text not null,                      -- gate rule that fired (floor_breach, multiple_weak, keep, rework_default)
  total int not null,                      -- raw 1-50 sum
  headline text not null,
  skill_version text not null,
  generated_files jsonb,                   -- KEEP-only, populated by /api/generate-files (Phase 2)
  created_at timestamptz not null default now()
);

create index if not exists idx_runs_user_key_idea_hash on runs(user_key, idea_hash);
create index if not exists idx_runs_user_key_created_at on runs(user_key, created_at desc);

-- Public-surface IP-keyed daily soft limit. 3/day per ip_hash; on hit, render the CTA.
create table if not exists public_ip_quota (
  ip_hash text not null,
  day date not null,
  runs_used int not null default 0,
  primary key (ip_hash, day)
);

-- RLS: lock everything down. Server-side service role bypasses RLS;
-- the anon/public role gets nothing. Belt + suspenders against accidental
-- exposure if the anon key is ever shipped to the client.
alter table runs enable row level security;
alter table public_ip_quota enable row level security;
