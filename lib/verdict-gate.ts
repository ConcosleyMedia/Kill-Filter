// Deterministic verdict gate. Mirrors skill/verdict-gate.md exactly.
// This file is the canonical implementation; the skill doc is the spec.
// Any change to thresholds = a new skill version. See skill/verdict-gate.md §Versioning.

export type Criterion =
  | "paying_proximity"
  | "build_scope"
  | "validation_cost"
  | "unfair_advantage"
  | "retention_shape";

export const CRITERIA = [
  "paying_proximity",
  "build_scope",
  "validation_cost",
  "unfair_advantage",
  "retention_shape",
] as const satisfies readonly Criterion[];

export type Score = { score: number; reason: string };
export type Scores = Record<Criterion, Score>;

export type Verdict = "KILL" | "REWORK" | "KEEP";

export type Rule =
  | "floor_breach"      // KILL: any criterion <= 2
  | "multiple_weak"     // KILL: two or more criteria <= 3
  | "keep"              // KEEP: total >= 35 AND all >= 5
  | "rework_default";   // REWORK: anything else

export type GateResult = {
  verdict: Verdict;
  rule: Rule;
  total: number;            // raw 1–10 sum (max 50)
  display_total: number;    // doubled for /100 user-facing display
  weakest: Criterion;       // lowest-scoring criterion (for headline routing)
  weakest_pair: [Criterion, Criterion] | null; // two weakest, only set when rule = multiple_weak
};

const ORDER: readonly Criterion[] = CRITERIA;

export function applyVerdictGate(scores: Scores): GateResult {
  const values = ORDER.map((c) => scores[c].score);
  const total = values.reduce((a, b) => a + b, 0);

  // Sort criteria by score asc to find weakest / weakest pair.
  const ranked = ORDER
    .map((c) => ({ c, v: scores[c].score }))
    .sort((a, b) => a.v - b.v);
  const weakest = ranked[0].c;

  // Rule 1: floor breach — any criterion <= 2.
  if (values.some((v) => v <= 2)) {
    return {
      verdict: "KILL",
      rule: "floor_breach",
      total,
      display_total: total * 2,
      weakest,
      weakest_pair: null,
    };
  }

  // Rule 2: multiple weak signals — two or more criteria <= 3.
  if (values.filter((v) => v <= 3).length >= 2) {
    return {
      verdict: "KILL",
      rule: "multiple_weak",
      total,
      display_total: total * 2,
      weakest,
      weakest_pair: [ranked[0].c, ranked[1].c],
    };
  }

  // Rule 3: KEEP — total >= 35 AND all criteria >= 5.
  if (total >= 35 && values.every((v) => v >= 5)) {
    return {
      verdict: "KEEP",
      rule: "keep",
      total,
      display_total: total * 2,
      weakest,
      weakest_pair: null,
    };
  }

  // Rule 4: REWORK — default.
  return {
    verdict: "REWORK",
    rule: "rework_default",
    total,
    display_total: total * 2,
    weakest,
    weakest_pair: null,
  };
}

// Compute the user-facing headline reason per skill/verdict-gate.md §"Headline reason routing".
// The skill produces `headline_reason` for KEEP. KILL/REWORK headlines route off the scores.
export function computeHeadline(
  result: GateResult,
  scores: Scores,
  skillHeadlineReason: string
): string {
  if (result.verdict === "KEEP") return skillHeadlineReason;

  if (result.verdict === "KILL") {
    if (result.rule === "floor_breach") {
      return scores[result.weakest].reason;
    }
    // multiple_weak: combine the two weakest reasons.
    const [a, b] = result.weakest_pair!;
    return `${scores[a].reason} ${scores[b].reason}`;
  }

  // REWORK: name the single weakest criterion's reason. The UI appends "rerun when ready".
  return scores[result.weakest].reason;
}
