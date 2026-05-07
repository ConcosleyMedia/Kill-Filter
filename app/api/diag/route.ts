// TEMPORARY diagnostic. Reports env var byte-counts and whitespace presence
// so we can identify corrupted values stored in Vercel without exposing the
// values themselves. Remove once env config is verified.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface VarReport {
  set: boolean;
  length: number;
  hasWhitespace: boolean;
  hasTrailingNewline: boolean;
  // Char codes of any non-printable bytes found (helps spot CR/LF/NBSP).
  nonPrintableCodes: number[];
  expectedLength?: number;
  lengthMatchesExpected?: boolean;
}

function inspect(name: string, expectedLength?: number): VarReport {
  const v = process.env[name];
  if (v === undefined) {
    return {
      set: false,
      length: 0,
      hasWhitespace: false,
      hasTrailingNewline: false,
      nonPrintableCodes: [],
      expectedLength,
    };
  }
  const nonPrintableCodes: number[] = [];
  for (let i = 0; i < v.length; i++) {
    const c = v.charCodeAt(i);
    if (c < 32 || c === 127 || (c >= 128 && c <= 159)) {
      nonPrintableCodes.push(c);
    }
  }
  return {
    set: true,
    length: v.length,
    hasWhitespace: /\s/.test(v),
    hasTrailingNewline: v.endsWith("\n") || v.endsWith("\r"),
    nonPrintableCodes,
    expectedLength,
    lengthMatchesExpected:
      expectedLength !== undefined ? v.length === expectedLength : undefined,
  };
}

export async function GET() {
  return Response.json({
    ANTHROPIC_API_KEY: inspect("ANTHROPIC_API_KEY", 108),
    NEXT_PUBLIC_SUPABASE_URL: inspect("NEXT_PUBLIC_SUPABASE_URL"),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: inspect("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    SUPABASE_SERVICE_ROLE_KEY: inspect("SUPABASE_SERVICE_ROLE_KEY"),
    IP_HASH_SALT: inspect("IP_HASH_SALT", 64),
    SKILL_VERSION: inspect("SKILL_VERSION"),
    WHOP_API_KEY: inspect("WHOP_API_KEY"),
    WHOP_APP_ID: inspect("WHOP_APP_ID"),
  });
}
