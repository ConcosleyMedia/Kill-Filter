# Verdict Gate

This document specifies how scores from the Kill Filter rubric are converted into one of three verdicts: **KILL**, **REWORK**, or **KEEP**.

The gate is **deterministic**. It is implemented in code (server-side) and mirrored here for documentation, audit, and skill awareness. The skill (`SKILL.md`) does **not** assign verdicts — it produces scores. The gate consumes those scores.

---

## The rules, in order of precedence

The gate evaluates rules top-down. The first rule that matches sets the verdict.

### Rule 1 — KILL by floor breach

If **any single criterion scores 1 or 2**, the verdict is **KILL**.

Rationale: a score of 1–2 on any criterion means the idea has a structural defect that cannot be salvaged by reworking. No buyer (paying proximity 1–2) cannot be rephrased into a buyer. A team-required build (build scope 1–2) cannot be talked down to a solo project.

### Rule 2 — KILL by multiple weak signals

If **two or more criteria score 3 or below**, the verdict is **KILL**.

Rationale: two or more weak signals compound. An idea with a vague buyer (3) AND no unfair advantage (3) is not a clarification problem; it's a category problem. Reworking won't fix it.

### Rule 3 — KEEP

If **the total score is 60 or above** AND **all five criteria score 5 or above**, the verdict is **KEEP**.

Rationale: 60/50 is an average of 6 across all criteria, which the rubric defines as "specific, viable, and tractable on every dimension." The 5-floor prevents lopsided ideas (e.g., a 9 on paying proximity but a 4 on build scope) from passing on aggregate.

### Rule 4 — REWORK (default)

Anything else — **REWORK**.

Rationale: an idea that doesn't kill on rules 1 or 2 but doesn't keep on rule 3 has potential but is underspecified. The user needs to clarify which criterion is dragging the score and resubmit.

---

## Examples

| Scores | Total | Verdict | Why |
|--------|-------|---------|-----|
| 8 / 9 / 8 / 7 / 8 | 40 | KEEP | Above 60 floor on all criteria, total ≥ 60 |
| 8 / 9 / 8 / 4 / 8 | 37 | REWORK | Total ≥ 60 but unfair advantage below 5 floor |
| 6 / 6 / 6 / 6 / 6 | 30 | REWORK | All ≥ 5 but total below 60 |
| 8 / 8 / 8 / 2 / 8 | 34 | KILL | Floor breach on unfair advantage |
| 4 / 4 / 6 / 8 / 6 | 28 | KILL | Two criteria ≤ 3 (rule 2) — wait, none ≤ 3 here |
| 3 / 3 / 6 / 8 / 6 | 26 | KILL | Two criteria ≤ 3 |
| 1 / 8 / 8 / 8 / 8 | 33 | KILL | Floor breach on paying proximity |
| 5 / 5 / 5 / 5 / 5 | 25 | REWORK | All ≥ 5 but total below 60 |

---

## Headline reason routing

When the verdict is KILL, the displayed reason follows this priority:

1. If Rule 1 fired (any criterion 1–2), the headline reason is the rubric reason for the lowest-scoring criterion.
2. If Rule 2 fired (two or more ≤ 3), the headline reason combines the two weakest criteria.
3. Otherwise, fall back to the skill's `headline_reason` field.

When the verdict is REWORK, the headline reason names the **single weakest criterion** and tells the user what to clarify before resubmitting. Example: "Your buyer is unclear. Rerun with: who specifically pays, and what are they paying for now?"

When the verdict is KEEP, the headline reason is the skill's `headline_reason` — a positive one-line summary of the dominant strength.

---

## Pseudocode

```javascript
function verdictGate(scores) {
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
  const weakCount = values.filter(v => v <= 3).length;
  if (weakCount >= 2) return "KILL";

  // Rule 3: keep
  const total = values.reduce((a, b) => a + b, 0);
  const allAboveFloor = values.every(v => v >= 5);
  if (total >= 60 && allAboveFloor) return "KEEP";

  // Rule 4: rework
  return "REWORK";
}
```

Note: the rubric scores 1–10, so the maximum total is 50 — not 60 as written above. **Rule 3 should read: total ≥ 35 with all criteria ≥ 5.** This is the version implemented in code. The "60/100" figure cited in earlier blueprints was a marketing simplification (rescaling 50 → 100 for user-facing display); the gate operates on the raw 1–10 scores.

### Corrected Rule 3

If **total ≥ 35** (out of 50) AND **all five criteria score 5 or above** → **KEEP**.

For the user-facing display, scores are doubled to render out of 100 (so a 35/50 displays as 70/100). This is cosmetic only.

---

## Versioning

This gate is part of the skill's versioned bundle. Any change to the thresholds (the 35, the 5-floor, the 1–2 floor breach, the 3-or-below count) constitutes a new skill version. Existing cached verdicts are tagged with the skill version that produced them and are not re-evaluated when the gate changes — this preserves audit trail and prevents users seeing their old verdicts shift.

---

## What this gate is not

- **Not an LLM call.** It's pure code. No interpretation, no edge-case judgment.
- **Not user-tunable.** Users do not get to argue the gate. They can request rescore by resubmitting with clarified inputs (which goes through the rubric again).
- **Not negotiable.** Build Room paid members get more runs, more files, and the rework lab — but they get the same verdict gate. The gate is the methodology; the methodology is the brand.
