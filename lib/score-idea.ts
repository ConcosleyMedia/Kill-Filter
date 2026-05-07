// Pure scoring helper. Calls the scoring skill against a normalized idea
// and returns the parsed scores object. No persistence, no streaming —
// suitable for the /api/enhance KEEP-guarantee filter where we score
// candidate enhancements server-side before showing them.
import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { CRITERIA, type Scores } from "./verdict-gate.ts";
import { loadScoringBundle } from "./load-skill.ts";
import type { NormalizedIdea } from "./normalize.ts";

const MODEL = "claude-sonnet-4-6";
const MAX_TOKENS = 1500;
const TEMPERATURE = 0.3;

const client = new Anthropic();

export interface ScoredIdea {
  scores: Scores;
  headline_reason: string;
}

function stripFence(text: string): string {
  const trimmed = text.trim();
  const m = trimmed.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```\s*$/);
  return m ? m[1].trim() : trimmed;
}

function isScoredIdea(x: unknown): x is ScoredIdea {
  if (!x || typeof x !== "object") return false;
  const o = x as { scores?: unknown; headline_reason?: unknown };
  if (typeof o.headline_reason !== "string") return false;
  if (!o.scores || typeof o.scores !== "object") return false;
  const s = o.scores as Record<string, unknown>;
  for (const c of CRITERIA) {
    const entry = s[c] as { score?: unknown; reason?: unknown } | undefined;
    if (!entry || typeof entry.score !== "number" || typeof entry.reason !== "string") {
      return false;
    }
    if (!Number.isInteger(entry.score) || entry.score < 1 || entry.score > 10) return false;
  }
  return true;
}

export async function scoreIdea(normalized: NormalizedIdea): Promise<ScoredIdea> {
  const skillBundle = loadScoringBundle();

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    temperature: TEMPERATURE,
    thinking: { type: "disabled" },
    output_config: { effort: "low" },
    system: [
      {
        type: "text",
        text: skillBundle,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: JSON.stringify(normalized) }],
  });

  const textBlock = message.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("scoreIdea_empty_response");
  }
  const parsed = JSON.parse(stripFence(textBlock.text));
  if (!isScoredIdea(parsed)) {
    throw new Error("scoreIdea_schema_mismatch");
  }
  return parsed;
}
