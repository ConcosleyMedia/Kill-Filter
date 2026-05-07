# Kill Filter

> The Build Room tool that scores startup ideas. Brutal, calibrated, fast.
> Two surfaces: a public version on the marketing site (`/kill-filter`), a Whop-iframe version inside free Build Room (`/experience/[experienceId]`).

**Live:** https://kill-filter.vercel.app/kill-filter

---

## Current status (2026-05-07)

Phase 1 (public surface, scoring + cache + IP rate limit), Phase 2 (Whop iframe surface, KEEP file generation), Phase 2.5 (REWORK/KILL enhancement cards with server-side KEEP-validation), and Phase 3a (Whop daily/weekly quota + rate-limit screen + run counter) are all built and deployed. KEEP file generation runs on both public and Whop surfaces.

Pending: multi-idea input (Phase 3 task 1), analytics events (Phase 4), soft-launch observation (Phase 5).

---

## What's in this repo

```
.
├── README.md                ← you are here
├── CLAUDE.md                ← onboarding for Claude Code in this repo
├── AGENTS.md                ← master build contract; phase plan
├── PRD.md                   ← product requirements
├── TechDesign.md            ← technical architecture, schema, API surface
├── app/                     ← Next.js 15 App Router
│   ├── _kf/                 ← shared client UI (terminal, score row, verdict block,
│   │                          enhancement cards, KEEP file viewer, progress bars)
│   ├── api/
│   │   ├── score/           ← POST: stream verdict via SSE; surface auto-detected
│   │   ├── enhance/         ← POST: 3 KEEP-validated rework/rebuild options
│   │   ├── generate-files/  ← POST: 4 starter files on KEEP
│   │   ├── whop-quota/      ← GET: daily/weekly counter for the iframe TopBar
│   │   └── diag/            ← GET: env-var byte-count probe (temporary)
│   ├── experience/[experienceId]/  ← Whop iframe surface, auth-gated by token
│   ├── kill-filter/         ← public surface
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── lib/
│   ├── verdict-gate.ts      ← deterministic KILL/REWORK/KEEP, mirrors skill/verdict-gate.md
│   ├── score-idea.ts        ← pure scoring helper (no streaming/persistence) for /api/enhance validation
│   ├── load-skill.ts        ← loads skill bundles from disk, in-memory cached per SKILL_VERSION
│   ├── runs.ts              ← Supabase persistence: cache lookup, persistRun, generated_files update
│   ├── rate-limit.ts        ← public IP quota + Whop daily/weekly quota
│   ├── normalize.ts         ← idea normalization, idea_hash, ip_hash
│   ├── supabase.ts          ← service-role client (whitespace-stripped)
│   └── whop-sdk.ts          ← @whop/sdk singleton, verifyUserToken + checkAccess
├── supabase/migrations/
│   ├── 0001_phase1.sql      ← runs + public_ip_quota
│   └── 0002_phase3.sql      ← whop_user_quota
└── skill/                   ← the scoring methodology (the entire product)
    ├── SKILL.md             ← scoring skill entrypoint
    ├── rubric.md            ← the 5 criteria, sharply anchored
    ├── verdict-gate.md      ← spec for the deterministic gate
    ├── enhancements.md      ← REWORK/KILL enhancement skill (Rule 8: each option must score KEEP)
    ├── examples/            ← worked examples for the scoring skill
    └── templates/           ← four KEEP file templates with placeholder slots
```

The skill IS the methodology — it's the highest-leverage content in the project. Edit it carefully.

---

## How to use this repo

### If you're a human reviewing the methodology

Read in this order:
1. `PRD.md` — what the product is
2. `skill/rubric.md` — how it judges ideas
3. `skill/verdict-gate.md` — how it decides verdicts
4. `skill/examples/` — what good output looks like

If anything in the rubric anchors feels wrong, redline `rubric.md`. The anchors are the entire product.

### If you're Claude Code in this repo

1. **Read `CLAUDE.md` first** — operational rules + current state.
2. Then `AGENTS.md` for the phase plan and hard rules.
3. Then `PRD.md` and `TechDesign.md` for spec details.
4. The skill files are loaded at runtime by `lib/load-skill.ts`.

---

## The five criteria, in one sentence each

1. **Paying proximity** — how close is the buyer to a credit card right now?
2. **Build scope** — can a non-technical founder ship a working MVP in 30 days with Claude Code?
3. **Validation cost** — can demand be tested for under $50 before any code is written?
4. **Unfair advantage** — why this user, not someone faster or cheaper?
5. **Retention shape** — would the buyer come back next month, or use it once?

Sharp anchors for each are in `skill/rubric.md`.

---

## The three verdicts

| Verdict | Trigger | What the user gets |
|---------|---------|--------------------|
| **KILL** | Any criterion ≤ 2 OR two or more ≤ 3 | Score + one-line reason. 3 rebuild options (each pre-validated to score KEEP on rerun). |
| **REWORK** | Total < 35 OR any criterion < 5 (but no KILL trigger) | Score + 3 rework options (each pre-validated to score KEEP on rerun). Click → form pre-fills → 7-day refinement grace skips the rate limit. |
| **KEEP** | Total ≥ 35 AND all criteria ≥ 5 | Score + 4 starter files (`CLAUDE.md`, `spec.md`, `stack.md`, `cut-list.md`). Per-file copy + download-as-zip. |

Computed deterministically by `lib/verdict-gate.ts` (mirrors `skill/verdict-gate.md`). Not by the LLM.

Enhancement cards are server-side KEEP-validated: every option Sonnet generates gets re-scored against the rubric, the gate is applied, and only options that would land KEEP make it to the user. See `app/api/enhance/route.ts`.

---

## API routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/score` | POST | Score an idea. SSE-streams `criterion` events + final `verdict`. Surface auto-detected: verified `x-whop-user-token` → Whop, else IP-hashed public. Accepts `refinement_of: parent_run_id` for the 7-day grace. |
| `/api/enhance` | POST | Generate 3 KEEP-validated rework/rebuild options for a REWORK or KILL run. Each option is server-scored before being returned. |
| `/api/generate-files` | POST | Generate the 4 starter files for a KEEP run. Loads `skill/templates/*`, fills placeholder slots via Sonnet, persists to `runs.generated_files`. Cache-aware. |
| `/api/whop-quota` | GET | Returns the Whop user's current daily/weekly quota state for the iframe TopBar counter. |
| `/api/diag` | GET | Temporary env-var byte-count probe. Remove before public launch. |

---

## Local development

```bash
# Install dependencies
npm install

# Set up env vars
cp .env.example .env.local
# Fill in: ANTHROPIC_API_KEY, NEXT_PUBLIC_SUPABASE_URL,
#          NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY,
#          WHOP_API_KEY, WHOP_APP_ID, WHOP_WEBHOOK_SECRET,
#          IP_HASH_SALT, SKILL_VERSION

# Apply Supabase migrations
npx supabase db push

# Start the dev server
npm run dev
```

The public surface is at http://localhost:3000/kill-filter.

For the Whop iframe surface, the Whop edge proxy injects the `x-whop-user-token` header. Locally you'll want `npx @whop-apps/dev-proxy --command 'next dev --turbopack'` so the iframe behaves like prod. The proxy listens on :3000 and forwards a synthetic token. Reference: <https://docs.whop.com/sdk/local-development>.

### Tests

`npm test` runs the verdict-gate + load-skill unit tests under Node's built-in test runner.

### Build verification

`npm run build` (Turbopack) must complete without TypeScript errors before pushing — Vercel auto-deploys on push to `main`.

---

## Skill versioning

The skill is versioned in `SKILL_VERSION` (env var). Every run logs the skill version it used. When you change the rubric, the gate, or the examples:

1. Bump `SKILL_VERSION` (semver: minor for anchor refinements, major for criteria changes or gate threshold changes)
2. Commit the skill changes with the version bump
3. Redeploy

Existing cached verdicts retain their original skill version. They are not re-evaluated against the new skill.

---

## Why the skill is in the repo (not a service or CMS)

The skill is the methodology. We want it:
- Versioned in git
- Reviewable in PRs
- Auditable by anyone (we may publish redacted versions on the marketing site)
- Deployable atomically with the app

A separate skill service or CMS adds operational complexity and decouples the skill from the app version that consumed it. Files in the repo solve all of this for free.

---

## When something feels off

If a verdict on a real idea feels wrong, the failure mode is almost always one of three things, in this order:

1. **The rubric anchor is unclear.** Read the anchor for the score that feels off. Is the anchor specific enough to distinguish a 5 from a 6? If not, sharpen it.
2. **The example doesn't anchor the right tone.** The three examples in `skill/examples/` train Claude's output style. If real outputs feel generic or hedging, the examples may not be sharp enough.
3. **The gate threshold is off.** Less common — the gate has been deliberately tuned. Don't change it without running it against the dogfood set first.

Tune the skill, not the test set. The skill IS the calibration.

---

## Brand rule

The product promise: **"Most AI tells you yes. The Kill Filter is built to say no."**

Every soft score corrupts the brand. When Claude is tempted to score a 6 because the idea is "interesting" but the rubric anchor for 6 doesn't actually fit, the right answer is the lower score. The user's trust is earned by the calibration, not by encouragement.

---

## License

Internal Build Room asset. Not for redistribution.
