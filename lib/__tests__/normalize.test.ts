import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeIdea,
  normalizeFrequency,
  ideaHash,
  ipHash,
} from "../normalize.ts";

describe("normalizeFrequency", () => {
  it("maps annual aliases to 'yearly'", () => {
    assert.equal(normalizeFrequency("annually"), "yearly");
    assert.equal(normalizeFrequency("Annual"), "yearly");
    assert.equal(normalizeFrequency("YEARLY"), "yearly");
  });

  it("maps monthly aliases to 'monthly'", () => {
    assert.equal(normalizeFrequency("monthly"), "monthly");
    assert.equal(normalizeFrequency("subscription"), "monthly");
    assert.equal(normalizeFrequency("Month-to-Month"), "monthly");
  });

  it("maps one-time aliases to 'one_time'", () => {
    assert.equal(normalizeFrequency("once"), "one_time");
    assert.equal(normalizeFrequency("one-time"), "one_time");
    assert.equal(normalizeFrequency("ONETIME"), "one_time");
  });

  it("returns 'unclear' for empty input", () => {
    assert.equal(normalizeFrequency(""), "unclear");
    assert.equal(normalizeFrequency("   "), "unclear");
  });

  it("passes through unknown values lowercased", () => {
    assert.equal(normalizeFrequency("Quarterly"), "quarterly");
  });
});

describe("normalizeIdea", () => {
  it("lowercases buyer and pays_for, preserves idea and user_context casing", () => {
    const n = normalizeIdea({
      idea: "An Invoicing Tool",
      buyer: "FREELANCE Designers",
      pays_for: "Monthly Subscription",
      frequency: "monthly",
      user_context: "I'm a Designer",
    });
    assert.equal(n.idea, "An Invoicing Tool");
    assert.equal(n.buyer, "freelance designers");
    assert.equal(n.pays_for, "monthly subscription");
    assert.equal(n.user_context, "I'm a Designer");
  });

  it("strips marketing tokens from buyer and pays_for", () => {
    const n = normalizeIdea({
      idea: "An AI-powered tool",
      buyer: "AI-powered freelance designers",
      pays_for: "revolutionary monthly subscription",
      frequency: "monthly",
      user_context: "",
    });
    // idea field is preserved as-is — those tokens are signal, not noise, in the idea text.
    assert.equal(n.idea, "An AI-powered tool");
    // buyer/pays_for get the strip.
    assert.equal(n.buyer, "freelance designers");
    assert.equal(n.pays_for, "monthly subscription");
  });

  it("trims whitespace", () => {
    const n = normalizeIdea({
      idea: "  habit tracker  ",
      buyer: "  adults  ",
      pays_for: "  monthly  ",
      frequency: " monthly ",
      user_context: "   ",
    });
    assert.equal(n.idea, "habit tracker");
    assert.equal(n.buyer, "adults");
    assert.equal(n.pays_for, "monthly");
    assert.equal(n.user_context, "");
  });
});

describe("ideaHash", () => {
  it("produces a stable 64-char hex hash", () => {
    const h = ideaHash({
      idea: "x",
      buyer: "y",
      pays_for: "z",
      frequency: "monthly",
      user_context: "",
    });
    assert.match(h, /^[0-9a-f]{64}$/);
  });

  it("is identical for the same normalized input", () => {
    const a = ideaHash({ idea: "x", buyer: "y", pays_for: "z", frequency: "monthly", user_context: "" });
    const b = ideaHash({ idea: "x", buyer: "y", pays_for: "z", frequency: "monthly", user_context: "" });
    assert.equal(a, b);
  });

  it("differs when any field changes", () => {
    const base = { idea: "x", buyer: "y", pays_for: "z", frequency: "monthly", user_context: "" };
    const h0 = ideaHash(base);
    assert.notEqual(h0, ideaHash({ ...base, idea: "x2" }));
    assert.notEqual(h0, ideaHash({ ...base, buyer: "y2" }));
    assert.notEqual(h0, ideaHash({ ...base, pays_for: "z2" }));
    assert.notEqual(h0, ideaHash({ ...base, frequency: "yearly" }));
    assert.notEqual(h0, ideaHash({ ...base, user_context: "ctx" }));
  });

  it("is order-insensitive (sorts keys before hashing)", () => {
    // Same data, different construction order.
    const a = ideaHash({ idea: "x", buyer: "y", pays_for: "z", frequency: "monthly", user_context: "" });
    const b = ideaHash({ user_context: "", frequency: "monthly", pays_for: "z", buyer: "y", idea: "x" } as never);
    assert.equal(a, b);
  });
});

describe("ipHash", () => {
  it("produces a 64-char hex hash for a given IP", () => {
    const h = ipHash("203.0.113.45");
    assert.match(h, /^[0-9a-f]{64}$/);
  });

  it("differs for different IPs (deterministic, but distinguishing)", () => {
    assert.notEqual(ipHash("203.0.113.45"), ipHash("203.0.113.46"));
  });

  it("is deterministic for the same IP", () => {
    assert.equal(ipHash("203.0.113.45"), ipHash("203.0.113.45"));
  });
});
