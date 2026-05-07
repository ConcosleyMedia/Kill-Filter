import { headers } from "next/headers";
import { whopConfigured, whopSdk } from "@/lib/whop-sdk";
import { ExperienceTool } from "./experience-tool";
import { GateScreen } from "./gate-screen";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ experienceId: string }>;
}

export default async function ExperiencePage({ params }: PageProps) {
  const { experienceId } = await params;

  if (!whopConfigured()) {
    return (
      <GateScreen
        title="Whop integration not configured"
        body="WHOP_API_KEY and WHOP_APP_ID are missing on the server. Reach out to the operator."
      />
    );
  }

  const sdk = whopSdk();
  const h = await headers();

  let userId: string;
  try {
    ({ userId } = await sdk.verifyUserToken(h));
  } catch {
    return (
      <GateScreen
        title="Open this from inside Whop"
        body="The Kill Filter is embedded inside the Build Room on Whop. Visit Whop and launch it from there."
        ctaLabel="Visit Build Room"
        ctaHref="https://whop.com/build-room"
      />
    );
  }

  const access = await sdk.users
    .checkAccess(experienceId, { id: userId })
    .catch(() => ({ has_access: false, access_level: "no_access" as const }));

  if (!access.has_access) {
    return (
      <GateScreen
        title="Build Room membership required"
        body="The Kill Filter is included with free Build Room. Join to get scoring, the 4-file blueprint on KEEP, and the Friday rework thread."
        ctaLabel="Join Build Room → free"
        ctaHref="https://whop.com/build-room"
      />
    );
  }

  return <ExperienceTool userId={userId} accessLevel={access.access_level} />;
}
