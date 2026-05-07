// Generates 3 enhancement options for a REWORK or KILL run. Loads the
// enhancements skill module, asks Claude to produce options targeting three
// different weakest criteria.
import Anthropic from "@anthropic-ai/sdk";
import type { NextRequest } from "next/server";
import { CRITERIA, type Criterion } from "@/lib/verdict-gate";

type CriterionKey = Criterion;
import { loadEnhancementBundle, getSkillVersion } from "@/lib/load-skill";
import { ipHash } from "@/lib/normalize";
import { supabaseConfigured } from "@/lib/supabase";
import { getRunForUser } from "@/lib/runs";
import { whopConfigured, whopSdk } from "@/lib/whop-sdk";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODEL = "claude-sonnet-4-6";
const MAX_TOKENS = 2000;
const TEMPERATURE = 0.5;

const client = new Anthropic();

interface RequestBody {
  run_id?: unknown;
}

interface EnhancementFields {
  idea: string;
  buyer: string;
  pays_for: string;
  frequency: string;
  you: string;
}

interface Enhancement {
  tag: string;
  idea: string;
  fit: string;
  fields: EnhancementFields;
  criterion: CriterionKey;
}

function clientIp(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

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
  if (!supabaseConfigured()) {
    return Response.json({ error: "persistence_not_configured" }, { status: 503 });
  }

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }
  const runId = typeof body.run_id === "string" ? body.run_id : "";
  if (!runId) {
    return Response.json({ error: "missing_run_id" }, { status: 400 });
  }

  const whopUserId = await detectWhopUser(req);
  const userKey = whopUserId ?? ipHash(clientIp(req));

  const run = await getRunForUser(runId, userKey).catch(() => null);
  if (!run) {
    return Response.json({ error: "run_not_found" }, { status: 404 });
  }
  if (run.verdict !== "REWORK" && run.verdict !== "KILL") {
    return Response.json({ error: "verdict_not_eligible" }, { status: 409 });
  }

  let enhancements: Enhancement[];
  try {
    enhancements = await callEnhanceClaude(run);
  } catch (err) {
    console.error("[/api/enhance] generation failed:", err);
    if (err instanceof Anthropic.RateLimitError) {
      return Response.json({ error: "anthropic_rate_limited" }, { status: 503 });
    }
    if (err instanceof Anthropic.APIError) {
      return Response.json(
        { error: `anthropic_${err.status ?? "error"}` },
        { status: 502 },
      );
    }
    return Response.json({ error: "generation_failed" }, { status: 500 });
  }

  return Response.json({
    run_id: runId,
    mode: run.verdict,
    enhancements,
    skill_version: getSkillVersion(),
  });
}

async function callEnhanceClaude(
  run: NonNullable<Awaited<ReturnType<typeof getRunForUser>>>,
): Promise<Enhancement[]> {
  const skillBundle = loadEnhancementBundle();

  const inputPayload = {
    mode: run.verdict,
    idea: run.idea_normalized.idea,
    buyer: run.idea_normalized.buyer,
    pays_for: run.idea_normalized.pays_for,
    frequency: run.idea_normalized.frequency,
    user_context: run.idea_normalized.user_context,
    scores: run.scores,
    headline_reason: run.headline,
  };

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
    messages: [{ role: "user", content: JSON.stringify(inputPayload) }],
  });

  const textBlock = message.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("empty_response");
  }
  const raw = textBlock.text.trim();
  const stripped = stripFence(raw);

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripped);
  } catch {
    throw new Error("invalid_json_from_model");
  }

  return validateEnhancements(parsed);
}

function stripFence(text: string): string {
  const m = text.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```\s*$/);
  return m ? m[1].trim() : text;
}

function validateEnhancements(x: unknown): Enhancement[] {
  if (!x || typeof x !== "object") throw new Error("schema_mismatch");
  const root = x as { enhancements?: unknown };
  if (!Array.isArray(root.enhancements) || root.enhancements.length !== 3) {
    throw new Error("expected_three_enhancements");
  }

  const out: Enhancement[] = [];
  const seenCriteria = new Set<CriterionKey>();
  for (const e of root.enhancements as unknown[]) {
    if (!e || typeof e !== "object") throw new Error("enhancement_not_object");
    const o = e as Record<string, unknown>;
    if (typeof o.tag !== "string") throw new Error("missing_tag");
    if (typeof o.idea !== "string") throw new Error("missing_idea");
    if (typeof o.fit !== "string") throw new Error("missing_fit");
    if (!o.fields || typeof o.fields !== "object") throw new Error("missing_fields");
    const f = o.fields as Record<string, unknown>;
    for (const k of ["idea", "buyer", "pays_for", "frequency", "you"] as const) {
      if (typeof f[k] !== "string") throw new Error(`missing_field:${k}`);
    }
    const criterion = inferCriterion(o.tag);
    seenCriteria.add(criterion);
    out.push({
      tag: o.tag,
      idea: o.idea,
      fit: o.fit,
      fields: {
        idea: f.idea as string,
        buyer: f.buyer as string,
        pays_for: f.pays_for as string,
        frequency: f.frequency as string,
        you: f.you as string,
      },
      criterion,
    });
  }

  // Per the skill's Rule 1: each enhancement must target a different criterion.
  // If we infer fewer than 3 distinct criteria, the model didn't follow the
  // rule — surface as an error so the client can retry rather than showing
  // 3 same-axis options.
  if (seenCriteria.size < 3) {
    throw new Error("non_distinct_criteria");
  }

  return out;
}

// Maps an enhancement's tag string to one of the 5 rubric criteria. The
// skill names tags like "Sharper buyer" / "Replace buyer with ..." — match
// on the keyword in the middle. If no keyword matches, fall back to a
// default so we don't fail the whole response on cosmetic tag drift.
function inferCriterion(tag: string): CriterionKey {
  const t = tag.toLowerCase();
  if (t.includes("buyer")) return "paying_proximity";
  if (t.includes("edge") || t.includes("advantage")) return "unfair_advantage";
  if (t.includes("retention") || t.includes("workflow")) return "retention_shape";
  if (t.includes("validation") || t.includes("test")) return "validation_cost";
  if (t.includes("scope") || t.includes("wedge")) return "build_scope";
  return CRITERIA[0]; // fallback (rare)
}
