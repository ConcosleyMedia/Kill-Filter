// Verifies lib/verdict-gate.ts against every worked example in skill/verdict-gate.md
// and skill/examples/*. Run with: npm test
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  applyVerdictGate,
  computeHeadline,
  CRITERIA,
  type Scores,
} from "../verdict-gate.ts";

function s(values: [number, number, number, number, number]): Scores {
  return {
    paying_proximity: { score: values[0], reason: `pp:${values[0]}` },
    build_scope:      { score: values[1], reason: `bs:${values[1]}` },
    validation_cost:  { score: values[2], reason: `vc:${values[2]}` },
    unfair_advantage: { score: values[3], reason: `ua:${values[3]}` },
    retention_shape:  { score: values[4], reason: `rs:${values[4]}` },
  };
}

describe("applyVerdictGate — worked examples from skill/verdict-gate.md", () => {
  it("8/9/8/7/8 = 40 → KEEP (all ≥ 5, total ≥ 35)", () => {
    const r = applyVerdictGate(s([8, 9, 8, 7, 8]));
    assert.equal(r.verdict, "KEEP");
    assert.equal(r.rule, "keep");
    assert.equal(r.total, 40);
    assert.equal(r.display_total, 80);
  });

  it("8/9/8/4/8 = 37 → REWORK (unfair_advantage below 5 floor)", () => {
    const r = applyVerdictGate(s([8, 9, 8, 4, 8]));
    assert.equal(r.verdict, "REWORK");
    assert.equal(r.rule, "rework_default");
    assert.equal(r.weakest, "unfair_advantage");
  });

  it("6/6/6/6/6 = 30 → REWORK (all ≥ 5 but total below 35)", () => {
    const r = applyVerdictGate(s([6, 6, 6, 6, 6]));
    assert.equal(r.verdict, "REWORK");
    assert.equal(r.rule, "rework_default");
    assert.equal(r.total, 30);
  });

  it("8/8/8/2/8 = 34 → KILL (floor breach on unfair_advantage)", () => {
    const r = applyVerdictGate(s([8, 8, 8, 2, 8]));
    assert.equal(r.verdict, "KILL");
    assert.equal(r.rule, "floor_breach");
    assert.equal(r.weakest, "unfair_advantage");
  });

  it("3/3/6/8/6 = 26 → KILL (two criteria ≤ 3)", () => {
    const r = applyVerdictGate(s([3, 3, 6, 8, 6]));
    assert.equal(r.verdict, "KILL");
    assert.equal(r.rule, "multiple_weak");
    assert.deepEqual(r.weakest_pair?.sort(), ["build_scope", "paying_proximity"].sort());
  });

  it("1/8/8/8/8 = 33 → KILL (floor breach on paying_proximity)", () => {
    const r = applyVerdictGate(s([1, 8, 8, 8, 8]));
    assert.equal(r.verdict, "KILL");
    assert.equal(r.rule, "floor_breach");
    assert.equal(r.weakest, "paying_proximity");
  });

  it("5/5/5/5/5 = 25 → REWORK (all ≥ 5 but below 35)", () => {
    const r = applyVerdictGate(s([5, 5, 5, 5, 5]));
    assert.equal(r.verdict, "REWORK");
    assert.equal(r.rule, "rework_default");
  });
});

describe("applyVerdictGate — examples from skill/examples/*", () => {
  it("kill-example: 2/8/4/2/4 → KILL (two floor breaches; rule 1 wins)", () => {
    const r = applyVerdictGate(s([2, 8, 4, 2, 4]));
    assert.equal(r.verdict, "KILL");
    assert.equal(r.rule, "floor_breach"); // rule 1 takes precedence over rule 2
  });

  it("rework-example: 5/8/6/5/7 → REWORK (all ≥ 5, total 31 < 35)", () => {
    const r = applyVerdictGate(s([5, 8, 6, 5, 7]));
    assert.equal(r.verdict, "REWORK");
    assert.equal(r.total, 31);
    // Either paying_proximity or unfair_advantage may rank first when tied at 5;
    // both are valid weakest picks.
    assert.ok(["paying_proximity", "unfair_advantage"].includes(r.weakest));
  });

  it("keep-example: 8/8/8/8/8 → KEEP (perfect 8s, total 40)", () => {
    const r = applyVerdictGate(s([8, 8, 8, 8, 8]));
    assert.equal(r.verdict, "KEEP");
    assert.equal(r.total, 40);
  });
});

describe("applyVerdictGate — boundary cases", () => {
  it("total exactly 35 with all ≥ 5 → KEEP", () => {
    const r = applyVerdictGate(s([7, 7, 7, 7, 7]));
    assert.equal(r.verdict, "KEEP");
    assert.equal(r.total, 35);
  });

  it("total 34 with all ≥ 5 → REWORK (just below threshold)", () => {
    const r = applyVerdictGate(s([7, 7, 7, 7, 6]));
    assert.equal(r.verdict, "REWORK");
    assert.equal(r.total, 34);
  });

  it("score of exactly 2 → KILL (floor inclusive)", () => {
    const r = applyVerdictGate(s([2, 9, 9, 9, 9]));
    assert.equal(r.verdict, "KILL");
    assert.equal(r.rule, "floor_breach");
  });

  it("score of exactly 3 in only one criterion → not enough for rule 2", () => {
    const r = applyVerdictGate(s([3, 8, 8, 8, 8]));
    assert.equal(r.verdict, "REWORK"); // 3 alone doesn't trigger rule 2; 3 doesn't trigger rule 1
    assert.equal(r.total, 35);
    // total is 35 but one criterion is 3 < 5 → fails KEEP floor
  });

  it("two scores of exactly 3 → KILL (rule 2 fires inclusively at 3)", () => {
    const r = applyVerdictGate(s([3, 3, 8, 8, 8]));
    assert.equal(r.verdict, "KILL");
    assert.equal(r.rule, "multiple_weak");
  });
});

describe("computeHeadline", () => {
  it("KEEP returns the skill's headline_reason verbatim", () => {
    const scores = s([8, 8, 8, 8, 8]);
    const r = applyVerdictGate(scores);
    const h = computeHeadline(r, scores, "Named buyer, real spend, your audience is your edge — build it.");
    assert.equal(h, "Named buyer, real spend, your audience is your edge — build it.");
  });

  it("KILL by floor breach returns the lowest criterion's reason", () => {
    const scores = s([2, 8, 8, 8, 8]);
    scores.paying_proximity.reason = "your buyer is anyone with a phone";
    const r = applyVerdictGate(scores);
    const h = computeHeadline(r, scores, "skill-headline");
    assert.equal(h, "your buyer is anyone with a phone");
  });

  it("KILL by multiple weak combines the two weakest reasons", () => {
    const scores = s([3, 3, 8, 8, 8]);
    scores.paying_proximity.reason = "buyer too vague.";
    scores.build_scope.reason = "scope too big.";
    const r = applyVerdictGate(scores);
    const h = computeHeadline(r, scores, "skill-headline");
    // Order is [weakest, second-weakest] — both are 3 here. We just check both reasons appear.
    assert.ok(h.includes("buyer too vague."));
    assert.ok(h.includes("scope too big."));
  });

  it("REWORK returns the single weakest criterion's reason", () => {
    const scores = s([5, 8, 8, 5, 8]); // two tied at 5; either is a valid weakest
    scores.paying_proximity.reason = "you haven't named your buyer cohort";
    scores.unfair_advantage.reason = "no audience or distribution edge yet";
    const r = applyVerdictGate(scores);
    const h = computeHeadline(r, scores, "skill-headline");
    assert.ok(
      h === "you haven't named your buyer cohort" || h === "no audience or distribution edge yet"
    );
  });
});

describe("CRITERIA constant", () => {
  it("exposes all 5 in canonical order", () => {
    assert.deepEqual(CRITERIA, [
      "paying_proximity",
      "build_scope",
      "validation_cost",
      "unfair_advantage",
      "retention_shape",
    ]);
  });
});
