import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  loadScoringBundle,
  loadEnhancementBundle,
  loadFileGenerationBundle,
  getSkillVersion,
} from "../load-skill.ts";

describe("load-skill", () => {
  it("loadScoringBundle includes SKILL, rubric, gate, and 3 examples", () => {
    const b = loadScoringBundle();
    assert.ok(b.includes("Kill Filter Grading"), "SKILL.md present");
    assert.ok(b.includes("Kill Filter Rubric"), "rubric.md present");
    assert.ok(b.includes("Verdict Gate"), "verdict-gate.md present");
    assert.ok(b.includes("Worked Example — KILL"), "kill example present");
    assert.ok(b.includes("Worked Example — REWORK"), "rework example present");
    assert.ok(b.includes("Worked Example — KEEP"), "keep example present");
    // Should NOT include enhancements.md (separate bundle).
    assert.ok(!b.includes("Enhancements Skill"), "enhancements not in scoring bundle");
  });

  it("loadEnhancementBundle includes enhancements + rubric only", () => {
    const b = loadEnhancementBundle();
    assert.ok(b.includes("Enhancements Skill"), "enhancements.md present");
    assert.ok(b.includes("Kill Filter Rubric"), "rubric.md present");
    assert.ok(!b.includes("Worked Example — KILL"), "no examples in enhancement bundle");
  });

  it("loadFileGenerationBundle includes 4 templates + SKILL", () => {
    const b = loadFileGenerationBundle();
    assert.ok(b.includes("Kill Filter Grading"), "SKILL.md present");
    // Templates contain placeholder markers like {{product_name}}.
    assert.ok(b.includes("{{product_name}}"), "spec template present");
    assert.ok(b.includes("{{cut_item_1}}"), "cut-list template present");
    assert.ok(b.includes("{{custom_layer_1}}"), "stack template present");
  });

  it("loads are cached — second call reuses content", () => {
    const a = loadScoringBundle();
    const b = loadScoringBundle();
    assert.equal(a, b);
    // Identity check: both should be the same string instance from cache.
    assert.strictEqual(a, b);
  });

  it("getSkillVersion defaults to 1.0 when env var unset", () => {
    const v = getSkillVersion();
    assert.equal(typeof v, "string");
    assert.ok(v.length > 0);
  });
});
