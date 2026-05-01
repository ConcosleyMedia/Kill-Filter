// Reads the skill bundle from disk into memory once per SKILL_VERSION.
// Server-side only — must run in the Node runtime, not edge.
// Per TechDesign §11.
import fs from "node:fs";
import path from "node:path";

type Bundle = "scoring" | "enhancement" | "file_generation";

const FILES: Record<Bundle, readonly string[]> = {
  // Scoring: the rubric + worked examples + verdict gate doc (so the model
  // knows what the gate will do downstream and doesn't try to second-guess it).
  scoring: [
    "skill/SKILL.md",
    "skill/rubric.md",
    "skill/verdict-gate.md",
    "skill/examples/kill-example.md",
    "skill/examples/rework-example.md",
    "skill/examples/keep-example.md",
  ],
  // Enhancement: the enhancements skill + rubric (it needs the criteria axes
  // to know which ones to sharpen).
  enhancement: [
    "skill/enhancements.md",
    "skill/rubric.md",
  ],
  // File generation: the four templates + master skill (brand voice anchor).
  file_generation: [
    "skill/SKILL.md",
    "skill/templates/CLAUDE.md",
    "skill/templates/spec.md",
    "skill/templates/stack.md",
    "skill/templates/cut-list.md",
  ],
};

type CacheEntry = { version: string; content: string };
const cache = new Map<Bundle, CacheEntry>();

function skillVersion(): string {
  return process.env.SKILL_VERSION ?? "1.0";
}

function loadBundle(bundle: Bundle): string {
  const version = skillVersion();
  const hit = cache.get(bundle);
  if (hit && hit.version === version) return hit.content;

  const root = process.cwd();
  const content = FILES[bundle]
    .map((rel) => {
      const abs = path.join(root, rel);
      return fs.readFileSync(abs, "utf-8");
    })
    .join("\n\n---\n\n");

  cache.set(bundle, { version, content });
  return content;
}

export function loadScoringBundle(): string {
  return loadBundle("scoring");
}

export function loadEnhancementBundle(): string {
  return loadBundle("enhancement");
}

export function loadFileGenerationBundle(): string {
  return loadBundle("file_generation");
}

export function getSkillVersion(): string {
  return skillVersion();
}
