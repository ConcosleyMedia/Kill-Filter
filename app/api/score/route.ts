import Anthropic from "@anthropic-ai/sdk";
import type { NextRequest } from "next/server";
import {
  applyVerdictGate,
  computeHeadline,
  CRITERIA,
  type Scores,
} from "@/lib/verdict-gate";
import { loadScoringBundle, getSkillVersion } from "@/lib/load-skill";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODEL = "claude-sonnet-4-6";
const MAX_TOKENS = 1500;
const TEMPERATURE = 0.3;
const PER_CRITERION_DELAY_MS = 250;

const client = new Anthropic();

interface ScoreRequest {
  idea?: unknown;
  buyer?: unknown;
  pays_for?: unknown;
  frequency?: unknown;
  user_context?: unknown;
}

function asStr(x: unknown): string {
  return typeof x === "string" ? x.trim() : "";
}

function normalizeFrequency(input: string): string {
  const s = input.trim().toLowerCase();
  if (["annually", "annual", "yearly", "year", "year-long", "annual subscription"].includes(s)) return "yearly";
  if (["monthly", "month", "subscription", "month-to-month"].includes(s)) return "monthly";
  if (["once", "one-time", "one_time", "onetime", "single"].includes(s)) return "one_time";
  if (!s) return "unclear";
  // Best-effort fallback — let the model see the raw value if we can't bucket it.
  return s;
}

interface ParsedScoreOutput {
  scores: Scores;
  headline_reason: string;
}

// Sonnet sometimes wraps the JSON in ```json``` fences despite the skill's
// "no markdown" rule. Strip them defensively before JSON.parse.
function extractJson(text: string): string {
  const trimmed = text.trim();
  const fenceMatch = trimmed.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```\s*$/);
  return fenceMatch ? fenceMatch[1].trim() : trimmed;
}

function isParsedScoreOutput(x: unknown): x is ParsedScoreOutput {
  if (!x || typeof x !== "object") return false;
  const o = x as { scores?: unknown; headline_reason?: unknown };
  if (typeof o.headline_reason !== "string") return false;
  if (!o.scores || typeof o.scores !== "object") return false;
  const s = o.scores as Record<string, unknown>;
  for (const c of CRITERIA) {
    const entry = s[c] as { score?: unknown; reason?: unknown } | undefined;
    if (!entry || typeof entry.score !== "number" || typeof entry.reason !== "string") return false;
    if (!Number.isInteger(entry.score) || entry.score < 1 || entry.score > 10) return false;
  }
  return true;
}

export async function POST(req: NextRequest) {
  let body: ScoreRequest;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const idea = asStr(body.idea);
  const buyer = asStr(body.buyer);
  const pays_for = asStr(body.pays_for);
  const frequency = asStr(body.frequency);
  const user_context = asStr(body.user_context);

  if (!idea) return Response.json({ error: "missing_idea" }, { status: 400 });
  if (!buyer) return Response.json({ error: "missing_buyer" }, { status: 400 });
  if (!pays_for) return Response.json({ error: "missing_pays_for" }, { status: 400 });
  if (!frequency) return Response.json({ error: "missing_frequency" }, { status: 400 });

  const normalizedInput = {
    idea,
    buyer: buyer.toLowerCase(),
    pays_for: pays_for.toLowerCase(),
    frequency: normalizeFrequency(frequency),
    user_context,
  };

  const encoder = new TextEncoder();
  const sse = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        );
      };

      try {
        const skillBundle = loadScoringBundle();

        const claudeStream = client.messages.stream({
          model: MODEL,
          max_tokens: MAX_TOKENS,
          temperature: TEMPERATURE,
          // Scoring is structured-extraction shaped — no thinking, low effort.
          thinking: { type: "disabled" },
          output_config: { effort: "low" },
          // Top-level auto-caching places the marker on the (only) cacheable
          // block, the ~7500-token system. Repeat calls read at ~0.1× cost.
          cache_control: { type: "ephemeral" },
          system: skillBundle,
          messages: [{ role: "user", content: JSON.stringify(normalizedInput) }],
        });

        const message = await claudeStream.finalMessage();

        const textBlock = message.content.find((b) => b.type === "text");
        if (!textBlock || textBlock.type !== "text") {
          send("error", { message: "empty_response" });
          return;
        }

        let parsed: unknown;
        try {
          parsed = JSON.parse(extractJson(textBlock.text));
        } catch {
          send("error", {
            message: "invalid_json_from_model",
            raw: textBlock.text.slice(0, 300),
          });
          return;
        }

        if (!isParsedScoreOutput(parsed)) {
          send("error", { message: "schema_mismatch" });
          return;
        }

        // Stream criterion events with a small stagger to drive the terminal
        // bar-fill animations on the client.
        for (const c of CRITERIA) {
          const s = parsed.scores[c];
          send("criterion", {
            criterion: c,
            score: s.score,
            reason: s.reason,
          });
          await new Promise((r) => setTimeout(r, PER_CRITERION_DELAY_MS));
        }

        const result = applyVerdictGate(parsed.scores);
        const headline = computeHeadline(result, parsed.scores, parsed.headline_reason);

        send("verdict", {
          verdict: result.verdict,
          rule: result.rule,
          total: result.total,
          display_total: result.display_total,
          headline,
          skill_version: getSkillVersion(),
          // Persisted run_id will replace this once Supabase lands (step 7).
          run_id: crypto.randomUUID(),
          // Surface cache hit/miss so we can verify caching is working in dev.
          cache_read_input_tokens: message.usage.cache_read_input_tokens ?? 0,
          cache_creation_input_tokens: message.usage.cache_creation_input_tokens ?? 0,
        });

        send("done", {});
      } catch (err) {
        if (err instanceof Anthropic.RateLimitError) {
          send("error", { message: "rate_limited" });
        } else if (err instanceof Anthropic.APIError) {
          send("error", { message: `anthropic_${err.status ?? "error"}` });
        } else {
          send("error", { message: err instanceof Error ? err.message : "unknown" });
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(sse, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // Disable proxy buffering on Vercel/Nginx so SSE flushes immediately.
      "X-Accel-Buffering": "no",
    },
  });
}
