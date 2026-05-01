# Worked Example — KILL

This example shows the skill scoring an idea that the verdict gate will mark KILL. Use this to anchor your scoring style and tone.

---

## Input

```json
{
  "idea": "An AI-powered journaling app that uses sentiment analysis to give you mental health insights.",
  "buyer": "anyone who wants to improve their mental health",
  "pays_for": "subscription to access AI insights",
  "frequency": "monthly",
  "user_context": "I've struggled with anxiety and I think this would have helped me."
}
```

## Reasoning (not output — for skill internalization)

- **Paying proximity:** "Anyone who wants to improve mental health" is the canonical "everyone with a phone" buyer. No specific cohort, no evidence anyone in this category currently pays for journaling. Apps like Day One and Journey exist and most users use them free. Score 2.
- **Build scope:** Buildable. CRUD app + LLM call + auth + Stripe. Wrapper-tier complexity. Score 8.
- **Validation cost:** A landing page with a $5 deposit could test, but the buyer is so vague that the ad targeting will be a guess. Score 4.
- **Unfair advantage:** "I've struggled with anxiety and I think this would have helped me" is the textbook "passion" anchor. The user has no audience, no domain access, no edge. Score 2.
- **Retention shape:** Journaling apps have notoriously poor retention. The category has 80%+ 30-day churn. Even with AI, daily use is hard. Score 4.

Two floor breaches (paying proximity 2, unfair advantage 2). Rule 1 fires. KILL.

## Output

```json
{
  "scores": {
    "paying_proximity": {
      "score": 2,
      "reason": "Your buyer is anyone with a phone — there's no path to a credit card."
    },
    "build_scope": {
      "score": 8,
      "reason": "Buildable as a wrapper in 30 days; the build isn't the problem."
    },
    "validation_cost": {
      "score": 4,
      "reason": "Hard to test — your buyer is too vague to target an ad at."
    },
    "unfair_advantage": {
      "score": 2,
      "reason": "Personal experience with the problem isn't an edge — every founder in this space has it."
    },
    "retention_shape": {
      "score": 4,
      "reason": "Journaling apps churn at 80%+ in 30 days; AI doesn't fix that."
    }
  },
  "headline_reason": "No buyer, no edge, and a category that doesn't retain."
}
```

---

## What to learn from this example

- **Reasons are specific.** "No clear ICP" would fail. "Your buyer is anyone with a phone" lands.
- **Reasons are second person.** The user submitted this; you're talking to them.
- **The build scope is honest.** It's an 8 because the build is genuinely easy. We don't drag down the build score to "punish" a bad idea — that's not what build scope measures. Each criterion is independent.
- **Personal experience is a 2 on unfair advantage.** Always. The rubric is firm on this and the example reinforces it.
- **The headline reason captures the dominant signal.** Two floor breaches + a weak retention shape = "no buyer, no edge, and a category that doesn't retain." Compact, specific, lands.
