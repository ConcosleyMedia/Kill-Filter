// Persistence + cache lookups for the runs table. The runs table doubles
// as the verdict cache: SELECT WHERE user_key = ? AND idea_hash = ?
// ORDER BY created_at DESC LIMIT 1.
import "server-only";
import { supabase } from "./supabase.ts";
import type { Scores, Verdict, Rule } from "./verdict-gate.ts";
import type { NormalizedIdea } from "./normalize.ts";

export interface PersistedRun {
  id: string;
  surface: "public" | "whop";
  user_key: string;
  idea_hash: string;
  idea_normalized: NormalizedIdea;
  scores: Scores;
  verdict: Verdict;
  rule: Rule;
  total: number;
  headline: string;
  skill_version: string;
  created_at: string;
  generated_files?: GeneratedFiles | null;
}

export type GeneratedFiles = {
  "CLAUDE.md": string;
  "spec.md": string;
  "stack.md": string;
  "cut-list.md": string;
};

export async function findCachedRun(
  userKey: string,
  ideaHashValue: string,
): Promise<PersistedRun | null> {
  const { data, error } = await supabase()
    .from("runs")
    .select(
      "id, surface, user_key, idea_hash, idea_normalized, scores, verdict, rule, total, headline, skill_version, created_at",
    )
    .eq("user_key", userKey)
    .eq("idea_hash", ideaHashValue)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as PersistedRun | null) ?? null;
}

export interface PersistRunInput {
  surface: "public" | "whop";
  user_key: string;
  idea_hash: string;
  idea_normalized: NormalizedIdea;
  scores: Scores;
  verdict: Verdict;
  rule: Rule;
  total: number;
  headline: string;
  skill_version: string;
}

export async function persistRun(input: PersistRunInput): Promise<string> {
  const { data, error } = await supabase()
    .from("runs")
    .insert(input)
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

// Fetches a run by id, scoped to a user_key for ownership. Returns null
// if the run doesn't exist or belongs to someone else.
export async function getRunForUser(
  runId: string,
  userKey: string,
): Promise<PersistedRun | null> {
  const { data, error } = await supabase()
    .from("runs")
    .select(
      "id, surface, user_key, idea_hash, idea_normalized, scores, verdict, rule, total, headline, skill_version, created_at, generated_files",
    )
    .eq("id", runId)
    .eq("user_key", userKey)
    .maybeSingle();
  if (error) throw error;
  return (data as PersistedRun | null) ?? null;
}

export async function updateGeneratedFiles(
  runId: string,
  files: GeneratedFiles,
): Promise<void> {
  const { error } = await supabase()
    .from("runs")
    .update({ generated_files: files })
    .eq("id", runId);
  if (error) throw error;
}
