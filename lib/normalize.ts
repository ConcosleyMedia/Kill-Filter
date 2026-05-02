// Input normalization + idea_hash. Per TechDesign §4.
// idea_hash is the cache key — must be deterministic across calls,
// so we sort keys, lowercase, and resolve frequency aliases before hashing.
import { createHash } from "node:crypto";

export interface RawIdea {
  idea: string;
  buyer: string;
  pays_for: string;
  frequency: string;
  user_context: string;
}

export interface NormalizedIdea {
  idea: string;
  buyer: string;
  pays_for: string;
  frequency: string;
  user_context: string;
}

const FREQUENCY_ALIASES: Record<string, string> = {
  annually: "yearly",
  annual: "yearly",
  yearly: "yearly",
  year: "yearly",
  "year-long": "yearly",
  "annual subscription": "yearly",
  monthly: "monthly",
  month: "monthly",
  subscription: "monthly",
  "month-to-month": "monthly",
  once: "one_time",
  "one-time": "one_time",
  one_time: "one_time",
  onetime: "one_time",
  single: "one_time",
};

// Marketing-language tokens that get stripped from buyer/pays_for so they
// don't pump the cache with cosmetic differences. The rubric also wants
// these downweighted, so removing them aligns with that.
const MARKETING_TOKENS = [
  "revolutionary",
  "ai-powered",
  "ai powered",
  "next-generation",
  "next generation",
  "disruptive",
  "disrupting",
  "groundbreaking",
  "world-class",
  "best-in-class",
];

function stripMarketing(s: string): string {
  let out = s;
  for (const t of MARKETING_TOKENS) {
    // Case-insensitive replace; collapse the resulting double spaces.
    out = out.replace(new RegExp(t, "gi"), "");
  }
  return out.replace(/\s+/g, " ").trim();
}

export function normalizeFrequency(input: string): string {
  const s = input.trim().toLowerCase();
  if (!s) return "unclear";
  return FREQUENCY_ALIASES[s] ?? s;
}

export function normalizeIdea(raw: RawIdea): NormalizedIdea {
  return {
    idea: raw.idea.trim(),
    buyer: stripMarketing(raw.buyer.trim().toLowerCase()),
    pays_for: stripMarketing(raw.pays_for.trim().toLowerCase()),
    frequency: normalizeFrequency(raw.frequency),
    user_context: raw.user_context.trim(),
  };
}

// Stable JSON: sort keys so {a:1, b:2} and {b:2, a:1} hash identically.
function stableStringify(obj: NormalizedIdea): string {
  const r = obj as unknown as Record<string, string>;
  const keys = Object.keys(r).sort();
  return JSON.stringify(Object.fromEntries(keys.map((k) => [k, r[k]])));
}

export function ideaHash(normalized: NormalizedIdea): string {
  return createHash("sha256").update(stableStringify(normalized)).digest("hex");
}

// Hash a raw IP address with the server-side IP_HASH_SALT for the
// public-surface rate limiter. Per TechDesign §15: ip_hash is sufficient
// for rate limiting without storing PII.
export function ipHash(ip: string): string {
  const salt = process.env.IP_HASH_SALT ?? "";
  return createHash("sha256").update(salt).update(":").update(ip).digest("hex");
}
