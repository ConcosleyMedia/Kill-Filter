# Enhancements Skill

This skill is loaded by Claude on the second API call after a verdict is returned, when the verdict is **REWORK** or **KILL**. It generates three enhanced versions of the user's same idea — not different ideas, not sibling products, not pivots. Enhancements.

The verdict gate (in code) decides whether to call this skill. The mode is passed in as input.

---

## What an "enhancement" is

An enhancement is **the user's same idea, sharpened around the criterion that scored weakest**. The product concept stays. The buyer, edge, price model, or retention frame changes — pick whichever the rubric flagged as the bottleneck.

If the user submitted "habit tracker for ADHD adults using gentle nudges instead of streaks" and unfair advantage scored a 5, an enhancement might be:

- "habit tracker for ADHD adults using gentle nudges, sold to ADHD coaches who assign it to clients (you have access to coaches because of your X background)"

Notice what stayed: habit tracker, ADHD adults, gentle nudges. Notice what changed: the buyer (now coaches, not the consumer), and the user's edge becomes "access to coaches" instead of "I lurk in subreddits."

What an enhancement is NOT:

- A different product (changing "habit tracker" to "habit coach matching service" is a sibling idea, not an enhancement).
- A different category (changing "ADHD" to "anxiety" is a different idea).
- A pricing tweak only (changing $9/mo to $19/mo with no buyer or edge change isn't an enhancement worth offering).

---

## Inputs you receive

```json
{
  "mode": "REWORK" | "KILL",
  "idea": "user's original idea text",
  "buyer": "user's submitted buyer",
  "pays_for": "...",
  "frequency": "...",
  "user_context": "what the user said about themselves (may be empty/weak)",
  "scores": {
    "paying_proximity": { "score": 5, "reason": "..." },
    "build_scope": { "score": 8, "reason": "..." },
    "validation_cost": { "score": 6, "reason": "..." },
    "unfair_advantage": { "score": 5, "reason": "..." },
    "retention_shape": { "score": 7, "reason": "..." }
  },
  "headline_reason": "..."
}
```

---

## What you produce

A JSON object with exactly three enhancements. No commentary, no preamble. Each enhancement carries both display content (`tag`, `idea`, `fit`) and the full set of form-field values (`fields`) so the client can pre-fill every field on the rerun form with one click.

```json
{
  "enhancements": [
    {
      "tag": "Sharper buyer",
      "idea": "the enhanced version of the user's idea, written as a single 1–2 sentence description for display on the option card",
      "fit": "Best if you have [specific situation or context that makes this version work for this user]",
      "fields": {
        "idea": "the enhanced idea, formatted exactly as the user would type it back into the idea field",
        "buyer": "the new buyer that matches this enhancement (specific cohort, named, narrow)",
        "pays_for": "what the buyer pays for under this enhancement, including price model if relevant",
        "frequency": "monthly | annual | one-time | per-seat (or whatever the new model is)",
        "you": "the user-context that would make this enhancement work — written as 'you ...' so the field reads as if the user is filling it in"
      }
    },
    {
      "tag": "...",
      "idea": "...",
      "fit": "...",
      "fields": { "idea": "...", "buyer": "...", "pays_for": "...", "frequency": "...", "you": "..." }
    },
    {
      "tag": "...",
      "idea": "...",
      "fit": "...",
      "fields": { "idea": "...", "buyer": "...", "pays_for": "...", "frequency": "...", "you": "..." }
    }
  ]
}
```

The `idea`, `fit`, and `tag` fields are for the option-card display in the UI. The `fields` object is what gets written into the form when the user clicks the card. Both layers must be coherent — the `fields.idea` should not contradict the card's `idea` description.

---

## Hard rules for the three enhancements

### Rule 1: Each enhancement targets a different criterion

The three options must enhance three different criteria. Never give the user three "sharper buyer" variants. The axes are:

- **Sharper buyer** — narrows or specifies who pays. Used when paying_proximity scored low.
- **Sharper edge** — names a different unfair advantage angle the user might have. Used when unfair_advantage scored low.
- **Sharper retention** — changes the use frequency or workflow embedding. Used when retention_shape scored low.
- **Sharper validation** — changes the buyer or angle to one that's easier to test cheaply. Used when validation_cost scored low.
- **Sharper scope** — narrows the product to a single-feature wedge. Used when build_scope scored low (rare; usually means dropping features, not adding).

Pick the three weakest criteria and write one enhancement per criterion. Tag each option with the angle name so the user can scan.

### Rule 2: Preserve the product concept

The product type stays. If the user said "habit tracker," all three enhancements are habit trackers. If the user said "invoicing tool," all three are invoicing tools. The category stays the same.

If you find yourself wanting to change the product (e.g., "what if it was a coaching service instead of an app"), stop. That's a sibling idea, not an enhancement. The skill does not produce sibling ideas.

### Rule 3: REWORK enhancements are smaller. KILL enhancements are bigger.

The mode input controls intensity:

- **REWORK mode:** light touch. Sharpen one dimension. The user is 80% of the way there. Each enhancement is a refinement, not a rebuild. Tone: "you almost have it — try this version."
- **KILL mode:** harder turn. The criterion that broke the verdict needs to be replaced, not nudged. Each enhancement substantially changes the broken criterion (different buyer cohort, different price model, different retention loop). Tone: "this exact framing won't work — here's how to rebuild around the broken criterion."

In KILL mode, the buyer or edge or retention shape changes meaningfully. In REWORK mode, the buyer gets *narrower* or the edge gets *named*, but it's recognizably the same setup.

### Rule 4: The "fit" line references the user's actual context

The `fit` field tells the user when this enhancement applies *to them*. Use the user_context field if provided. If user_context is empty or weak, infer from what the user implied (e.g., if they wrote "I'm in a few subreddits" you can infer "you have community access but no audience").

Good fit lines:

- "Best if you have a 4k+ newsletter of designers"
- "Best if you've been a paying user of an existing tool in this space"
- "Best if you have access to ADHD coaches or have run a coaching practice"

Bad fit lines:

- "Best if this fits your situation" (too vague)
- "Best for ambitious founders" (flattery, not fit)
- "Best if you want to make money" (everyone)

### Rule 5: Each idea field is 1–2 sentences. Maximum 35 words.

Concise. The user is scanning three options on a card layout. Long descriptions break the UX.

### Rule 6: No marketing language

No "revolutionary," "AI-powered," "next-generation," "disrupting." Write the way the rubric would. Plain, specific, diagnostic.

### Rule 7: Diversity of enhancement, not novelty

The three options should feel meaningfully different from each other (different criterion targeted), but they shouldn't compete on novelty. Don't try to make any single option sound dramatically more exciting than the others. The user picks based on which fit applies to them, not which sounds coolest.

---

## When user_context is empty or weak

Make a best guess. Do not refuse. Do not output a clarification request.

If user_context is empty, infer from the idea itself: people who build "X for Y" usually have some adjacency to Y. Write fit lines that name plausible adjacencies as conditionals: "Best if you have access to [the buyer cohort]" rather than asserting the user has it.

If user_context is weak (e.g., just "I think this would be cool"), the same rule applies — write fits that *would* make this enhancement work for *some* version of this user, even if you can't be sure it's them.

The user picks the option that matches their actual situation. The skill's job is to give them three real options to pick from.

---

## Worked example — REWORK mode

**Input:**

```json
{
  "mode": "REWORK",
  "idea": "A habit tracker for adults with ADHD using gentle nudges instead of streak gamification",
  "buyer": "adults with ADHD",
  "pays_for": "monthly subscription for the app",
  "frequency": "monthly",
  "user_context": "I'm in a few ADHD subreddits and existing apps don't work for me",
  "scores": {
    "paying_proximity": { "score": 5, "reason": "ADHD adults pay for habit apps but you haven't named which cohort." },
    "build_scope": { "score": 8, "reason": "Standard tracker + reminders + Stripe — buildable in 30 days." },
    "validation_cost": { "score": 6, "reason": "Reachable through subreddits, harder to ad-target cleanly." },
    "unfair_advantage": { "score": 5, "reason": "You've lived the problem and lurk in communities — but no audience or distribution edge yet." },
    "retention_shape": { "score": 7, "reason": "Habit apps are weekly-use; gentle-nudges angle could lift retention if it works." }
  }
}
```

Three weakest criteria: paying_proximity (5), unfair_advantage (5), validation_cost (6). One enhancement each.

**Output:**

```json
{
  "enhancements": [
    {
      "tag": "Sharper buyer",
      "idea": "A gentle-nudge habit tracker built specifically for adults newly diagnosed with ADHD (post-30 diagnosis cohort) who are rebuilding routines from scratch.",
      "fit": "Best if you've gone through a late-in-life diagnosis or have community access to people who have.",
      "fields": {
        "idea": "A gentle-nudge habit tracker for adults newly diagnosed with ADHD (post-30 diagnosis), rebuilding routines without streak-based shame loops",
        "buyer": "adults diagnosed with ADHD after age 30, in their first 12 months of figuring out routines",
        "pays_for": "monthly subscription, $12-15/mo, replacing free apps that don't fit their cognitive style",
        "frequency": "monthly subscription with weekly active use",
        "you": "you've been through a late-in-life diagnosis yourself, or have community access to people who have"
      }
    },
    {
      "tag": "Sharper edge",
      "idea": "The same gentle-nudge habit tracker, sold to ADHD coaches to assign and monitor with their clients — replacing the streak apps coaches dislike.",
      "fit": "Best if you have access to ADHD coaches, have run a coaching practice, or could pilot with one.",
      "fields": {
        "idea": "A gentle-nudge habit tracker designed for ADHD coaches to assign to clients between sessions, with progress dashboards for the coach",
        "buyer": "ADHD coaches running 1-on-1 client practices, 5-30 active clients",
        "pays_for": "per-seat subscription, $20-30/coach/mo, replacing pen-and-paper or generic habit apps",
        "frequency": "monthly per-seat subscription",
        "you": "you have access to ADHD coaches, have done coaching work yourself, or could pilot with one"
      }
    },
    {
      "tag": "Sharper validation",
      "idea": "A gentle-nudge habit tracker for ADHD adults already paying for Inflow or Numo who churned because streaks made them feel worse.",
      "fit": "Best if you're a paying user of an existing tool and can describe specifically why it stopped working for you.",
      "fields": {
        "idea": "A gentle-nudge habit tracker positioned as the alternative for ADHD adults who tried Inflow or Numo and quit because streak shame made things worse",
        "buyer": "ADHD adults who recently churned from Inflow, Numo, or similar streak-based ADHD apps",
        "pays_for": "monthly subscription, $9-15/mo, replacing the tool they just left",
        "frequency": "monthly subscription",
        "you": "you're a current or recent paying user of one of these tools and can describe exactly why it stopped working"
      }
    }
  ]
}
```

Notice: all three are habit trackers with gentle nudges. The product concept is unchanged. What varies is the buyer cohort and the criterion being sharpened. Each option's `fields` object is fully populated so the client can pre-fill the entire form on click.

---

## Worked example — KILL mode

**Input (same idea, but assume scores triggered KILL — paying_proximity = 2 because user wrote "everyone with ADHD"):**

```json
{
  "mode": "KILL",
  "idea": "A habit tracker for everyone with ADHD",
  "buyer": "everyone with ADHD",
  "scores": {
    "paying_proximity": { "score": 2, "reason": "'Everyone' isn't a buyer. No path to a credit card." },
    ...
  }
}
```

The verdict gate killed this on the paying_proximity floor breach. The enhancement skill needs to *replace* the buyer wholesale.

**Output:**

```json
{
  "enhancements": [
    {
      "tag": "Replace buyer with a paying cohort",
      "idea": "A habit tracker built specifically for ADHD coaches to assign to their clients between sessions, with progress dashboards for the coach.",
      "fit": "Best if you have access to ADHD coaches or have done coaching work yourself — the cohort that's already paying for client tools.",
      "fields": {
        "idea": "A habit tracker for ADHD coaches to assign to clients between sessions, with progress dashboards for the coach",
        "buyer": "ADHD coaches running 1-on-1 practices, 5-30 active clients",
        "pays_for": "per-seat subscription, $25-35/coach/mo, replacing manual client tracking",
        "frequency": "monthly per-seat subscription",
        "you": "you have access to ADHD coaches, have done coaching work, or could pilot with one"
      }
    },
    {
      "tag": "Replace buyer with a switching cohort",
      "idea": "A habit tracker for ADHD adults currently paying for Inflow or Numo and churning — the gentle-nudge alternative for streak-app refugees.",
      "fit": "Best if you've been a paying user of these tools and can describe specifically why their model stopped working.",
      "fields": {
        "idea": "A gentle-nudge habit tracker for ADHD adults churning out of Inflow, Numo, or similar streak-based apps",
        "buyer": "ADHD adults recently churned from Inflow, Numo, or similar streak-based ADHD apps",
        "pays_for": "monthly subscription, $9-15/mo, replacing the tool they just left",
        "frequency": "monthly subscription",
        "you": "you're a current or recent paying user of one of these tools and can describe specifically why their model stopped working"
      }
    },
    {
      "tag": "Replace retention loop with B2B framing",
      "idea": "A habit tracker for HR teams running ADHD-supportive workplace programs, deployed as a covered benefit for diagnosed employees.",
      "fit": "Best if you've worked in HR or DEI roles and have access to workplace mental-health budget owners.",
      "fields": {
        "idea": "A habit tracker for HR teams running ADHD-supportive workplace programs, deployed as a covered benefit for diagnosed employees",
        "buyer": "HR or DEI leads at companies with 200-2000 employees and existing wellness budgets",
        "pays_for": "annual contract, $5-10/employee/yr, augmenting existing wellness platforms",
        "frequency": "annual contract billed per-employee",
        "you": "you've worked in HR or DEI roles, or have direct access to benefit budget owners"
      }
    }
  ]
}
```

Notice: still habit trackers. Still ADHD. The buyer is now *named and paying* in all three cases — that's the KILL-mode harder turn. The `fields` object provides a complete rerun-ready form payload for each option.

---

## What you must not do

- Do not output sibling ideas (different products in the same space). That's a separate feature.
- Do not output more or fewer than 3 enhancements.
- Do not output options that all target the same criterion.
- Do not change the product concept (the noun the user used: "habit tracker," "invoicing tool," "scheduler").
- Do not flatter the user or use marketing language.
- Do not refuse to generate enhancements because user_context is weak. Make a best guess.
- Do not output anything but the JSON object.

---

## Versioning

This skill module is versioned with the rest of the skill bundle. Skill version is logged with every enhancement generation for audit purposes.
