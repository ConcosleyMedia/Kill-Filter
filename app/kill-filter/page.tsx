"use client";

import { useState } from "react";
import {
  BUILD_ROOM_URL,
  CRITERION_LABEL,
  Enhancements,
  InputRow,
  PromptLine,
  RefinementBanner,
  ScoreRow,
  ScoringProgress,
  Terminal,
  VerdictBlock,
  type CriterionEvent,
  type EnhancementOption,
  type Frequency,
  type Phase,
  type VerdictEvent,
} from "../_kf/shared";
import { KeepFiles } from "../_kf/keep-files";

// CRITERION_LABEL is re-exported above just so this page's surrounding code
// can stay on the shared constant; no other usage here.
void CRITERION_LABEL;

interface RateLimitInfo {
  limit: number;
  used: number;
  remaining: number;
  cta: string;
}

const PRESETS = [
  {
    key: "journal",
    label: "AI journaling app",
    meta: "expected: kill",
    fields: {
      idea: "An AI-powered journaling app that uses sentiment analysis to give you mental health insights.",
      buyer: "anyone who wants to improve their mental health",
      pays_for: "monthly subscription for AI insights",
      frequency: "monthly" as Frequency,
      user_context: "I've struggled with anxiety and I think this would have helped me",
    },
  },
  {
    key: "adhd",
    label: "ADHD habit tracker",
    meta: "expected: rework",
    fields: {
      idea: "A habit tracker for adults with ADHD using gentle nudges instead of streak gamification.",
      buyer: "adults with ADHD",
      pays_for: "monthly subscription for the app",
      frequency: "monthly" as Frequency,
      user_context: "I'm in a few ADHD subreddits and existing apps don't work for me",
    },
  },
  {
    key: "invoicer",
    label: "Designer invoicing tool",
    meta: "expected: keep",
    fields: {
      idea: "An invoicing tool for freelance designers with client approval flows and Figma project links.",
      buyer: "freelance designers running solo studios, $50-200k/yr revenue",
      pays_for: "monthly subscription, replacing FreshBooks or QuickBooks",
      frequency: "monthly" as Frequency,
      user_context: "I'm a freelance designer with a 4k newsletter audience and 8 years in the industry",
    },
  },
] as const;

export default function KillFilterPage() {
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
  const [rateLimit, setRateLimit] = useState<RateLimitInfo | null>(null);
  const [refinementOf, setRefinementOf] = useState<
    { parentRunId: string; mode: "REWORK" | "KILL" } | null
  >(null);

  const required = [idea, buyer, paysFor, frequency];
  const filledCount = required.filter((v) => v.trim().length > 0).length;
  const ready = filledCount === 4;
  const ideaSnippet = idea.length > 60 ? idea.slice(0, 60) + "..." : idea;

  const applyPreset = (key: string) => {
    const p = PRESETS.find((x) => x.key === key);
    if (!p) return;
    setIdea(p.fields.idea);
    setBuyer(p.fields.buyer);
    setPaysFor(p.fields.pays_for);
    setFrequency(p.fields.frequency);
    setUserContext(p.fields.user_context);
  };

  const surprise = () => {
    const k = PRESETS[Math.floor(Math.random() * PRESETS.length)].key;
    applyPreset(k);
  };

  const reset = () => {
    setPhase("idle");
    setCriteria([]);
    setVerdict(null);
    setErrorMsg(null);
    setPreviouslyScoredAt(null);
    setRateLimit(null);
    setRefinementOf(null);
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
    setRateLimit(null);
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
        if (payload) {
          setRateLimit({
            limit: payload.limit,
            used: payload.used,
            remaining: payload.remaining,
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
      <TopBar />

      <div className="max-w-[1080px] mx-auto px-8 pt-12 pb-20">
        <Header />

        {phase === "idle" && (
          <Presets onPick={applyPreset} onSurprise={surprise} />
        )}

        <Terminal>
          {phase === "idle" ? (
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
              rateLimit={rateLimit}
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

        {verdict?.verdict === "KEEP" && <KeepFiles runId={verdict.run_id} />}

        <BottomStatus skillVersion={verdict?.skill_version ?? "1.0"} />
      </div>
    </div>
  );
}

/* ---------- Subcomponents ---------- */

function TopBar() {
  return (
    <div
      className="sticky top-0 z-10 border-b border-[var(--color-rule)] bg-[var(--color-bg)]
                 px-8 py-3.5 flex justify-between items-center font-mono text-[11px]
                 uppercase tracking-[0.08em] text-[var(--color-ink-faint)]"
    >
      <div className="text-[var(--color-ink)] font-medium">
        Build Room <span className="text-[var(--color-accent)]">·</span> Kill Filter
      </div>
      <div className="flex gap-4 items-center">
        <span className="flex gap-1.5 items-center">
          <span className="w-1.5 h-1.5 bg-[var(--color-keep)] rounded-full" />
          public · 3 of 3 today
        </span>
      </div>
    </div>
  );
}

function Header() {
  return (
    <header className="mb-9">
      <span
        className="inline-block px-3 py-[5px] mb-4 rounded-[2px] font-mono text-[11px]
                   uppercase tracking-[0.1em] text-[var(--color-accent)]
                   bg-[rgba(221,51,0,0.1)] border border-[rgba(221,51,0,0.25)]"
      >
        v1 · public preview
      </span>
      <h1 className="font-display font-extrabold text-[clamp(40px,5.5vw,64px)] leading-[0.95] tracking-[-0.035em] mb-4 text-[var(--color-ink)]">
        Most AI tells you yes.
        <br />
        <em className="font-extrabold text-[var(--color-accent)] italic">
          The Kill Filter
        </em>{" "}
        is built to say no.
      </h1>
      <p className="text-[17px] leading-[1.5] text-[var(--color-ink-soft)] max-w-[580px]">
        Score your idea against 5 criteria. Get a verdict in under a minute.
        Three outcomes: <strong>kill it</strong>, <strong>rework it</strong>,
        or <strong>keep building</strong>.
      </p>
    </header>
  );
}

function Presets({
  onPick,
  onSurprise,
}: {
  onPick: (key: string) => void;
  onSurprise: () => void;
}) {
  return (
    <div className="my-9 mb-7">
      <div className="font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--color-ink-faint)] mb-3.5 flex items-center gap-3">
        <span>Starter ideas</span>
        <span className="flex-1 h-px bg-[var(--color-rule)]" />
      </div>
      <div className="grid grid-cols-3 gap-2.5">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => onPick(p.key)}
            className="bg-transparent border border-[var(--color-rule)] px-4 py-3.5 text-left
                       font-mono text-[13px] text-[var(--color-ink)] rounded-[2px] transition-all
                       hover:border-[var(--color-ink)] hover:bg-black/[0.04] hover:-translate-y-px
                       cursor-pointer"
          >
            <span className="block font-medium leading-[1.4]">{p.label}</span>
            <span className="block font-mono text-[10px] text-[var(--color-ink-faint)] uppercase tracking-[0.06em] mt-1.5">
              {p.meta}
            </span>
          </button>
        ))}
        <button
          type="button"
          onClick={onSurprise}
          className="col-span-3 bg-[var(--color-ink)] text-[var(--color-bg)] border border-[var(--color-ink)]
                     py-3 text-center font-mono text-xs uppercase tracking-[0.1em] rounded-[2px] transition-colors
                     hover:bg-[var(--color-accent)] hover:border-[var(--color-accent)] cursor-pointer"
        >
          Surprise me →
        </button>
      </div>
    </div>
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
      <PromptLine surface="public" />

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
        Specific buyer + clear pricing model = better signal. Vague inputs cap your scores.
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
  rateLimit,
  onReset,
}: {
  ideaSnippet: string;
  criteria: CriterionEvent[];
  verdict: VerdictEvent | null;
  errorMsg: string | null;
  phase: Phase;
  previouslyScoredAt: string | null;
  rateLimit: RateLimitInfo | null;
  onReset: () => void;
}) {
  if (rateLimit) {
    return <RateLimitScreen rateLimit={rateLimit} onReset={onReset} />;
  }

  const isLoading = phase === "running" && !verdict && !errorMsg;
  const cachedDate = previouslyScoredAt
    ? new Date(previouslyScoredAt).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;

  return (
    <>
      <PromptLine surface="public" />
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
      {!previouslyScoredAt && (isLoading || criteria.length > 0) && (
        <ScoringProgress scoredCount={criteria.length} isActive={isLoading} />
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

function RateLimitScreen({
  rateLimit,
  onReset,
}: {
  rateLimit: RateLimitInfo;
  onReset: () => void;
}) {
  return (
    <div className="text-center py-8">
      <div className="font-mono text-[11px] uppercase tracking-[0.12em] text-[var(--color-accent-warm)] mb-4">
        Daily limit hit · {rateLimit.used} / {rateLimit.limit}
      </div>
      <h2 className="font-display font-bold text-[34px] leading-[1.1] tracking-[-0.025em] text-[var(--color-terminal-text)] mb-3">
        You&apos;re out of public runs today.
      </h2>
      <p className="text-[var(--color-terminal-faint)] text-[14px] leading-[1.5] max-w-[480px] mx-auto mb-7">
        The public surface is capped at {rateLimit.limit}/day per IP so the brutal honesty
        stays useful. Resets at UTC midnight.
      </p>
      <a
        href={BUILD_ROOM_URL}
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

function BottomStatus({ skillVersion }: { skillVersion: string }) {
  return (
    <div className="mt-6 px-2 flex justify-between items-center font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--color-ink-faint)]">
      <span>Public surface · 1 idea/run · 3/day per IP</span>
      <span>Skill v{skillVersion}</span>
    </div>
  );
}
