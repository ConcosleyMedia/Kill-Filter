# TechDesign.md — Kill Filter

> Technical architecture for the Kill Filter app. Read alongside `AGENTS.md` (build process) and `PRD.md` (product requirements).

---

## 1. Stack

| Layer | Tool | Notes |
|-------|------|-------|
| Frontend | Next.js 15 (App Router) | Server components for the route shell, client components for the terminal UI |
| Hosting | Vercel | Free tier OK for v1; bump to Pro at meaningful traffic |
| Database | Supabase (Postgres) | Auth (Whop tier doesn't use this), data tables, rate limit counters, cache |
| LLM | Anthropic API (Claude Sonnet 4.6 or current best) | Server-side only. Streaming via SSE. |
| Auth (Whop tier) | `@whop/sdk` server | `verifyUserToken` + `users.checkAccess` |
| Iframe (Whop tier) | `@whop/react` + `@whop/iframe` | Client-side embedded behavior |
| Observability | Vercel logs + Supabase logs | Posthog optional post-launch |

No Redis. No queues. No microservices. One Next.js app, one Postgres database. Add complexity only when needed.

---

## 2. Routes

| Route | Surface | Auth | Description |
|-------|---------|------|-------------|
| `/kill-filter` | Public | None | Single-idea scoring, no file generation |
| `/experience/[experienceId]` | Whop iframe | Whop SDK | Full version: 1–3 ideas, file generation on KEEP |
| `POST /api/score` | Both | Conditional | Scoring endpoint. Streams verdict via SSE. |
| `POST /api/enhance` | Both | Conditional | On REWORK or KILL — generates 3 enhanced versions of the user's same idea. |
| `POST /api/generate-files` | Whop only | Whop SDK | KEEP-only file generation |
| `GET /api/runs/quota` | Whop only | Whop SDK | Returns user's daily/weekly quota state |
| `POST /api/whop/webhook` | Whop only | Whop signature | Future: handle Whop subscription events |

---

## 3. Database schema (Supabase Postgres)

```sql
-- Users (Whop tier)
-- Created on first verified Whop user-token validation
create table whop_users (
  whop_user_id text primary key,
  first_seen_at timestamptz default now(),
  last_seen_at timestamptz default now()
);

-- Runs (both surfaces)
create table runs (
  id uuid primary key default gen_random_uuid(),
  surface text not null check (surface in ('public', 'whop')),
  user_key text not null, -- whop_user_id (whop) OR ip_hash (public)
  idea_hash text not null,
  idea_normalized jsonb not null,
  scores jsonb not null,
  verdict text not null check (verdict in ('KILL', 'REWORK', 'KEEP')),
  headline_reason text not null,
  skill_version text not null,
  generated_files jsonb, -- only for KEEP verdicts on Whop
  created_at timestamptz default now()
);

create index idx_runs_user_key_idea_hash on runs(user_key, idea_hash);
create index idx_runs_user_key_created_at on runs(user_key, created_at desc);

-- Daily quota counters (Whop only)
create table daily_quota (
  whop_user_id text not null,
  day date not null,
  runs_used int default 0,
  primary key (whop_user_id, day)
);

-- Weekly quota counters (Whop only)
create table weekly_quota (
  whop_user_id text not null,
  week_starting date not null, -- Monday of the week
  runs_used int default 0,
  primary key (whop_user_id, week_starting)
);

-- Public IP daily soft limit
create table public_ip_quota (
  ip_hash text not null,
  day date not null,
  runs_used int default 0,
  primary key (ip_hash, day)
);
```

### Cache strategy

- The `runs` table is the cache. A "cache hit" is a `SELECT` from `runs` matching `(user_key, idea_hash)` for the most recent row.
- Cache hits do not consume quota.
- Cache hits are surfaced with a "previously scored on {created_at}" header in the UI.

---

## 4. Scoring pipeline

```
User submits → /api/score
  ↓
Normalize input (server-side function)
  ↓
Compute idea_hash
  ↓
Check cache (SELECT runs WHERE user_key=? AND idea_hash=? ORDER BY created_at DESC LIMIT 1)
  ↓
Cache hit? → Stream cached scores instantly with "previously scored" header. Done.
  ↓
Cache miss → Check quota
  ↓
Quota exceeded? → Return rate-limit response with CTA. Done.
  ↓
Quota OK → Load skill (read SKILL.md, rubric.md, verdict-gate.md, all 3 examples from disk into context)
  ↓
Call Anthropic API with skill loaded + normalized idea (streaming)
  ↓
Stream Claude's JSON output token-by-token via SSE to client
  ↓
Parse final JSON server-side
  ↓
Apply verdict gate (lib/verdict-gate.ts) → KILL | REWORK | KEEP
  ↓
Persist to `runs` table with skill_version
  ↓
Increment quota counter
  ↓
Send verdict + persistence-confirmed payload to client
  ↓
On KEEP (Whop only): client calls /api/generate-files
```

### Input normalization

The structured input (`buyer`, `pays_for`, `frequency`, `user_context`) is normalized server-side to:

- Lowercase, trimmed
- Strip marketing language ("revolutionary," "AI-powered," "next-generation" → these get downweighted in the buyer field)
- Resolve frequency aliases ("yearly," "annual," "annually" → "yearly")
- Hash the normalized object (SHA-256 of stable JSON) → `idea_hash`

### Verdict gate (`lib/verdict-gate.ts`)

```typescript
export function applyVerdictGate(scores: Scores): Verdict {
  const values = [
    scores.paying_proximity.score,
    scores.build_scope.score,
    scores.validation_cost.score,
    scores.unfair_advantage.score,
    scores.retention_shape.score,
  ];

  // Rule 1: floor breach
  if (values.some(v => v <= 2)) return "KILL";

  // Rule 2: multiple weak signals
  if (values.filter(v => v <= 3).length >= 2) return "KILL";

  // Rule 3: keep
  const total = values.reduce((a, b) => a + b, 0);
  const allAboveFloor = values.every(v => v >= 5);
  if (total >= 35 && allAboveFloor) return "KEEP";

  // Rule 4: rework
  return "REWORK";
}
```

---

## 5. Anthropic API call

### System prompt (loaded skill)

The skill files are concatenated into the system prompt at request time:

```
[SKILL.md]
---
[rubric.md]
---
[verdict-gate.md]
---
[examples/kill-example.md]
---
[examples/rework-example.md]
---
[examples/keep-example.md]
```

### User message

```json
{
  "idea": "...",
  "buyer": "...",
  "pays_for": "...",
  "frequency": "...",
  "user_context": "..."
}
```

### Model parameters

- `model`: `claude-sonnet-4-6` (or current best — config-driven)
- `max_tokens`: 1500 (scoring fits in well under this)
- `temperature`: 0.3 (low — we want consistency, not creativity)
- `stream`: true

### Expected response

A single JSON object matching the schema in `SKILL.md`. Server parses, validates, applies the gate.

---

## 6. File generation (KEEP only, Whop only)

### Trigger

Client receives a KEEP verdict. Client calls `POST /api/generate-files` with the `run_id` from the scoring response.

### Server flow

```
Verify Whop auth
  ↓
Load run from runs table (must be KEEP, must belong to this user)
  ↓
Load 4 templates from /skill/templates/
  ↓
Call Anthropic API with:
  - System: file generation instructions + the 4 templates
  - User: idea object + scores + the user's context
  ↓
Parse Claude's response (4 markdown files filled with content)
  ↓
Persist to runs.generated_files
  ↓
Return to client
```

### File generation prompt structure

The system prompt for this call is separate from the scoring system prompt. It instructs Claude to:
- Read the four template files
- Fill placeholders specifically and concretely (no generic answers)
- Maintain the opinionated tone of the templates
- End each file with the branded footer

---

## 7. Whop integration

### Auth flow

```typescript
// app/experience/[experienceId]/page.tsx
import { whopsdk } from "@whop/sdk";

export default async function Page({ params, headers }) {
  const userToken = headers["x-whop-user-token"];
  const { userId } = await whopsdk.verifyUserToken(userToken);
  const { hasAccess } = await whopsdk.users.checkAccess(
    params.experienceId,
    { id: userId }
  );

  if (!hasAccess) {
    return <UpgradePrompt experienceId={params.experienceId} />;
  }

  return <KillFilter whopUserId={userId} />;
}
```

### Iframe behavior

- Use `@whop/iframe` client-side to handle external link opening (e.g., the upgrade CTA opens in a new tab outside the iframe).
- Future: integrate `@whop/iframe` purchase flow for in-app upgrade to paid Build Room.

---

## 8. Rate limiting

### Whop tier

```typescript
// Daily check
const today = formatDate(new Date()); // YYYY-MM-DD UTC
const dailyRow = await db.daily_quota.findFirst({
  where: { whop_user_id: userId, day: today }
});
if ((dailyRow?.runs_used ?? 0) >= 1) {
  return rateLimitedResponse({ scope: "daily" });
}

// Weekly check
const weekStart = formatDate(getMonday(new Date()));
const weeklyRow = await db.weekly_quota.findFirst({
  where: { whop_user_id: userId, week_starting: weekStart }
});
if ((weeklyRow?.runs_used ?? 0) >= 5) {
  return rateLimitedResponse({ scope: "weekly" });
}

// REWORK 7-day grace exception
const recentSameIdea = await db.runs.findFirst({
  where: {
    user_key: userId,
    idea_hash: ideaHash,
    verdict: "REWORK",
    created_at: { gte: sevenDaysAgo }
  }
});
if (recentSameIdea) {
  // Skip quota increment — this rerun is free
  return processWithoutQuotaCharge();
}
```

### Public tier

Same pattern, keyed on `ip_hash` (SHA-256 of client IP + a server-side salt). Limit 3/day. Soft fail with CTA, not error.

### Weekly reset

Vercel cron job at Monday 00:00 UTC truncates `weekly_quota` rows older than the current week. Daily quota auto-rolls because the day key changes.

---

## 9. Streaming (SSE)

The scoring endpoint returns Server-Sent Events:

```
event: criterion
data: {"criterion": "paying_proximity", "score": 8, "reason": "Your buyer is..."}

event: criterion
data: {"criterion": "build_scope", "score": 7, "reason": "..."}

... (5 events total)

event: verdict
data: {"verdict": "KEEP", "headline_reason": "...", "run_id": "..."}

event: done
data: {}
```

The client parses each event and renders progressively in the terminal UI. The verdict event includes the `run_id` which the client uses for the file generation call (Whop only) or to generate a permalink (future).

### Cache hit streaming

For a cache hit, the server still emits SSE events but with a leading `event: cached` event:

```
event: cached
data: {"previously_scored_at": "2026-04-15T..."}

event: criterion
data: {...}
```

Events fire all at once (not throttled), so the client renders instantly. The terminal UI shows the "previously scored" header above the verdict.

---

## 10. Environment variables

```
# Anthropic
ANTHROPIC_API_KEY=

# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Whop
WHOP_API_KEY=
WHOP_APP_ID=
WHOP_WEBHOOK_SECRET=

# App
NEXT_PUBLIC_APP_URL=
IP_HASH_SALT= # server-side salt for IP hashing (privacy)
SKILL_VERSION=1.0
```

---

## 11. Skill loading

The skill files live at `/skill/` in the repo. They are read at request time via `fs.readFileSync` (server-side) and concatenated into the system prompt. They are NOT bundled into the client.

A small in-memory cache holds the concatenated skill string keyed on `SKILL_VERSION`, so we don't re-read from disk on every request:

```typescript
// lib/load-skill.ts
let cached: { version: string; content: string } | null = null;

export function loadSkill(): string {
  const version = process.env.SKILL_VERSION!;
  if (cached?.version === version) return cached.content;

  const content = [
    "skill/SKILL.md",
    "skill/rubric.md",
    "skill/verdict-gate.md",
    "skill/enhancements.md",
    "skill/examples/kill-example.md",
    "skill/examples/rework-example.md",
    "skill/examples/keep-example.md",
  ]
    .map(p => fs.readFileSync(p, "utf-8"))
    .join("\n\n---\n\n");

  cached = { version, content };
  return content;
}
```

When the skill is updated and the version env var bumps, the cache invalidates on the next request.

---

## 12. Error handling

| Error | Response |
|-------|----------|
| Anthropic API timeout (>30s) | 504 with retry instructions, do not consume quota |
| Anthropic returns invalid JSON | 502, log the raw response, do not consume quota |
| Verdict gate produces unexpected verdict | 500, alert (this should never happen), do not consume quota |
| Whop auth fails | 401 with upgrade prompt |
| Quota exceeded | 429 with CTA payload (not an error UX) |
| Database write fails after successful Claude call | Return verdict to user but log error — better to show the result than lose the user's run |

---

## 13. Observability

Log to Vercel + Supabase. Key events:

- Run started (surface, user_key, idea_hash)
- Run completed (verdict, scores, latency, skill_version)
- Cache hit (user_key, idea_hash, age_of_cached_run)
- Quota exceeded (surface, user_key, scope: daily | weekly)
- File generation requested / completed
- Whop auth result (success / no-access)
- LLM call latency + token usage

Posthog (or similar) for funnel events: footer click-through, upgrade-to-paid clicks, signup-to-Whop conversions.

---

## 14. Deploy

- Vercel auto-deploy on push to `main`.
- Supabase migrations run via Supabase CLI on deploy.
- Skill version bumps require a commit + redeploy (env var change).
- Custom domain: `kill-filter.buildroom.com` (subdomain) OR `buildroom.com/kill-filter` (path) — preference TBD per marketing.

---

## 15. Security notes

- IP hashes use a server-side salt and are not reversible. The `ip_hash` is sufficient for rate limiting without storing PII.
- Whop user IDs are sensitive — never log full IDs in client-side code.
- The Anthropic API key is server-side only. Never bundle into client.
- Supabase RLS (Row-Level Security) is enabled on all tables. The service role key is used server-side only for inserts/updates.
- The Whop webhook endpoint validates signatures before processing.
