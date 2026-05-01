# Worked Example — REWORK

This example shows the skill scoring an idea that the verdict gate will mark REWORK. Use this to anchor scoring for ideas that have potential but are underspecified.

---

## Input

```json
{
  "idea": "A habit tracker designed for adults with ADHD that uses gentle nudges instead of streak-based gamification.",
  "buyer": "adults with ADHD",
  "pays_for": "monthly subscription for the app",
  "frequency": "monthly",
  "user_context": "I'm in a few ADHD subreddits and the existing habit apps don't work for me."
}
```

## Reasoning (not output — for skill internalization)

- **Paying proximity:** "Adults with ADHD" is more specific than "everyone" but still a broad category. The ADHD app market is real (Inflow, Numo, Routinery exist and have paying users) — so there's evidence of payment behavior. But the user hasn't named who specifically: which sub-cohort, what they pay now, what they're switching from. Score 5.
- **Build scope:** Standard CRUD + reminders + Stripe. Doable in 30 days. Score 8.
- **Validation cost:** ADHD subreddits are reachable but not a paid ad platform. Validation is possible through community posts and a landing page, but the user can't run a clean Meta ad to "adults with ADHD" — Meta will fight that targeting. Score 6.
- **Unfair advantage:** The user is "in a few ADHD subreddits" — that's some adjacent presence but not a real audience or distribution edge. They've lived the problem. Worth a 5 — it's earned insight but no distribution. Not a 7+ because there's no concrete audience or domain access stated.
- **Retention shape:** Habit trackers are weekly/daily-use products. Retention is high if the app actually works for the user. The "gentle nudges" angle could improve retention vs streak-based apps. Score 7.

Total: 31/50. All criteria ≥ 5. Below 35 threshold. Rule 4 fires. REWORK.

The weakest criterion is unfair advantage at 5 — that's where the user needs to clarify.

## Output

```json
{
  "scores": {
    "paying_proximity": {
      "score": 5,
      "reason": "ADHD adults pay for habit apps — but you haven't named which cohort or what they're switching from."
    },
    "build_scope": {
      "score": 8,
      "reason": "Standard tracker + reminders + Stripe — buildable in 30 days."
    },
    "validation_cost": {
      "score": 6,
      "reason": "Reachable through subreddits and ADHD communities, harder to ad-target cleanly."
    },
    "unfair_advantage": {
      "score": 5,
      "reason": "You've lived the problem and lurk in the communities — but you have no audience or distribution edge yet."
    },
    "retention_shape": {
      "score": 7,
      "reason": "Habit apps are weekly-use; the gentle-nudges angle could lift retention if it works."
    }
  },
  "headline_reason": "Real category, real problem — but you haven't named your edge or your specific buyer."
}
```

---

## What to learn from this example

- **REWORKs are specific about what's missing.** This isn't a bad idea — it's an underspecified one. The reasons name what's missing, not whether the idea is "good."
- **Don't pity-score.** The paying proximity is a real 5, not a charity 6. The user gets back to a KEEP by clarifying, not by being graded gently.
- **The headline reason gives the user the next step.** "Real category, real problem — but you haven't named your edge or your specific buyer" tells them exactly what to fix. The verdict gate will append "rerun when ready," but the headline does most of the work.
- **All criteria ≥ 5.** No floor breach. This is what separates REWORK from KILL. The idea has no fatal structural defect; it has clarification gaps.
- **The user has a 7-day grace.** They can refine and resubmit without burning a daily run. This is intentional — the REWORK loop is the brand's engine.
