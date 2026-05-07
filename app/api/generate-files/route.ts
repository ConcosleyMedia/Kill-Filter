// On KEEP, generate the four starter files (CLAUDE.md, spec.md, stack.md,
// cut-list.md) by asking Claude to fill the placeholder slots in
// skill/templates/*. Whop iframe surface only — auth-gated by Whop user
// token.
import Anthropic from "@anthropic-ai/sdk";
import type { NextRequest } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { whopConfigured, whopSdk } from "@/lib/whop-sdk";
import {
  getRunForUser,
  updateGeneratedFiles,
  type GeneratedFiles,
} from "@/lib/runs";
import {
  loadFileGenerationBundle,
  getSkillVersion,
} from "@/lib/load-skill";
import { supabaseConfigured } from "@/lib/supabase";
import { ipHash } from "@/lib/normalize";

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

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODEL = "claude-sonnet-4-6";
const MAX_TOKENS = 4000;
const TEMPERATURE = 0.4;

const client = new Anthropic();

const TEMPLATE_NAMES = [
  "CLAUDE.md",
  "spec.md",
  "stack.md",
  "cut-list.md",
] as const;
type TemplateName = (typeof TEMPLATE_NAMES)[number];

const SLOT_KEYS = [
  "product_name",
  "one_line_description",
  "buyer",
  "buyer_short",
  "pays_for",
  "frequency_and_pricing",
  "unfair_advantage_summary",
  "feature_1_name",
  "feature_1_description",
  "feature_1_user_action",
  "feature_1_user_value",
  "feature_1_ac_1",
  "feature_1_ac_2",
  "feature_1_ac_3",
  "feature_1_oos",
  "feature_2_name",
  "feature_2_description",
  "feature_2_user_action",
  "feature_2_user_value",
  "feature_2_ac_1",
  "feature_2_ac_2",
  "feature_2_ac_3",
  "feature_2_oos",
  "feature_3_name",
  "feature_3_description",
  "feature_3_user_action",
  "feature_3_user_value",
  "feature_3_ac_1",
  "feature_3_ac_2",
  "feature_3_ac_3",
  "feature_3_oos",
  "feature_4_name",
  "feature_4_description",
  "feature_4_user_action",
  "feature_4_user_value",
  "feature_4_ac_1",
  "feature_4_ac_2",
  "feature_4_ac_3",
  "feature_4_oos",
  "custom_layer_1",
  "custom_tool_1",
  "custom_reason_1",
  "profile_extra_columns",
  "domain_tables",
  "cut_item_1",
  "cut_reason_1",
  "cut_revisit_1",
  "cut_item_2",
  "cut_reason_2",
  "cut_revisit_2",
  "cut_item_3",
  "cut_reason_3",
  "cut_revisit_3",
  "cut_item_4",
  "cut_reason_4",
  "cut_revisit_4",
  "cut_item_5",
  "cut_reason_5",
  "cut_revisit_5",
] as const;
type SlotKey = (typeof SLOT_KEYS)[number];
type SlotValues = Record<SlotKey, string>;

interface RequestBody {
  run_id?: unknown;
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

  // Auth: prefer a verified Whop user token; fall back to ip_hash so the
  // public-surface KEEP path can also generate files. Both must match the
  // user_key the run was persisted under.
  const whopUserId = await detectWhopUser(req);
  const userKey = whopUserId ?? ipHash(clientIp(req));

  const run = await getRunForUser(runId, userKey).catch(() => null);
  if (!run) {
    return Response.json({ error: "run_not_found" }, { status: 404 });
  }
  if (run.verdict !== "KEEP") {
    return Response.json({ error: "verdict_not_keep" }, { status: 409 });
  }

  // Cache: if we already generated files for this run, return them.
  if (run.generated_files) {
    return Response.json({ files: run.generated_files, cached: true });
  }

  let slots: SlotValues;
  try {
    slots = await fillSlotsViaClaude(run.idea_normalized, run.scores);
  } catch (err) {
    console.error("[/api/generate-files] slot fill failed:", err);
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

  const generatedAt = new Date().toISOString().slice(0, 10);
  const skillVersion = getSkillVersion();
  const files = renderTemplates(slots, skillVersion, generatedAt);

  await updateGeneratedFiles(runId, files).catch((err) => {
    // Persistence failure shouldn't block the user from getting their files.
    console.error("[/api/generate-files] persist failed:", err);
  });

  return Response.json({ files, cached: false });
}

// --- Claude call ---

async function fillSlotsViaClaude(
  normalized: unknown,
  scores: unknown,
): Promise<SlotValues> {
  const skillBundle = loadFileGenerationBundle();

  const instruction = [
    "You are filling placeholder slots in four template files for a build-room starter pack.",
    "Templates: CLAUDE.md (master agent contract), spec.md (4-feature MVP scope), stack.md (locked stack overrides), cut-list.md (do-not-build list).",
    "",
    "Output a single JSON object — no preamble, no markdown fence — whose keys are exactly the slot names listed below and whose values are plain text strings (no markdown headings or bullets unless the slot is explicitly a list item).",
    "",
    "Voice: Kill Filter brand. Terse. Specific. No flattery. Second person where natural. Match the worked examples in skill/examples/. Do not hedge with 'could' / 'might' / 'consider'.",
    "",
    "Slot rules:",
    "- product_name: ≤ 4 words, the actual product name (not the buyer's company).",
    "- one_line_description: ≤ 14 words, what the product does + who it's for.",
    "- buyer: copy from input, sharpened for specificity if vague.",
    "- buyer_short: ≤ 4 words, the noun phrase used in user stories ('a freelance designer').",
    "- pays_for + frequency_and_pricing: copied from input.",
    "- unfair_advantage_summary: 1-2 sentences explaining why the user wins. If user_context is empty, write 'You have no stated edge — fix that before launch'.",
    "- feature_1..4: pick the 4 features the v1 MUST ship. feature_1 is the core value prop. Each name ≤ 4 words. Each description ≤ 18 words. user_action ≤ 8 words. user_value ≤ 12 words. ac_1..3 are checkable acceptance criteria, ≤ 12 words each. oos = 'out of scope for THIS feature' (not the whole product), ≤ 14 words.",
    "- custom_layer_1, custom_tool_1, custom_reason_1: one extra row in the stack table for a domain-specific layer (e.g., 'Email' → 'Resend' → 'Cheap, dev-friendly'). Keep generic if the idea doesn't need a custom row.",
    "- profile_extra_columns: extra columns to add to the profiles table, as raw SQL (one column per line, comma-prefixed). Empty string if none.",
    "- domain_tables: full SQL DDL for the domain-specific tables this product needs. Keep it tight — only what v1 needs. Use markdown SQL blocks within the value if needed.",
    "- cut_item_1..5: features the user is probably already imagining and will be tempted to build, that should NOT ship in v1. Be specific to the product. Each ≤ 8 words.",
    "- cut_reason_1..5: why each is cut. ≤ 22 words.",
    "- cut_revisit_1..5: when to revisit (e.g., 'after first 10 paying users'). ≤ 14 words.",
    "",
    "Return ONLY the JSON object. No fences. No explanation.",
    "",
    "Slot names (must all be present):",
    SLOT_KEYS.map((k) => `- ${k}`).join("\n"),
  ].join("\n");

  const inputPayload = {
    idea: normalized,
    scores,
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
      {
        type: "text",
        text: instruction,
      },
    ],
    messages: [{ role: "user", content: JSON.stringify(inputPayload) }],
  });

  const textBlock = message.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("empty_response");
  }
  const raw = textBlock.text.trim();
  const json = stripFence(raw);

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error("invalid_json_from_model");
  }
  return validateSlots(parsed);
}

function stripFence(text: string): string {
  const m = text.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```\s*$/);
  return m ? m[1].trim() : text;
}

function validateSlots(x: unknown): SlotValues {
  if (!x || typeof x !== "object") throw new Error("schema_mismatch");
  const obj = x as Record<string, unknown>;
  const out = {} as SlotValues;
  for (const k of SLOT_KEYS) {
    const v = obj[k];
    if (typeof v !== "string") {
      throw new Error(`slot_missing:${k}`);
    }
    out[k] = v;
  }
  return out;
}

// --- Template substitution ---

function renderTemplates(
  slots: SlotValues,
  skillVersion: string,
  generatedAt: string,
): GeneratedFiles {
  const out = {} as GeneratedFiles;
  for (const name of TEMPLATE_NAMES) {
    const template = readTemplate(name);
    out[name] = applySlots(template, slots, skillVersion, generatedAt);
  }
  return out;
}

function readTemplate(name: TemplateName): string {
  const abs = path.join(process.cwd(), "skill", "templates", name);
  return fs.readFileSync(abs, "utf-8");
}

function applySlots(
  template: string,
  slots: SlotValues,
  skillVersion: string,
  generatedAt: string,
): string {
  return template.replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (_, key: string) => {
    if (key === "skill_version") return skillVersion;
    if (key === "generated_at") return generatedAt;
    if (key in slots) return slots[key as SlotKey];
    // Unknown slot — leave as-is so the user can see what's missing rather
    // than silently dropping it.
    return `{{${key}}}`;
  });
}
