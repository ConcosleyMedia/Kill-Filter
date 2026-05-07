// Returns the Whop user's current daily/weekly quota state. The experience
// tool calls this on mount and after each scoring run to keep the run
// counter in TopBar fresh.
import type { NextRequest } from "next/server";
import { whopConfigured, whopSdk } from "@/lib/whop-sdk";
import { getWhopQuota } from "@/lib/rate-limit";
import { supabaseConfigured } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!whopConfigured()) {
    return Response.json({ error: "whop_not_configured" }, { status: 503 });
  }
  if (!supabaseConfigured()) {
    return Response.json({ error: "persistence_not_configured" }, { status: 503 });
  }

  let userId: string;
  try {
    ({ userId } = await whopSdk().verifyUserToken(req.headers));
  } catch {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const quota = await getWhopQuota(userId).catch(() => null);
  if (!quota) {
    return Response.json({ error: "quota_lookup_failed" }, { status: 500 });
  }
  return Response.json(quota);
}
