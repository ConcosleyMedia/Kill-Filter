# Worked Example — KEEP

This example shows the skill scoring an idea that the verdict gate will mark KEEP. Use this to anchor scoring for ideas that have specific buyers, achievable scope, and an edge.

---

## Input

```json
{
  "idea": "An invoicing tool specifically for freelance designers, with built-in client approval flows and Figma project links.",
  "buyer": "freelance designers running solo studios, $50–200k/yr revenue",
  "pays_for": "monthly subscription, replacing FreshBooks or QuickBooks",
  "frequency": "monthly",
  "user_context": "I'm a freelance designer with a 4k newsletter audience of other designers, and I've been doing this for 8 years."
}
```

## Reasoning (not output — for skill internalization)

- **Paying proximity:** Freelance designers are a named, specific cohort. They pay for FreshBooks, QuickBooks, Bonsai, HoneyBook today — real money, real recurring spend. The user names what the buyer would switch from. Score 8.
- **Build scope:** Invoice generation + Stripe + Figma OAuth + approval flow. 4 features but well-scoped. Standard stack handles all of it. 30 days is realistic. Score 8.
- **Validation cost:** The user has a 4k newsletter — they can validate by emailing the list. Designers are also reachable on Twitter/X, Threads, design Slack groups, and ad-targetable on Meta. Score 8.
- **Unfair advantage:** 4k newsletter audience of the exact buyer + 8 years in the industry = direct distribution edge. They will reach the buyer faster than any competitor without this audience. Score 8. (Not 9 because 4k is solid but not massive; not 7 because the audience is *exactly* the buyer, which is rarer than a generic following.)
- **Retention shape:** Invoicing is a monthly recurring workflow. Designers send invoices every project. Subscription is the obvious model and churn would be low if the product works. Score 8.

Total: 40/50. All criteria ≥ 5. Total ≥ 35. Rule 3 fires. KEEP.

## Output

```json
{
  "scores": {
    "paying_proximity": {
      "score": 8,
      "reason": "Freelance designers already pay for FreshBooks and Bonsai — the buyer is named and the spend exists."
    },
    "build_scope": {
      "score": 8,
      "reason": "Invoice + Stripe + Figma OAuth + approval flow — four features, standard stack, 30 days is realistic."
    },
    "validation_cost": {
      "score": 8,
      "reason": "Your newsletter alone validates this; Meta and Twitter give cheap top-up traffic."
    },
    "unfair_advantage": {
      "score": 8,
      "reason": "4k newsletter of the exact buyer and 8 years in the industry — you'll reach them faster than anyone."
    },
    "retention_shape": {
      "score": 8,
      "reason": "Designers invoice every project — recurring workflow, subscription fits."
    }
  },
  "headline_reason": "Named buyer, real spend, your audience is your edge — build it."
}
```

---

## What to learn from this example

- **KEEPs are evenly strong.** This isn't a 10/10 idea — it's an 8/8/8/8/8 idea. The rubric rewards consistency, not peaks. A 10/10/10/10/2 still kills (floor breach).
- **Specificity earns the score.** "Freelance designers running solo studios, $50–200k/yr" earns paying proximity 8. "Designers" alone would earn a 5.
- **The newsletter is the unfair advantage.** Without it, the user might score this idea a 5 on advantage and the total would drop below 35 → REWORK. With it, KEEP. This is what makes unfair advantage per-user.
- **The headline reason names the strength.** "Named buyer, real spend, your audience is your edge" is the dominant signal. The trailing "— build it" is permission, not coaching. We don't tell them what to build; we tell them they should build.
- **No score above 8 in this example.** That's intentional — 9–10 anchors require even sharper specificity (the user paying a specific competitor right now, an audience >5k of the exact buyer). 8s are common in real KEEPs; 9–10s are rare.
