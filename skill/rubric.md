# Kill Filter Rubric

The five criteria. Score each 1–10 against the anchors below.

The anchors are sharp on purpose. They are the entire product. Read them before scoring every idea, every time. When two adjacent anchors both seem to fit, pick the lower one.

---

## 1. Paying Proximity

**Question: How close is the buyer to a credit card right now?**

This criterion measures whether a payable buyer exists, is identified, and is already spending money on this problem.

| Score | Anchor |
|-------|--------|
| **9–10** | The buyer is named specifically and is actively paying for a worse version of this product right now. The user has cited specific competitors the buyer pays. |
| **7–8** | The buyer is named specifically and is paying for adjacent solutions (workarounds, manual labor, generic tools they're shoehorning). Not yet paying for this exact thing but spending money in the area. |
| **5–6** | The buyer is named specifically but no evidence they pay for anything related. They have the problem but solve it free or ignore it. |
| **3–4** | The buyer is described by category ("small business owners," "freelancers") with no specific subset. No evidence of payment behavior. |
| **1–2** | The buyer is "everyone," "anyone with X," "people who," or unspecified. No path to a credit card. |

**Rules:**
- "Consumers" alone caps at 4. "Consumers" with a specific cohort (e.g., "30-something women buying their first home") can score higher if the rest of the anchor matches.
- B2B with a named role (e.g., "head of HR at companies with 20–200 employees") starts higher than B2C with no cohort.
- If the user can't name a competitor the buyer currently pays, cap at 6.

---

## 2. Build Scope

**Question: Can a non-technical founder ship a working MVP in 30 days using Claude Code?**

This criterion measures whether the build is achievable solo, fast, with the agent stack we teach.

| Score | Anchor |
|-------|--------|
| **9–10** | Single-feature wedge. One core flow. CRUD + auth + Stripe + a single piece of logic. Buildable in a weekend by someone who's shipped before, in 30 days by a beginner. |
| **7–8** | 2–3 core features, well-scoped. Standard stack (Next.js + Supabase + Stripe). No specialized infra. Doable in 30 days with some grit. |
| **5–6** | The core idea is buildable but requires one of: real-time features, complex permissions, AI fine-tuning, or significant data ingestion. Stretches the 30-day window. |
| **3–4** | Requires specialized infra (custom ML, complex integrations across 3+ APIs, mobile native, hardware) OR the scope is genuinely a platform, not a product. |
| **1–2** | Requires a team. Marketplaces (need both sides), social networks (need network effects), regulated products (legal/compliance), foundational AI models. |

**Rules:**
- "AI-powered X" does not automatically lower the score. Most AI products are wrappers and wrappers are 8–10.
- Marketplaces and social products cap at 3 unless the user has a pre-existing audience that solves the cold-start (which is captured separately under unfair advantage).
- If the user describes 4+ features as "the MVP," cap at 5. They don't have an MVP yet.

---

## 3. Validation Cost

**Question: Can demand be tested for under $50 before any code is written?**

This criterion measures whether the user can prove people want this without building.

| Score | Anchor |
|-------|--------|
| **9–10** | A $30 ad to a landing page with a $5 deposit / waitlist signup proves demand definitively. The buyer is on a paid ad platform (Meta, LinkedIn, Google). |
| **7–8** | A landing page + ad campaign tests demand cleanly, but the buyer is harder to reach (niche audience, requires audience-borrowing or cold outreach). |
| **5–6** | Demand testable through manual outreach (DMs, cold email, communities) — costs time more than money, but $50 is enough to test. |
| **3–4** | Demand testable but requires significant trust-building before anyone signals intent (high-stakes B2B, regulated industries, enterprise). |
| **1–2** | Cannot be tested without a built product. Or: requires both sides of a marketplace, network effects, or regulatory approval before any signal is meaningful. |

**Rules:**
- If the buyer is a known consumer cohort on a major ad platform, start at 8 and adjust down for friction.
- If the buyer is enterprise (>$50k contracts), cap at 5. Validation is real but slow and not money-bound.
- Marketplaces cap at 2 — you can't validate demand without supply, and vice versa.

---

## 4. Unfair Advantage

**Question: Why this user, and not someone faster or cheaper?**

This criterion is per-user. The same idea scores differently for different users. It measures the user's specific edge.

| Score | Anchor |
|-------|--------|
| **9–10** | The user has direct, named access to the buyer (audience >5k of the buyer, current employer is the buyer, domain expert with referrals lined up). They will reach the buyer faster than any competitor. |
| **7–8** | The user has earned, specific insight: years in the buyer's industry, specific painful workflow they've lived, a small but real audience, or distribution they've already built elsewhere. |
| **5–6** | The user has some relevant experience (worked adjacent to the buyer, has 1–2 contacts, has tried the workaround themselves) but no clear distribution edge. |
| **3–4** | The user is interested in the space but has no specific edge. They'd be starting from zero against anyone else who picks this idea. |
| **1–2** | The user has no advantage and the idea description reveals it ("I think this would be cool," "I noticed people complaining online," "I'm passionate about this"). |

**Rules:**
- "Passion" is a 2. Always. Passion is not an advantage; everyone with the idea has it.
- An audience counts only if it's the buyer's audience, not a generic following.
- "I'm a [role] with [X years] doing [thing the buyer also does]" is a 7–8.
- Do not score above 7 unless the user has stated a specific, concrete reason they will win. The bar here is intentional — most users overrate this and the rubric corrects.

---

## 5. Retention Shape

**Question: Would the buyer come back next month, or use it once?**

This criterion measures whether the product creates a recurring need or a one-time use.

| Score | Anchor |
|-------|--------|
| **9–10** | Embedded in a recurring workflow the buyer already does weekly or daily. Stops working without the product. Subscription is the obvious model. |
| **7–8** | Used in a recurring workflow but not weekly — monthly cadence (invoicing, reporting, planning). Subscription works but churn is higher. |
| **5–6** | Used periodically (quarterly, seasonally, around specific events). Hard to subscription-price; fits transactional or annual billing. |
| **3–4** | One-and-done utility. Buyer uses it for a specific event or migration and is done. Hard to monetize beyond a single transaction. |
| **1–2** | Single-use, novelty, or "I solved my own problem and now I'm productizing it" with no clear repeat use. |

**Rules:**
- Productivity tools default to 7+ if used weekly. Cap at 5 if used quarterly or less.
- "Generators" (logo, name, business plan) cap at 4 — the buyer makes the thing once and leaves.
- Education products are tricky: cohort-based caps at 5 (one cohort, done); ongoing community/curriculum can score 8.
- If the user describes the product as "a tool I'd use for [single event]," cap at 4.

---

## When to round down

The rubric is biased toward kill. When you're between two scores and the evidence is mixed, pick the lower one. The verdict gate is calibrated against this. Soft scoring corrupts the calibration.

## What is not in the rubric

- "Is the idea novel?" — Not in the rubric. Novelty isn't required to ship a real business. Most KEEPs are unsexy.
- "Will the founder enjoy building it?" — Not our problem.
- "Is the market big enough?" — Captured indirectly through paying proximity. A small market with paying buyers beats a large market with no buyers.

If you find yourself wanting to score against something not on this list, stop. Use the five criteria.
