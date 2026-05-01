# AGENTS.md

> The master contract for Claude Code building the Kill Filter app.
> Read this before anything else. Read it again before each new phase.

---

## What you are building

The Kill Filter — a tool that scores startup ideas against a 5-criteria rubric and returns one of three verdicts: KILL, REWORK, or KEEP. Two surfaces: a public ungated route on the marketing site, and a Whop-iframe-embedded route inside the free Build Room.

Read `PRD.md` for product details. Read `TechDesign.md` for the technical architecture. Read this file for the build process.

---

## Hard rules — read every time

1. **Phase 0 is the skill, not the app.** Do not write Next.js code, do not scaffold a project, do not touch the database until the skill is locked at v1.0. The skill is the entire product. The app is the wrapper.
2. **The verdict gate is code, not LLM.** Never use Claude to decide KILL/REWORK/KEEP. The gate is deterministic. If you find yourself writing a prompt that asks the model to "decide the verdict," stop and re-read `skill/verdict-gate.md`.
3. **One feature, end-to-end, before the next.** Auth working in production before scoring. Scoring working in production before file generation. File generation in production before multi-idea support.
4. **Read the file before editing it.** Always. Especially `skill/rubric.md` — its anchors are load-bearing.
5. **Verify before declaring done.** "It compiles" is not done. "It works in deployed Vercel" is done.
6. **Stop at the three walls.** Auth, Stripe, deploy. If any takes >30 min, stop and ask the human, don't grind.

---

## Phase 0 — The Skill (3–4 days, no code)

The skill is the entire methodology of the product. Get it right before anything else.

### Tasks

1. Review and refine `skill/SKILL.md`. Confirm the inputs/outputs match `TechDesign.md` Section 4.
2. Review and **redline** `skill/rubric.md`. The anchors are the highest-leverage content in the project. Read each criterion's 1-10 scale, hold it against three real ideas (one obvious-bad, one borderline, one obvious-good), and adjust anchors that produce wrong scores.
3. Confirm `skill/verdict-gate.md` thresholds match what you want shipping. The 35/50 threshold and the 5-floor are deliberate.
4. Read all three examples in `skill/examples/`. Confirm the output style matches what the user-facing terminal will display. Edit if not.
5. Review the four templates in `skill/templates/`. Confirm placeholder slots are sufficient for the file generation prompt to fill.
6. **Dogfood:** Run 20–30 real ideas through Claude with the loaded skill. Read the JSON outputs. Where verdicts feel wrong, ask: is the anchor unclear? Is the example unhelpful? Is the gate threshold off? Adjust the skill, not the test set.
7. Lock the skill at v1.0. Tag in git.

### Acceptance criteria for Phase 0

- The skill is dogfooded against 20+ real ideas and the verdicts feel sharp on every one.
- A redacted version of `rubric.md` and `verdict-gate.md` could be published publicly without embarrassment.
- You can answer "why did my idea get a KILL" by pointing to a specific anchor and a specific gate rule.

**Do not start Phase 1 until Phase 0 is locked.**

---

## Phase 1 — Core Engine + Public Surface (4–5 days)

Build the public route at `/kill-filter`. Single idea, no auth, no file generation, IP-rate-limited.

### Tasks

1. Scaffold Next.js 15 (App Router) on Vercel. Connect a Supabase project.
2. Build the structured-input UI: terminal aesthetic, idea field + buyer/pays_for/frequency fields, preset buttons.
3. Implement the scoring API route (`POST /api/score`). Loads the skill, calls Claude with streaming, normalizes input, computes idea_hash, checks per-IP cache, persists results.
4. Implement the verdict gate as code in `lib/verdict-gate.ts`. Mirror `skill/verdict-gate.md` exactly.
5. Stream scoring output to the client via SSE. Render line-by-line in the terminal UI.
6. Implement IP-based rate limiting: 3/day soft limit. On hit, render the CTA, not an error.
7. Render the per-verdict footer copy (see `PRD.md` Section 3).
8. Cache hits render instantly with "previously scored" header.

### Acceptance criteria for Phase 1

- A user can paste an idea on `/kill-filter`, get a streaming verdict in under 60 seconds, and see a clear CTA to free Build Room.
- The verdict gate produces verdicts that match Phase 0 dogfood expectations.
- IP rate limit works (test by running 4 ideas from one IP — 4th should hit the CTA wall).
- Cache hit works (resubmit the same normalized idea — instant render with previous-verdict header).
- Deployed live on Vercel at a public URL.

---

## Phase 2 — Whop Integration + File Generation (3–4 days)

Build the Whop-iframe route. Add the four-file generation on KEEP.

### Tasks

1. Install `@whop/sdk` (server) and `@whop/react` + `@whop/iframe` (client).
2. Implement the Whop auth flow at `/experience/[experienceId]`: verify x-whop-user-token, check membership access.
3. If no access, render an upgrade-to-Whop-membership prompt. If access, render the tool.
4. Migrate the per-IP cache to per-user cache (keyed on whop_user_id) for the Whop route.
5. Implement the second Claude call for file generation on KEEP. Loads `skill/templates/`, fills placeholder slots based on normalized idea + scoring output.
6. Render the four files in the UI as collapsible markdown blocks. Make them downloadable as a zip and copyable individually.
7. Each file ends with the branded footer ("Generated by the Kill Filter · buildroom.com").

### Acceptance criteria for Phase 2

- A Whop free Build Room member can open the Kill Filter inside the Whop iframe and score ideas.
- A KEEP verdict generates four files within 30 seconds of the score completing.
- Files are downloadable as a zip and copyable as markdown.
- A non-member sees the upgrade prompt, not the tool.

---

## Phase 2.5 — Enhancement Generation (REWORK + KILL paths) (2 days)

After verdict, REWORK and KILL trigger a second Claude call that generates 3 enhanced versions of the user's same idea.

### Tasks

1. Build `/api/enhance` endpoint. Accepts: run_id, mode (REWORK or KILL), forwards to Claude with the `enhancements.md` skill module loaded.
2. The skill enforces: same product concept preserved, three different criteria targeted, REWORK = light touch, KILL = harder turn (replace the broken criterion).
3. Stream the JSON output back to the client (fast — typically <8 seconds).
4. Client renders 3 cards. Click pre-fills the idea field and shows "idea sharpened/rebuilt" banner.
5. 7-day grace applies to both REWORK and KILL enhancement reruns — same idea_hash within 7 days does not consume a daily run. (KILL enhancements still preserve the product concept, so the idea_hash is treated as a refinement.)
6. If user_context is empty, the skill makes a best guess (does not prompt for clarification).

### Acceptance criteria for Phase 2.5

- REWORK and KILL verdicts both render the 3-card enhancement section after the verdict.
- All 3 enhancement options are recognizably the user's same product concept.
- Each option targets a different criterion (verified by a server-side check against the option tags).
- Click → pre-fill → rerun loop works end-to-end with no daily-run penalty within 7 days.

---

## Phase 3 — Multi-idea + Whop Rate Limit (2 days)

### Tasks

1. Update the input UI to accept 1–3 ideas. Each scored independently in sequence.
2. Implement the daily/weekly rate limit on Whop: 1/day, 5/week. Reset weekly via Vercel cron.
3. Implement the REWORK 7-day grace: same idea_hash within 7 days does not consume a daily/weekly run.
4. Build the loud rate-limit-hit screen. This is the one place the upsell shouts.
5. Update the run counter UI: "Today's run used. 4 of 5 weekly runs remaining. Resets [date]."

### Acceptance criteria for Phase 3

- A Whop user can score up to 3 ideas in one run.
- A user who's used today's run cannot score another fresh idea, but can rerun a REWORK from the past 7 days without penalty.
- The rate-limit-hit screen displays the upgrade CTA prominently.

---

## Phase 4 — Polish + Funnel Instrumentation (2 days)

### Tasks

1. Confirm per-verdict footer copy matches the marketing-approved version in `PRD.md`.
2. Wire analytics events for every metric in `PRD.md` Section 7.
3. Add the social-share affordance to the public surface (if approved by marketing).
4. Final UX polish on the terminal aesthetic — streaming animation timing, font, color treatment per the existing landing-page brand.
5. Cross-browser test (Chrome, Safari, Firefox, mobile Safari, mobile Chrome).

### Acceptance criteria for Phase 4

- All metrics from `PRD.md` Section 7 are firing to analytics.
- Visual polish matches the existing landing page brand.
- Works on mobile.

---

## Phase 5 — Soft Launch (1 week observation)

### Tasks

1. Public surface live on `buildroom.com/kill-filter`. Watch IP traffic and signup-to-free-Build-Room rate.
2. Push the Whop surface to existing free Build Room members. Watch verdict distribution.
3. After 1 week of data, evaluate: does the verdict distribution match the ~35/35/30 target? If not, adjust skill (and bump version).

### Acceptance criteria for Phase 5

- Verdict distribution within ±10 percentage points of the 35/35/30 target.
- No critical bugs reported in the first 100 runs.
- Public-to-Whop signup rate measurable.

---

## Phase 6 — Ad Variants + Paid Traffic (1 week setup, ongoing)

### Tasks

1. Set up "The Idea Audit" creative variants for Meta (the word "kill" is restricted on Meta — use the alias).
2. Run a small test budget ($300) to the public surface. Measure cost per free-Build-Room signup.
3. If the funnel converts, scale gradually.

---

## Agent behavior rules (apply across all phases)

- **Plan first, code second.** For every task, write the plan in a comment or scratch doc before implementing.
- **Read before writing.** Always read the current state of a file before modifying it. Especially the skill files.
- **Don't generalize prematurely.** Build for the spec, not for imagined future needs. Resist the urge to add abstractions.
- **Don't touch the cut list.** See `cut-list.md` (when generated for users) — same principle for this build. The features in this AGENTS.md are the build. Anything else is out.
- **Verify before moving on.** A phase is done when its acceptance criteria are met in production, not when the local build runs.
- **Ask the human at decision points.** If a tradeoff is ambiguous, ask. Don't pick.

---

## What is NOT in this build

- No mobile native apps. Responsive web only.
- No team accounts on Whop. Each Whop user is independent.
- No idea sharing between users (cross-user dedup was removed in v3).
- No "calibration test set" file. The skill IS the calibration (this was simplified in v4).
- No localization. English only at v1.
- No payment processing for the free tool. Whop handles all money for the membership tier.

---

## Skill version

This build targets Kill Filter skill v1.0. If the skill is updated post-launch, bump the app version and re-test the verdict pipeline before deploying.
