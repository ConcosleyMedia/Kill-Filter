# CLAUDE.md

> Read this first if you're Claude Code starting a session in this repo.
> Then read `AGENTS.md` for the phase plan, `PRD.md` for product context,
> `TechDesign.md` for architecture details, and the `skill/` files when
> you need to understand the methodology.

---

## What this is

The Kill Filter — a tool that scores startup ideas against a 5-criteria rubric and returns KILL / REWORK / KEEP. Two surfaces:

- **Public:** `/kill-filter` — ungated, IP-rate-limited (3/day), top-of-funnel.
- **Whop iframe:** `/experience/[experienceId]` — auth-gated by `x-whop-user-token`, per-user quota (1/day, 5/week).

Brand promise: *"Most AI tells you yes. The Kill Filter is built to say no."* Every soft score corrupts the brand.

---

## Hard rules (do not violate)

1. **The skill is the product.** `skill/rubric.md` anchors are load-bearing. Don't modify them casually. If a verdict feels wrong, the failure mode is almost always (1) the anchor is unclear, (2) the example doesn't anchor the right tone, or (3) the gate threshold is off. In that order.

2. **The verdict gate is code, not LLM.** `lib/verdict-gate.ts` is canonical. Never have the model "decide the verdict" — it scores; the gate decides.

3. **One feature end-to-end before the next.** Auth working in production before scoring. Scoring in production before file generation. Etc. See `AGENTS.md`.

4. **Read before editing.** Especially the skill files and `AGENTS.md`.

5. **Verify in deployed Vercel.** "It compiles" is not done. The Vercel auto-deploy URL is https://kill-filter.vercel.app — push to `main` triggers a build.

6. **Local commits only by default.** Push to `origin/main` (= deploy) only when the user is ready. The user reads `git log` to follow progress, so commit messages matter.

---

## Where things live

### Skill (the methodology)
- `skill/SKILL.md` — scoring skill entrypoint (returns scores, not a verdict)
- `skill/rubric.md` — the 5 criteria with sharp anchors
- `skill/verdict-gate.md` — spec for the deterministic gate
- `skill/enhancements.md` — REWORK/KILL enhancement skill. **Rule 8 is load-bearing**: every enhancement must be constructed to score KEEP when rerun (≥5 every criterion, ≥35 total).
- `skill/examples/` — worked examples that anchor scoring tone
- `skill/templates/` — four KEEP files with placeholder slots

### App code
- `app/_kf/shared.tsx` — presentational components (Terminal, ScoreRow, VerdictBlock, Enhancements, ScoringProgress, RefinementBanner). Both surfaces import from here.
- `app/_kf/keep-files.tsx` — KEEP files viewer (collapsible markdown blocks, per-file copy, download-as-zip).
- `app/kill-filter/page.tsx` — public surface client page.
- `app/experience/[experienceId]/page.tsx` — server component, Whop auth gate.
- `app/experience/[experienceId]/experience-tool.tsx` — Whop iframe client tool.
- `app/api/*` — see README "API routes" table.

### Lib
- `lib/verdict-gate.ts` — `applyVerdictGate(scores)` returns `{verdict, rule, total, ...}`. Mirrors `skill/verdict-gate.md` exactly.
- `lib/score-idea.ts` — pure scoring helper. No streaming, no persistence. Used by `/api/enhance` for KEEP-validation.
- `lib/load-skill.ts` — caches skill bundles by `SKILL_VERSION`.
- `lib/runs.ts` — Supabase persistence. `findCachedRun`, `persistRun`, `getRunForUser`, `updateGeneratedFiles`.
- `lib/rate-limit.ts` — `getPublicQuota` / `incrementPublicQuota` (IP-keyed) + `getWhopQuota` / `incrementWhopQuota` (user-keyed, daily + weekly).
- `lib/normalize.ts` — `normalizeIdea`, `ideaHash`, `ipHash`. The `idea_hash` is the cache key.
- `lib/supabase.ts` — service-role client. **Strips whitespace from env vars** because Vercel paste-corruption injects LF bytes mid-JWT.
- `lib/whop-sdk.ts` — `@whop/sdk` singleton. `verifyUserToken(headers)` returns `{userId}`; `users.checkAccess(experienceId, {id})` returns `{has_access, access_level}` (snake_case).

### Database
Supabase project `qaobganmxcynkuzhjuiv`. Migrations in `supabase/migrations/`:
- `0001_phase1.sql`: `runs` (also serves as cache, keyed on `user_key + idea_hash`), `public_ip_quota`.
- `0002_phase3.sql`: `whop_user_quota` (one row per `(whop_user_id, day)`; weekly aggregates current ISO week).

Service role bypasses RLS. RLS is enabled with no policies on all tables — anon/public role gets nothing.

---

## How a request flows

### Public surface scoring
1. User submits → `POST /api/score`
2. `detectWhopUser` returns null (no token) → `surface: "public"`, `userKey = ipHash(clientIp)`
3. Cache lookup: same `(user_key, idea_hash)` → instant cached response, no quota cost
4. If `refinement_of` is present and validates (parent run owned by same `user_key`, ≤7 days old, REWORK/KILL) → skip IP quota
5. Else if quota exceeded → 429 with CTA payload
6. Score via Sonnet 4.6 → apply gate → persist to `runs` → SSE-stream `criterion` events + final `verdict`

### Enhancement (REWORK/KILL)
1. UI fetches `POST /api/enhance` with `run_id`
2. Server validates run ownership by `user_key`, requires `verdict in (REWORK, KILL)`
3. Generate 3 enhancements via Sonnet (load `skill/enhancements.md` + `skill/rubric.md`)
4. **Score each in parallel via `lib/score-idea.ts`**, apply gate, filter to KEEP-scoring only
5. If <3 pass, regenerate a second batch (deduped on tag) and validate
6. Return up to 3 verified-KEEP options. Worst-case latency ~26s.

### KEEP file generation
1. UI fetches `POST /api/generate-files` with `run_id`
2. Auth: verified Whop token OR `ip_hash`. Run ownership checked by `user_key`.
3. If `runs.generated_files` already populated → return cached blob
4. Else: load `skill/templates/*` + `skill/SKILL.md`, ask Sonnet to fill ~58 placeholder slots as JSON, server-substitute into templates, persist
5. Return `{files: { "CLAUDE.md", "spec.md", "stack.md", "cut-list.md" }}`

---

## Style + conventions

- **No comments unless the WHY is non-obvious.** Don't explain WHAT the code does.
- **Don't add abstractions for hypothetical needs.** Don't add error handling for cases that can't happen.
- **Multi-line `console.error` for prod debugging.** Vercel runtime log column truncates long messages — split errors into name/code/message/details lines like `app/api/score/route.ts` does.
- **Strip whitespace from env-loaded JWTs and URLs** — Vercel dashboard paste injects LF + indent. See `lib/supabase.ts`.
- **Tests:** Node's built-in test runner via `npm test`. Located in `lib/__tests__/`.
- **Type-check before pushing:** `npx tsc --noEmit` and `npm run build`.

---

## Common gotchas

- **Vercel deploys are auto-triggered by `git push origin main`.** The user has a Vercel MCP — Claude can list deployments + pull logs but cannot edit env vars. Env var changes happen in the dashboard.
- **The `x-whop-user-token` header only arrives on requests to `window.location.origin` of the iframe.** That's why local dev needs `@whop-apps/dev-proxy`.
- **Cache hits don't consume quota.** Refinement runs (with `refinement_of`) also don't consume quota for 7 days.
- **Quota is per-surface.** Public uses `ipHash`, Whop uses `whop_user_id`. The same idea_hash by the same person on different surfaces produces two cache entries because the user_key differs by design.
- **`@whop/api` is deprecated** — use `@whop/sdk` (the Stainless-generated REST client).
- **The Vercel runtime log MCP truncates the message column.** Use multi-line `console.error` calls so each field fits its own row.

---

## What's NOT built yet

- Multi-idea input (1-3 ideas per Whop run) — Phase 3 task 1.
- Vercel cron for any kind of weekly reset (the current weekly quota is computed on-the-fly via ISO week, no cron needed).
- Analytics events / funnel instrumentation — Phase 4.
- Soft-launch + ad variants — Phase 5/6.

See `AGENTS.md` for the full phase plan.

---

## When the user says

- **"continue" / "what's next" / "go"** — execute the next logical step in `AGENTS.md`. The user defers technical/architecture decisions; make the call and briefly note the tradeoff if non-obvious.
- **"deploy"** — `git push origin main`. Vercel auto-builds.
- **A bug report from prod** — pull Vercel runtime logs (`mcp__claude_ai_Vercel__get_runtime_logs`), inspect the runs table via Supabase MCP if needed, surface the actual error before guessing.
