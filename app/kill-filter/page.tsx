"use client";

import { useState } from "react";

type Frequency = "monthly" | "yearly" | "one_time" | "unclear" | "";
type Phase = "idle" | "running" | "result" | "error";
type Verdict = "KILL" | "REWORK" | "KEEP";
type CriterionKey =
  | "paying_proximity"
  | "build_scope"
  | "validation_cost"
  | "unfair_advantage"
  | "retention_shape";

interface CriterionEvent {
  criterion: CriterionKey;
  score: number;
  reason: string;
}

interface VerdictEvent {
  verdict: Verdict;
  rule: string;
  total: number;
  display_total: number;
  headline: string;
  skill_version: string;
  run_id: string;
  cached?: boolean;
  previously_scored_at?: string;
  cache_read_input_tokens?: number;
  cache_creation_input_tokens?: number;
}

interface RateLimitInfo {
  limit: number;
  used: number;
  remaining: number;
  cta: string;
}

const CRITERION_LABEL: Record<CriterionKey, string> = {
  paying_proximity: "paying proximity",
  build_scope: "build scope",
  validation_cost: "validation cost",
  unfair_advantage: "unfair advantage",
  retention_shape: "retention shape",
};

const VERDICT_FOOTER: Record<Verdict, string> = {
  KILL: "Got killed? Good. Workshop the next one with people doing the same thing. → $9/mo",
  REWORK: "Stuck on who pays? Members get unstuck in the Friday thread. → $9/mo",
  KEEP: "These 4 files get you started. The full 10-file blueprint, the Wall-Skip Kit, and 50+ working repos are inside Build Room. → $9/mo",
};

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

      // Parse SSE: events are separated by blank lines, fields by single newlines.
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

function Terminal({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="bg-[var(--color-terminal-bg)] rounded-md overflow-hidden"
      style={{
        boxShadow:
          "inset 0 1px 0 rgba(255,255,255,0.05), 0 24px 48px -12px rgba(0,0,0,0.18)",
      }}
    >
      <div className="bg-[#1A1A1A] border-b border-[var(--color-terminal-border)] px-4 py-2.5 flex items-center gap-3.5">
        <div className="flex gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#FF5F57]" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#FEBC2E]" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#28C840]" />
        </div>
        <div className="flex-1 text-center font-mono text-[11px] text-[var(--color-terminal-faint)] tracking-[0.04em]">
          kill-filter ~ score idea
        </div>
      </div>
      <div className="p-7 font-mono text-[13.5px] leading-[1.65] text-[var(--color-terminal-text)] min-h-[320px]">
        {children}
      </div>
    </div>
  );
}

function PromptLine() {
  return (
    <div className="text-[var(--color-terminal-faint)]">
      <span className="text-[var(--color-accent-warm)]">$</span>{" "}
      <span className="text-[var(--color-terminal-text)]">kf score</span>{" "}
      <span className="opacity-60">--surface=public</span>
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
}) {
  return (
    <>
      <PromptLine />

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
  // Rate-limit short-circuit: render the CTA screen, not the scoring UI.
  if (rateLimit) {
    return <RateLimitScreen rateLimit={rateLimit} onReset={onReset} />;
  }

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
      <PromptLine />
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
        href="https://whop.com"
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

function ScoreRow({
  index,
  criterion,
}: {
  index: number;
  criterion: CriterionEvent;
}) {
  const tier = criterion.score <= 4 ? "low" : criterion.score <= 6 ? "mid" : "high";
  const fillPct = criterion.score / 10;
  const barColor =
    tier === "high"
      ? "var(--color-keep-bright)"
      : tier === "mid"
        ? "#E5A03A"
        : "var(--color-accent)";
  const scoreColor =
    tier === "high"
      ? "var(--color-keep-bright)"
      : tier === "mid"
        ? "#E5A03A"
        : "var(--color-accent)";
  return (
    <div
      className="grid items-center gap-3.5 opacity-0"
      style={{
        gridTemplateColumns: "175px 100px 1fr 50px",
        animation: `streamIn 0.4s ease-out ${index * 50 + 100}ms forwards`,
      }}
    >
      <div className="text-[var(--color-terminal-text)] text-[13px]">
        {CRITERION_LABEL[criterion.criterion]}
      </div>
      <div className="h-[7px] bg-white/[0.06] rounded-[1px] overflow-hidden">
        <div
          className="h-full origin-left"
          style={
            {
              ["--fill" as string]: String(fillPct),
              transform: "scaleX(0)",
              animation: `barFill 0.6s ease-out ${index * 50 + 250}ms forwards`,
              background: barColor,
            } as React.CSSProperties
          }
        />
      </div>
      <div className="text-[var(--color-terminal-faint)] text-[12.5px] leading-[1.4]">
        {criterion.reason}
      </div>
      <div
        className="font-mono font-medium text-right text-[13px]"
        style={{ color: scoreColor }}
      >
        {criterion.score}/10
      </div>
    </div>
  );
}

function VerdictBlock({ verdict }: { verdict: VerdictEvent }) {
  const v = verdict.verdict.toLowerCase() as "kill" | "rework" | "keep";
  const bg =
    v === "kill"
      ? "rgba(204, 51, 51, 0.10)"
      : v === "rework"
        ? "rgba(216, 118, 0, 0.10)"
        : "rgba(63, 179, 105, 0.12)";
  const border =
    v === "kill"
      ? "rgba(204, 51, 51, 0.4)"
      : v === "rework"
        ? "rgba(216, 118, 0, 0.4)"
        : "rgba(63, 179, 105, 0.4)";
  const verdictColor =
    v === "kill"
      ? "var(--color-kill-bright)"
      : v === "rework"
        ? "var(--color-rework-bright)"
        : "var(--color-keep-bright)";
  const sub =
    v === "rework"
      ? "Your idea has bones — but it's not specific enough to score well. Sharpen the weakest criterion above and rerun."
      : v === "kill"
        ? "This exact framing won't work. The product concept might still be salvageable around a different buyer or edge."
        : null;

  return (
    <div
      className="mt-6 px-5 py-4 rounded-[3px] opacity-0"
      style={{
        background: bg,
        border: `1px solid ${border}`,
        animation: "verdictIn 0.5s ease-out 0.3s forwards",
      }}
    >
      <div className="font-mono text-[11px] uppercase tracking-[0.12em] text-[var(--color-terminal-faint)] mb-2">
        Verdict · {verdict.display_total}/100
      </div>
      <div className="font-mono text-[16px] font-medium leading-[1.4] text-[var(--color-terminal-text)]">
        <span
          className="font-bold mr-2.5 text-[18px]"
          style={{ color: verdictColor }}
        >
          {verdict.verdict}
        </span>
        {verdict.headline}
      </div>
      {sub && (
        <div className="mt-2.5 text-[var(--color-terminal-faint)] text-[12.5px] leading-[1.5]">
          {sub}
        </div>
      )}
      <div
        className="mt-4 pt-3.5 text-[12.5px] leading-[1.5]"
        style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}
      >
        <span className="text-[var(--color-accent-warm)]">→</span>{" "}
        <span className="text-[var(--color-terminal-text)]">
          {VERDICT_FOOTER[verdict.verdict]}
        </span>
      </div>
    </div>
  );
}

function InputRow({
  label,
  required,
  optional,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  required?: boolean;
  optional?: boolean;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  const filled = value.trim().length > 0;
  return (
    <div className="flex items-center gap-2.5">
      <span
        className={`flex-shrink-0 w-[95px] flex items-center gap-1 ${
          optional ? "text-[var(--color-terminal-faint)]" : "text-[var(--color-accent-warm)]"
        }`}
      >
        {label}
        {required && <span className="text-[var(--color-accent)] font-bold text-[11px]">*</span>}
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`flex-1 bg-transparent border-0 border-b text-[var(--color-terminal-text)]
                    font-mono text-[13.5px] py-1.5 outline-none transition-colors
                    placeholder:text-[var(--color-terminal-faint)] placeholder:italic
                    focus:border-b-[var(--color-accent-warm)]
                    ${filled ? "border-b-[var(--color-keep-bright)]" : "border-b-[var(--color-terminal-border)]"}`}
      />
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
