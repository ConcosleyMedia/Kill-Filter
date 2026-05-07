"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CRITERION_LABEL,
  Enhancements,
  InputRow,
  PromptLine,
  RefinementBanner,
  ScoreRow,
  Terminal,
  VerdictBlock,
  type CriterionEvent,
  type EnhancementOption,
  type Frequency,
  type Phase,
  type VerdictEvent,
} from "../../_kf/shared";
import { KeepFiles } from "./keep-files";

void CRITERION_LABEL;

interface WhopQuota {
  daily_used: number;
  daily_limit: number;
  daily_remaining: number;
  weekly_used: number;
  weekly_limit: number;
  weekly_remaining: number;
  exceeded: boolean;
  blocked_scope: "daily" | "weekly" | null;
  resets_at: string;
}

interface RateLimitInfo {
  scope: "daily" | "weekly";
  daily_used: number;
  daily_limit: number;
  weekly_used: number;
  weekly_limit: number;
  resets_at: string;
  cta: string;
}

interface ExperienceToolProps {
  userId: string;
  accessLevel: string;
}

export function ExperienceTool({ userId, accessLevel }: ExperienceToolProps) {
  const [idea, setIdea] = useState("");
  const [buyer, setBuyer] = useState("");
  const [paysFor, setPaysFor] = useState("");
  const [frequency, setFrequency] = useState<Frequency>("");
  const [userContext, setUserContext] = useState("");

  const [phase, setPhase] = useState<Phase>("idle");
  const [criteria, setCriteria] = useState<CriterionEvent[]>([]);
  const [verdict, setVerdict] = useState<VerdictEvent | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [previouslyScoredAt, setPreviouslyScoredAt] = useState<string | null>(null);
  const [refinementOf, setRefinementOf] = useState<
    { parentRunId: string; mode: "REWORK" | "KILL" } | null
  >(null);
  const [quota, setQuota] = useState<WhopQuota | null>(null);
  const [rateLimit, setRateLimit] = useState<RateLimitInfo | null>(null);

  const refreshQuota = useCallback(async () => {
    try {
      const res = await fetch("/api/whop-quota");
      if (!res.ok) return;
      const data = (await res.json()) as WhopQuota;
      setQuota(data);
    } catch {
      // ignore — counter just won't update
    }
  }, []);

  useEffect(() => {
    refreshQuota();
  }, [refreshQuota]);

  const required = [idea, buyer, paysFor, frequency];
  const filledCount = required.filter((v) => v.trim().length > 0).length;
  const ready = filledCount === 4;
  const ideaSnippet = idea.length > 60 ? idea.slice(0, 60) + "..." : idea;

  const reset = () => {
    setPhase("idle");
    setCriteria([]);
    setVerdict(null);
    setErrorMsg(null);
    setPreviouslyScoredAt(null);
    setRefinementOf(null);
    setRateLimit(null);
  };

  const applyEnhancement = (opt: EnhancementOption, parentRunId: string) => {
    setIdea(opt.fields.idea);
    setBuyer(opt.fields.buyer);
    setPaysFor(opt.fields.pays_for);
    setFrequency(opt.fields.frequency as Frequency);
    setUserContext(opt.fields.you);
    setPhase("idle");
    setCriteria([]);
    setVerdict(null);
    setErrorMsg(null);
    setPreviouslyScoredAt(null);
    const mode: "REWORK" | "KILL" =
      verdict?.verdict === "KILL" ? "KILL" : "REWORK";
    setRefinementOf({ parentRunId, mode });
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const runFilter = async () => {
    if (!ready) return;
    setPhase("running");
    setCriteria([]);
    setVerdict(null);
    setErrorMsg(null);
    setPreviouslyScoredAt(null);
    setRateLimit(null);

    try {
      const res = await fetch("/api/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idea,
          buyer,
          pays_for: paysFor,
          frequency,
          user_context: userContext,
          refinement_of: refinementOf?.parentRunId ?? undefined,
        }),
      });

      if (res.status === 429) {
        const payload = (await res.json().catch(() => null)) as
          | (RateLimitInfo & { error?: string })
          | null;
        if (payload && payload.scope) {
          setRateLimit({
            scope: payload.scope,
            daily_used: payload.daily_used,
            daily_limit: payload.daily_limit,
            weekly_used: payload.weekly_used,
            weekly_limit: payload.weekly_limit,
            resets_at: payload.resets_at,
            cta: payload.cta,
          });
        }
        setPhase("error");
        setErrorMsg("rate_limited");
        return;
      }

      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({ error: "request_failed" }));
        setErrorMsg(typeof err.error === "string" ? err.error : "request_failed");
        setPhase("error");
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let sepIdx: number;
        while ((sepIdx = buffer.indexOf("\n\n")) !== -1) {
          const block = buffer.slice(0, sepIdx);
          buffer = buffer.slice(sepIdx + 2);

          let event = "message";
          let data = "";
          for (const line of block.split("\n")) {
            if (line.startsWith("event: ")) event = line.slice(7);
            else if (line.startsWith("data: ")) data = line.slice(6);
          }
          if (!data) continue;

          let payload: unknown;
          try {
            payload = JSON.parse(data);
          } catch {
            continue;
          }

          if (event === "cached") {
            const p = payload as { previously_scored_at?: string };
            if (p.previously_scored_at) setPreviouslyScoredAt(p.previously_scored_at);
          } else if (event === "criterion") {
            setCriteria((prev) => [...prev, payload as CriterionEvent]);
          } else if (event === "verdict") {
            setVerdict(payload as VerdictEvent);
            setPhase("result");
            // The server has incremented quota by now (or it was a cache hit
            // that didn't); refresh so the TopBar counter matches reality.
            refreshQuota();
          } else if (event === "error") {
            const m = (payload as { message?: string }).message ?? "unknown";
            setErrorMsg(m);
            setPhase("error");
          }
        }
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "network_error");
      setPhase("error");
    }
  };

  return (
    <div className="min-h-screen">
      <TopBar accessLevel={accessLevel} quota={quota} />

      <div className="max-w-[1080px] mx-auto px-8 pt-8 pb-20">
        <Header userId={userId} />

        <Terminal>
          {rateLimit ? (
            <WhopRateLimitScreen rateLimit={rateLimit} onReset={reset} />
          ) : phase === "idle" ? (
            <IdleScreen
              idea={idea}
              buyer={buyer}
              paysFor={paysFor}
              frequency={frequency}
              userContext={userContext}
              setIdea={setIdea}
              setBuyer={setBuyer}
              setPaysFor={setPaysFor}
              setFrequency={(v) => setFrequency(v as Frequency)}
              setUserContext={setUserContext}
              filledCount={filledCount}
              ready={ready}
              onRun={runFilter}
              refinementBanner={
                refinementOf && (
                  <RefinementBanner
                    mode={refinementOf.mode}
                    onClear={() => setRefinementOf(null)}
                  />
                )
              }
            />
          ) : (
            <RunningScreen
              ideaSnippet={ideaSnippet}
              criteria={criteria}
              verdict={verdict}
              errorMsg={errorMsg}
              phase={phase}
              previouslyScoredAt={previouslyScoredAt}
              onReset={reset}
            />
          )}
        </Terminal>

        {verdict && (verdict.verdict === "REWORK" || verdict.verdict === "KILL") && (
          <Enhancements
            runId={verdict.run_id}
            mode={verdict.verdict}
            onSelect={applyEnhancement}
          />
        )}

        {verdict?.verdict === "KEEP" && (
          <KeepFiles runId={verdict.run_id} />
        )}

        <BottomStatus skillVersion={verdict?.skill_version ?? "1.0"} />
      </div>
    </div>
  );
}

function TopBar({
  accessLevel,
  quota,
}: {
  accessLevel: string;
  quota: WhopQuota | null;
}) {
  const dot = quota?.exceeded ? "var(--color-accent)" : "var(--color-keep)";
  return (
    <div
      className="border-b border-[var(--color-rule)] bg-[var(--color-bg)]
                 px-8 py-3.5 flex justify-between items-center font-mono text-[11px]
                 uppercase tracking-[0.08em] text-[var(--color-ink-faint)]"
    >
      <div className="text-[var(--color-ink)] font-medium">
        Build Room <span className="text-[var(--color-accent)]">·</span> Kill Filter
      </div>
      <div className="flex gap-4 items-center">
        <span className="flex gap-1.5 items-center">
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: dot }} />
          whop · {accessLevel}
        </span>
        {quota && (
          <span className="text-[var(--color-ink-faint)]">
            {quota.daily_used}/{quota.daily_limit} today ·{" "}
            {quota.weekly_used}/{quota.weekly_limit} weekly
          </span>
        )}
      </div>
    </div>
  );
}

function WhopRateLimitScreen({
  rateLimit,
  onReset,
}: {
  rateLimit: RateLimitInfo;
  onReset: () => void;
}) {
  const isWeekly = rateLimit.scope === "weekly";
  const title = isWeekly
    ? "You've used this week's runs."
    : "You've used today's run.";
  const sub = isWeekly
    ? `${rateLimit.weekly_used} of ${rateLimit.weekly_limit} weekly runs spent. Free tier resets ${formatResets(rateLimit.resets_at)}.`
    : `Today's daily run is spent. ${Math.max(0, rateLimit.weekly_limit - rateLimit.weekly_used)} of ${rateLimit.weekly_limit} weekly runs still available — daily resets at UTC midnight.`;

  return (
    <div className="text-center py-8">
      <div className="font-mono text-[11px] uppercase tracking-[0.12em] text-[var(--color-accent-warm)] mb-4">
        {isWeekly ? "Weekly limit · hit" : "Daily limit · hit"}
      </div>
      <h2 className="font-display font-bold text-[34px] leading-[1.1] tracking-[-0.025em] text-[var(--color-terminal-text)] mb-3">
        {title}
      </h2>
      <p className="text-[var(--color-terminal-faint)] text-[14px] leading-[1.5] max-w-[520px] mx-auto mb-7">
        {sub}
      </p>
      <a
        href="https://whop.com/build-room"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-block bg-[var(--color-accent)] text-white px-7 py-3 rounded-[3px] font-mono text-xs uppercase tracking-[0.1em] font-medium hover:bg-[var(--color-accent-warm)] transition-colors"
      >
        {rateLimit.cta} →
      </a>
      <div className="mt-7">
        <button
          type="button"
          onClick={onReset}
          className="bg-transparent border border-[var(--color-terminal-border)] text-[var(--color-terminal-faint)] px-4 py-1.5 rounded-[3px] font-mono text-[11px] uppercase tracking-[0.1em] hover:border-[var(--color-terminal-text)] hover:text-[var(--color-terminal-text)] cursor-pointer transition-colors"
        >
          ← Back
        </button>
      </div>
    </div>
  );
}

function formatResets(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

function Header({ userId }: { userId: string }) {
  return (
    <header className="mb-7">
      <span
        className="inline-block px-3 py-[5px] mb-4 rounded-[2px] font-mono text-[11px]
                   uppercase tracking-[0.1em] text-[var(--color-accent)]
                   bg-[rgba(221,51,0,0.1)] border border-[rgba(221,51,0,0.25)]"
      >
        Build Room · member surface
      </span>
      <h1 className="font-display font-extrabold text-[clamp(32px,4.5vw,48px)] leading-[0.98] tracking-[-0.03em] mb-3 text-[var(--color-ink)]">
        Score it. Keep, rework, or kill.
      </h1>
      <p className="text-[15px] leading-[1.5] text-[var(--color-ink-soft)] max-w-[600px]">
        On KEEP you get the four starter files for your build. Signed in as{" "}
        <code className="font-mono text-[12.5px] text-[var(--color-ink)]">{userId}</code>.
      </p>
    </header>
  );
}

function IdleScreen({
  idea,
  buyer,
  paysFor,
  frequency,
  userContext,
  setIdea,
  setBuyer,
  setPaysFor,
  setFrequency,
  setUserContext,
  filledCount,
  ready,
  onRun,
  refinementBanner,
}: {
  idea: string;
  buyer: string;
  paysFor: string;
  frequency: string;
  userContext: string;
  setIdea: (v: string) => void;
  setBuyer: (v: string) => void;
  setPaysFor: (v: string) => void;
  setFrequency: (v: string) => void;
  setUserContext: (v: string) => void;
  filledCount: number;
  ready: boolean;
  onRun: () => void;
  refinementBanner?: React.ReactNode;
}) {
  return (
    <>
      <PromptLine surface="whop" />

      {refinementBanner}

      <div
        className="my-4 mb-2 px-3.5 py-2.5 rounded-r-[3px] text-[12.5px] text-[var(--color-terminal-text)]"
        style={{
          background: "rgba(232, 93, 44, 0.08)",
          borderLeft: "2px solid var(--color-accent-warm)",
        }}
      >
        <span className="text-[var(--color-accent-warm)] uppercase tracking-[0.1em] text-[10px] font-semibold block mb-0.5">
          Required fields
        </span>
        Specific buyer + clear pricing model = better signal. KEEP unlocks the four-file blueprint.
      </div>

      <div className="mt-3 flex flex-col gap-3">
        <InputRow label="idea" required value={idea} onChange={setIdea} placeholder="(your idea — 1-3 sentences)" />
        <InputRow label="buyer" required value={buyer} onChange={setBuyer} placeholder="(who pays you?)" />
        <InputRow label="pays_for" required value={paysFor} onChange={setPaysFor} placeholder="(what they pay for)" />
        <InputRow label="frequency" required value={frequency} onChange={setFrequency} placeholder="monthly / yearly / one-time" />
        <InputRow label="you" optional value={userContext} onChange={setUserContext} placeholder="(your edge — optional)" />
      </div>

      <div className="mt-5 flex items-center gap-4">
        <button
          type="button"
          onClick={onRun}
          disabled={!ready}
          className="bg-[var(--color-accent)] text-white px-6 py-2.5 rounded-[3px] font-mono text-xs uppercase tracking-[0.1em] font-medium transition-colors hover:bg-[var(--color-accent-warm)] disabled:bg-white/[0.08] disabled:text-[var(--color-terminal-faint)] disabled:cursor-not-allowed cursor-pointer"
        >
          Run filter →
        </button>
        <span
          className={`font-mono text-[11px] uppercase tracking-[0.08em] ${
            ready ? "text-[var(--color-keep-bright)]" : "text-[var(--color-terminal-faint)]"
          }`}
        >
          <strong className={ready ? "text-[var(--color-keep-bright)]" : "text-[var(--color-terminal-text)]"}>
            {filledCount}
          </strong>{" "}
          of 4 required fields
        </span>
      </div>
    </>
  );
}

function RunningScreen({
  ideaSnippet,
  criteria,
  verdict,
  errorMsg,
  phase,
  previouslyScoredAt,
  onReset,
}: {
  ideaSnippet: string;
  criteria: CriterionEvent[];
  verdict: VerdictEvent | null;
  errorMsg: string | null;
  phase: Phase;
  previouslyScoredAt: string | null;
  onReset: () => void;
}) {
  const showCursor = phase === "running" && !verdict && !errorMsg;
  const cachedDate = previouslyScoredAt
    ? new Date(previouslyScoredAt).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;

  return (
    <>
      <PromptLine surface="whop" />
      <div className="text-[#5A5045] italic mt-2">
        {`// running... ${ideaSnippet}`}
      </div>
      {previouslyScoredAt && (
        <div
          className="mt-3 inline-block px-2.5 py-1 rounded-[2px] font-mono text-[11px] uppercase tracking-[0.08em]"
          style={{
            background: "rgba(63, 179, 105, 0.12)",
            color: "var(--color-keep-bright)",
            border: "1px solid rgba(63, 179, 105, 0.3)",
          }}
        >
          ✓ Previously scored on {cachedDate} — cached
        </div>
      )}
      {(criteria.length > 0 || phase !== "idle") && !previouslyScoredAt && (
        <div className="text-[#5A5045] italic mt-1">
          {`// scoring against 5 criteria`}
          {showCursor && criteria.length === 0 && <span className="cursor-blink" />}
        </div>
      )}

      <div className="mt-5 flex flex-col gap-3">
        {criteria.map((c, i) => (
          <ScoreRow key={c.criterion} index={i} criterion={c} />
        ))}
      </div>

      {verdict && <VerdictBlock verdict={verdict} />}

      {errorMsg && !verdict && (
        <div
          className="mt-6 px-4 py-3 rounded-[3px] text-[12.5px]"
          style={{
            background: "rgba(204, 51, 51, 0.10)",
            border: "1px solid rgba(204, 51, 51, 0.4)",
            color: "#FF8B8B",
          }}
        >
          <div className="font-semibold uppercase tracking-[0.1em] text-[10px] mb-1">Error</div>
          <div className="font-mono text-[12.5px]">{errorMsg}</div>
        </div>
      )}

      {(verdict || errorMsg) && (
        <div className="mt-7">
          <button
            type="button"
            onClick={onReset}
            className="bg-transparent border border-[var(--color-terminal-border)] text-[var(--color-terminal-text)] px-5 py-2 rounded-[3px] font-mono text-[11px] uppercase tracking-[0.1em] hover:border-[var(--color-accent-warm)] hover:text-[var(--color-accent-warm)] cursor-pointer transition-colors"
          >
            ← Run another idea
          </button>
        </div>
      )}
    </>
  );
}

function BottomStatus({ skillVersion }: { skillVersion: string }) {
  return (
    <div className="mt-6 px-2 flex justify-between items-center font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--color-ink-faint)]">
      <span>Whop surface · 1/day · 5/week · refinements free</span>
      <span>Skill v{skillVersion}</span>
    </div>
  );
}
