import Anthropic from "@anthropic-ai/sdk";
import type { NextRequest } from "next/server";
import {
  applyVerdictGate,
  computeHeadline,
  CRITERIA,
  type Scores,
} from "@/lib/verdict-gate";
import { loadScoringBundle, getSkillVersion } from "@/lib/load-skill";
import { ideaHash, ipHash, normalizeIdea } from "@/lib/normalize";
import { supabaseConfigured } from "@/lib/supabase";
import {
  getPublicQuota,
  getWhopQuota,
  incrementPublicQuota,
  incrementWhopQuota,
  PUBLIC_DAILY_LIMIT,
  WHOP_DAILY_LIMIT,
  WHOP_WEEKLY_LIMIT,
} from "@/lib/rate-limit";
import { findCachedRun, getRunForUser, persistRun } from "@/lib/runs";
import { whopConfigured, whopSdk } from "@/lib/whop-sdk";

const REFINEMENT_GRACE_DAYS = 7;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODEL = "claude-sonnet-4-6";
const MAX_TOKENS = 1500;
const TEMPERATURE = 0.3;
const PER_CRITERION_DELAY_MS = 250;
// Cache hits stream the events all at once but the client still wants a
// brief stagger for the bar-fill animation to register.
const CACHE_HIT_DELAY_MS = 80;

const client = new Anthropic();

interface ScoreRequest {
  idea?: unknown;
  buyer?: unknown;
  pays_for?: unknown;
  frequency?: unknown;
  user_context?: unknown;
  refinement_of?: unknown;
}

function asStr(x: unknown): string {
  return typeof x === "string" ? x.trim() : "";
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

// Pull the client IP from common proxy headers; falls back to "unknown" if
// nothing's set (e.g., direct localhost calls without forwarded headers).
function clientIp(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

// Detect a Whop iframe request: the iframe forwards x-whop-user-token on
// every same-origin fetch. We verify it server-side; success means we're in
// a paid-context where IP rate limit doesn't apply.
async function detectWhopUser(req: NextRequest): Promise<string | null> {
  if (!req.headers.get("x-whop-user-token")) return null;
  if (!whopConfigured()) return null;
  try {
    const { userId } = await whopSdk().verifyUserToken(req.headers);
    return userId;
  } catch {
    return null;
  }
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
  const refinementOfId = asStr(body.refinement_of);

  if (!idea) return Response.json({ error: "missing_idea" }, { status: 400 });
  if (!buyer) return Response.json({ error: "missing_buyer" }, { status: 400 });
  if (!pays_for) return Response.json({ error: "missing_pays_for" }, { status: 400 });
  if (!frequency) return Response.json({ error: "missing_frequency" }, { status: 400 });

  const normalized = normalizeIdea({ idea, buyer, pays_for, frequency, user_context });
  const persistEnabled = supabaseConfigured();
  const ideaHashValue = ideaHash(normalized);

  // Surface detection: a verified Whop user token bumps us into the whop
  // surface (per-user cache, no IP rate limit). Otherwise public.
  const whopUserId = await detectWhopUser(req);
  const surface: "public" | "whop" = whopUserId ? "whop" : "public";
  const userKey = persistEnabled
    ? whopUserId ?? ipHash(clientIp(req))
    : "unauthed";

  // 1. Cache hit short-circuits the whole pipeline. Doesn't consume quota.
  if (persistEnabled) {
    const cached = await findCachedRun(userKey, ideaHashValue).catch(() => null);
    if (cached) {
      return streamCachedResponse(cached);
    }

    // 2. Refinement grace: if this is a rerun off a parent REWORK/KILL run
    //    that the same user_key owned within the last 7 days, skip the
    //    IP rate limit. Server-validated so client can't claim arbitrary IDs.
    const isRefinement =
      refinementOfId.length > 0 &&
      (await isValidRefinement(refinementOfId, userKey));

    // 3. No cache hit — enforce surface-appropriate rate limits unless
    //    refinement grace applies.
    if (!isRefinement) {
      if (surface === "public") {
        const quota = await getPublicQuota(userKey).catch(() => null);
        if (quota?.exceeded) {
          return Response.json(
            {
              error: "rate_limited",
              surface: "public",
              scope: "daily",
              limit: PUBLIC_DAILY_LIMIT,
              used: quota.used,
              remaining: 0,
              cta: "Free Build Room gets you 5 ideas/week. → $9/mo",
            },
            { status: 429 },
          );
        }
      } else if (surface === "whop") {
        const wq = await getWhopQuota(userKey).catch(() => null);
        if (wq?.exceeded) {
          return Response.json(
            {
              error: "rate_limited",
              surface: "whop",
              scope: wq.blocked_scope,
              daily_used: wq.daily_used,
              daily_limit: WHOP_DAILY_LIMIT,
              weekly_used: wq.weekly_used,
              weekly_limit: WHOP_WEEKLY_LIMIT,
              resets_at: wq.resets_at,
              cta: "Paid Build Room ships unlimited scoring. → $9/mo",
            },
            { status: 429 },
          );
        }
      }
    }

    return streamFreshScoring({
      normalized,
      userKey,
      ideaHashValue,
      persistEnabled,
      surface,
      countsAgainstQuota: !isRefinement,
    });
  }

  return streamFreshScoring({
    normalized,
    userKey,
    ideaHashValue,
    persistEnabled,
    surface,
    countsAgainstQuota: false,
  });
}

async function isValidRefinement(
  parentRunId: string,
  userKey: string,
): Promise<boolean> {
  const parent = await getRunForUser(parentRunId, userKey).catch(() => null);
  if (!parent) return false;
  if (parent.verdict !== "REWORK" && parent.verdict !== "KILL") return false;
  const ageMs = Date.now() - new Date(parent.created_at).getTime();
  return ageMs <= REFINEMENT_GRACE_DAYS * 24 * 60 * 60 * 1000;
}

// --- streaming helpers ---

interface FreshScoringArgs {
  normalized: ReturnType<typeof normalizeIdea>;
  userKey: string;
  ideaHashValue: string;
  persistEnabled: boolean;
  surface: "public" | "whop";
  countsAgainstQuota: boolean;
}

function streamFreshScoring(args: FreshScoringArgs): Response {
  const { normalized, userKey, ideaHashValue, persistEnabled, surface, countsAgainstQuota } = args;
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

        for (const c of CRITERIA) {
          const s = parsed.scores[c];
          send("criterion", { criterion: c, score: s.score, reason: s.reason });
          await new Promise((r) => setTimeout(r, PER_CRITERION_DELAY_MS));
        }

        const result = applyVerdictGate(parsed.scores);
        const headline = computeHeadline(result, parsed.scores, parsed.headline_reason);
        const skill_version = getSkillVersion();

        let run_id: string;
        if (persistEnabled) {
          // Persist BEFORE incrementing the quota: if the insert fails we
          // don't want to charge the user a daily run.
          run_id = await persistRun({
            surface,
            user_key: userKey,
            idea_hash: ideaHashValue,
            idea_normalized: normalized,
            scores: parsed.scores,
            verdict: result.verdict,
            rule: result.rule,
            total: result.total,
            headline,
            skill_version,
          }).catch((err) => {
            console.error("[/api/score] persistRun failed:", err);
            return crypto.randomUUID();
          });
          if (countsAgainstQuota) {
            if (surface === "public") {
              await incrementPublicQuota(userKey).catch((err) => {
                console.error("[/api/score] incrementPublicQuota failed:", err);
                return 0;
              });
            } else if (surface === "whop") {
              await incrementWhopQuota(userKey).catch((err) => {
                console.error("[/api/score] incrementWhopQuota failed:", err);
                return 0;
              });
            }
          }
        } else {
          run_id = crypto.randomUUID();
        }

        send("verdict", {
          verdict: result.verdict,
          rule: result.rule,
          total: result.total,
          display_total: result.display_total,
          headline,
          skill_version,
          run_id,
          cached: false,
          cache_read_input_tokens: message.usage.cache_read_input_tokens ?? 0,
          cache_creation_input_tokens: message.usage.cache_creation_input_tokens ?? 0,
        });

        send("done", {});
      } catch (err) {
        // Log full error server-side (visible in Vercel runtime logs);
        // never echo raw error messages to the client — Anthropic SDK
        // header errors include the API key verbatim.
        console.error("[/api/score] streamFreshScoring failed:", err);
        if (err instanceof Anthropic.RateLimitError) {
          send("error", { message: "anthropic_rate_limited" });
        } else if (err instanceof Anthropic.APIError) {
          send("error", { message: `anthropic_${err.status ?? "error"}` });
        } else {
          send("error", { message: "internal_error" });
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(sse, { headers: sseHeaders() });
}

function streamCachedResponse(
  cached: Awaited<ReturnType<typeof findCachedRun>>,
): Response {
  const encoder = new TextEncoder();
  const sse = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        );
      };

      try {
        if (!cached) {
          send("error", { message: "cache_miss_after_check" });
          return;
        }

        send("cached", { previously_scored_at: cached.created_at });

        for (const c of CRITERIA) {
          const s = cached.scores[c];
          send("criterion", { criterion: c, score: s.score, reason: s.reason });
          await new Promise((r) => setTimeout(r, CACHE_HIT_DELAY_MS));
        }

        send("verdict", {
          verdict: cached.verdict,
          rule: cached.rule,
          total: cached.total,
          display_total: cached.total * 2,
          headline: cached.headline,
          skill_version: cached.skill_version,
          run_id: cached.id,
          cached: true,
          previously_scored_at: cached.created_at,
        });
        send("done", {});
      } finally {
        controller.close();
      }
    },
  });
  return new Response(sse, { headers: sseHeaders() });
}

function sseHeaders(): HeadersInit {
  return {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  };
}
