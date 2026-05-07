// Singleton Whop server SDK. Reads credentials from env on first use so the
// app still boots if Whop env vars are missing (the iframe route will then
// 401 instead of crashing the whole server).
import "server-only";
import Whop from "@whop/sdk";

let cached: Whop | null = null;

export function whopSdk(): Whop {
  if (cached) return cached;
  const apiKey = process.env.WHOP_API_KEY;
  const appID = process.env.WHOP_APP_ID;
  if (!apiKey || !appID) {
    throw new Error("whop_not_configured");
  }
  cached = new Whop({ apiKey, appID });
  return cached;
}

export function whopConfigured(): boolean {
  return Boolean(process.env.WHOP_API_KEY && process.env.WHOP_APP_ID);
}
