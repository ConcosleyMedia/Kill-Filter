# PRD.md — Kill Filter

> Product requirements for the Kill Filter app. Read alongside `AGENTS.md` (build process) and `TechDesign.md` (technical architecture).

---

## 1. What it is

A free tool that scores a startup idea against a 5-criteria rubric and returns one of three verdicts: **KILL**, **REWORK**, or **KEEP**. On KEEP (Whop tier only), it generates four starter build files.

Two surfaces:

- **Public** (`buildroom.com/kill-filter`) — ungated, single idea, no file generation. Top-of-funnel acquisition.
- **Whop** (embedded iframe inside free Build Room) — full version, 1–3 ideas per run, file generation on KEEP. Free→paid funnel.

Same scoring engine. Different wrappers.

---

## 2. Why it exists (the three jobs)

1. Deliver the brand promise — brutal-but-respectful honesty AI usually doesn't give — as a wow moment.
2. Give enough value that the free tier (Whop free Build Room) is worth the user's time and attention.
3. Make the upgrade to paid Build Room ($9/mo) feel obvious without ever pitching it inside the verdict.

The tool is not an info product or a lead magnet. It is a credibility weapon. A user who experiences a calibrated kill on their own idea forms a trust signal that no marketing copy can produce. That trust carries them from public surface → free Build Room → paid Build Room.

---

## 3. Personas

### P1: "The Stuck Builder"

- Pays $180+/mo across Claude Max, Cursor, Lovable, ChatGPT.
- Has 5–15 half-formed ideas in a notes app.
- Has shipped nothing in 6+ months.
- Can't tell which idea is real.
- Bounces between tools, not problems.

**Where they enter:** Either via the marketing site landing page (public surface) or through the Whop free Build Room signup flow.

**What success looks like:** They run their pet idea, get a calibrated verdict, and either upgrade (KEEP momentum) or refine (REWORK loop) or move on (KILL). All three are wins for the funnel.

### P2: "The Cold Lurker"

- Found the public Kill Filter from an ad or share.
- No idea ready when they arrive.
- Will bounce within 30 seconds if there's no obvious next step.

**Where they enter:** Public surface only.

**What success looks like:** They click a preset, see the tool work, get curious, sign up for free Build Room.

### P3: "The Returning Refiner"

- Has used the tool before. Got a REWORK.
- Spent a few days thinking about the buyer.
- Comes back to retry within the 7-day grace window.

**Where they enter:** Whop or public.

**What success looks like:** Their refined idea moves from REWORK to KEEP (or to a more honest KILL) without burning a daily run.

---

## 4. Inputs (from user) and Outputs (to user)

### Inputs

For each idea, the user provides:

- Idea description (free text, 1–3 sentences)
- Buyer (free text)
- What they pay you for (free text)
- Frequency (one_time / monthly / yearly / unclear)
- User context (optional, free text — what makes them the right person to build this)

The structured fields are non-optional on Whop and required-but-skippable on public (skipping caps scores).

### Outputs

**Score breakdown:**
- 5 criteria, each scored 1–10 with a one-line reason
- Headline reason (one line capturing the dominant signal)
- Verdict: KILL / REWORK / KEEP

**On KEEP (Whop only):**
- Four starter files, downloadable as zip and copyable as markdown:
  - `CLAUDE.md` — master agent contract
  - `spec.md` — four-feature MVP scope
  - `stack.md` — locked tech stack with reasoning
  - `cut-list.md` — explicit do-not-build list

**Per-verdict footer copy:**

| Verdict | Footer |
|---------|--------|
| KILL | "Got killed? Good. Workshop the next one with people doing the same thing. → $9/mo" |
| REWORK | "Stuck on who pays? Members get unstuck in the Friday thread. → $9/mo" |
| KEEP | "These 4 files get you started. The full 10-file blueprint, the Wall-Skip Kit, and 50+ working repos are inside Build Room. → $9/mo" |

---

## 5. Verdict gate (deterministic)

Implemented in code. Mirrors `skill/verdict-gate.md` exactly.

- Any single criterion ≤ 2 → **KILL** (floor breach)
- Two or more criteria ≤ 3 → **KILL** (multiple weak signals)
- Total ≥ 35 (out of 50) AND all criteria ≥ 5 → **KEEP**
- Anything else → **REWORK**

User-facing scores display as /100 (raw scores doubled for cosmetic effect). The gate operates on raw scores.

---

## 6. Constraints

### Public surface
- 1 idea per run
- 3 runs/day per IP (soft limit — display CTA, not error)
- Per-IP-hash cache: same idea returns instant cached verdict
- No file generation
- No auth

### Whop surface
- 1–3 ideas per run
- 1 run/day, 5/week cap
- REWORK 7-day grace: same idea within 7 days doesn't consume a run
- Per-user cache (keyed on whop_user_id)
- File generation on KEEP
- Auth via Whop SDK; non-members see upgrade prompt

### Both surfaces
- Streaming output (line-by-line scoring, terminal aesthetic)
- Cache hits render instantly with "previously scored on [date]" header

---

## 7. Success metrics

### Job 1 — Wow / brand promise
- % of users who run the tool more than once in their first session (target: 60%+)
- % of Whop runs that score 3 ideas vs 1 (target: 40%+)
- % of public users who run a preset before pasting their own idea (instrument and learn)

### Job 2 — Free-tier value
- % of free Build Room members who use the Kill Filter within 7 days of joining (target: 70%+)
- Distribution of verdicts across all runs (target: ~35% KILL, ~35% REWORK, ~30% KEEP)
- Of REWORK verdicts, % who rerun within 7 days (target: 40%+)
- Daily-active rate among free Build Room members (instrument the 1/day rate limit's effect on daily check-ins)

### Job 3 — Conversion to paid
- % of free Build Room members who upgrade to $9/mo within 30 days, segmented by Kill Filter usage
- Per-verdict conversion + time-to-conversion (hypothesis: KILL fastest, REWORK 3–7 days, KEEP 14–30 days post-build-wall)
- Footer click-through rates by verdict
- Public → free Build Room signup rate

---

## 8. Calibration

The skill itself is the calibration. There is no test harness with "expected verdicts." Sharpness lives in three places: the rubric anchors, the deterministic verdict gate, the three worked examples.

Pre-launch dogfood: run 20–30 real ideas through the loaded skill. Where verdicts feel wrong, tune the skill. Lock at v1.0. Ship. Re-tune (and bump version) based on real verdict-distribution data after launch.

---

## 9. What's explicitly out of scope for v1

- Mobile native apps
- Team accounts on Whop
- Cross-user idea sharing or "killed ideas gallery"
- A separate calibration test set file
- Localization (English only)
- Multi-currency (USD only)
- Email magic link recovery for the public surface (no auth, no recovery needed)
- Embeddable widgets (Kill Filter on partner sites)
- API access for third parties

These are deliberate cuts. Any of them may be revisited post-launch with real user data, not without it.

---

## 10. Open product questions (require human decision)

These are flagged for the marketing/ad team — see Section 9 of the v4 blueprint:

1. Final per-verdict footer copy
2. Naming for ads ("The Idea Audit" alias for Meta — confirm or alternate)
3. Social-share affordance on public surface (yes/no)
4. Branded KEEP files: footer text confirmed?
5. Publishing redacted skill (rubric.md + verdict-gate.md) on marketing site as trust artifact

Decisions go in `AGENTS.md` Phase 4 before launch.
