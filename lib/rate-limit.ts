// Public-surface IP-keyed daily soft limit. Per PRD/TechDesign:
// 3 runs/day per ip_hash. On hit, render the CTA — not an error.
import "server-only";
import { supabase } from "./supabase.ts";

export const PUBLIC_DAILY_LIMIT = 3;
export const WHOP_DAILY_LIMIT = 1;
export const WHOP_WEEKLY_LIMIT = 5;

function todayKey(): string {
  // YYYY-MM-DD in UTC. Day rolls when UTC midnight passes.
  return new Date().toISOString().slice(0, 10);
}

// First Monday-aligned date on or before today, in UTC. The Whop weekly
// quota resets every Monday at 00:00 UTC.
function isoWeekStart(): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  const day = d.getUTCDay(); // 0=Sun..6=Sat
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

function nextWeekResetIso(): string {
  const start = new Date(isoWeekStart() + "T00:00:00Z");
  start.setUTCDate(start.getUTCDate() + 7);
  return start.toISOString();
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

export interface WhopQuotaState {
  daily_used: number;
  daily_limit: number;
  daily_remaining: number;
  weekly_used: number;
  weekly_limit: number;
  weekly_remaining: number;
  exceeded: boolean;
  // Which scope blocked them, if any. UI varies the copy by scope.
  blocked_scope: "daily" | "weekly" | null;
  resets_at: string;
}

export async function getWhopQuota(whopUserId: string): Promise<WhopQuotaState> {
  const today = todayKey();
  const weekStart = isoWeekStart();

  const { data, error } = await supabase()
    .from("whop_user_quota")
    .select("day, runs_used")
    .eq("whop_user_id", whopUserId)
    .gte("day", weekStart);
  if (error) throw error;

  let daily_used = 0;
  let weekly_used = 0;
  for (const row of data ?? []) {
    weekly_used += row.runs_used as number;
    if (row.day === today) daily_used += row.runs_used as number;
  }

  const dailyExceeded = daily_used >= WHOP_DAILY_LIMIT;
  const weeklyExceeded = weekly_used >= WHOP_WEEKLY_LIMIT;

  // Daily blocks first (it's the tighter limit). If daily is fine but
  // weekly is hit, the user has burned all their weekly runs already.
  let blocked_scope: "daily" | "weekly" | null = null;
  if (weeklyExceeded) blocked_scope = "weekly";
  else if (dailyExceeded) blocked_scope = "daily";

  return {
    daily_used,
    daily_limit: WHOP_DAILY_LIMIT,
    daily_remaining: Math.max(0, WHOP_DAILY_LIMIT - daily_used),
    weekly_used,
    weekly_limit: WHOP_WEEKLY_LIMIT,
    weekly_remaining: Math.max(0, WHOP_WEEKLY_LIMIT - weekly_used),
    exceeded: dailyExceeded || weeklyExceeded,
    blocked_scope,
    resets_at: nextWeekResetIso(),
  };
}

export async function incrementWhopQuota(whopUserId: string): Promise<number> {
  const day = todayKey();
  const db = supabase();

  const { data, error: readErr } = await db
    .from("whop_user_quota")
    .select("runs_used")
    .eq("whop_user_id", whopUserId)
    .eq("day", day)
    .maybeSingle();
  if (readErr) throw readErr;

  const next = (data?.runs_used ?? 0) + 1;

  const { error: writeErr } = await db
    .from("whop_user_quota")
    .upsert(
      { whop_user_id: whopUserId, day, runs_used: next },
      { onConflict: "whop_user_id,day" },
    );
  if (writeErr) throw writeErr;
  return next;
}
