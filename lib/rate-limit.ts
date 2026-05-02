// Public-surface IP-keyed daily soft limit. Per PRD/TechDesign:
// 3 runs/day per ip_hash. On hit, render the CTA — not an error.
import "server-only";
import { supabase } from "./supabase.ts";

export const PUBLIC_DAILY_LIMIT = 3;

function todayKey(): string {
  // YYYY-MM-DD in UTC. Day rolls when UTC midnight passes.
  return new Date().toISOString().slice(0, 10);
}

export interface QuotaState {
  used: number;
  limit: number;
  remaining: number;
  exceeded: boolean;
}

export async function getPublicQuota(ipHashValue: string): Promise<QuotaState> {
  const { data, error } = await supabase()
    .from("public_ip_quota")
    .select("runs_used")
    .eq("ip_hash", ipHashValue)
    .eq("day", todayKey())
    .maybeSingle();
  if (error) throw error;
  const used = data?.runs_used ?? 0;
  return {
    used,
    limit: PUBLIC_DAILY_LIMIT,
    remaining: Math.max(0, PUBLIC_DAILY_LIMIT - used),
    exceeded: used >= PUBLIC_DAILY_LIMIT,
  };
}

// Read-then-write upsert. The race window between two concurrent calls
// from the same IP can undercount by 1; for a soft limit this is fine.
// If we ever need exact accounting we'll add a Postgres RPC (atomic
// `UPDATE ... SET runs_used = runs_used + 1 RETURNING runs_used`).
export async function incrementPublicQuota(
  ipHashValue: string,
): Promise<number> {
  const day = todayKey();
  const db = supabase();

  const { data, error: readErr } = await db
    .from("public_ip_quota")
    .select("runs_used")
    .eq("ip_hash", ipHashValue)
    .eq("day", day)
    .maybeSingle();
  if (readErr) throw readErr;

  const next = (data?.runs_used ?? 0) + 1;

  const { error: writeErr } = await db
    .from("public_ip_quota")
    .upsert(
      { ip_hash: ipHashValue, day, runs_used: next },
      { onConflict: "ip_hash,day" },
    );
  if (writeErr) throw writeErr;
  return next;
}
