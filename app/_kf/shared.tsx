// Presentational components + types shared by the public /kill-filter page
// and the Whop /experience/[experienceId] iframe surface. This folder name
// starts with `_` so Next does not treat it as a route segment.
"use client";

import { useEffect, useState } from "react";

export type Frequency = "monthly" | "yearly" | "one_time" | "unclear" | "";
export type Phase = "idle" | "running" | "result" | "error";
export type Verdict = "KILL" | "REWORK" | "KEEP";
export type CriterionKey =
  | "paying_proximity"
  | "build_scope"
  | "validation_cost"
  | "unfair_advantage"
  | "retention_shape";

export interface CriterionEvent {
  criterion: CriterionKey;
  score: number;
  reason: string;
}

export interface VerdictEvent {
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

export const CRITERION_LABEL: Record<CriterionKey, string> = {
  paying_proximity: "paying proximity",
  build_scope: "build scope",
  validation_cost: "validation cost",
  unfair_advantage: "unfair advantage",
  retention_shape: "retention shape",
};

export const BUILD_ROOM_URL = "https://whop.com/build-room";

export const VERDICT_FOOTER: Record<Verdict, { lead: string; cta: string }> = {
  KILL: {
    lead: "Got killed? Good. Workshop the next one with people doing the same thing.",
    cta: "Join Build Room → $9/mo",
  },
  REWORK: {
    lead: "Stuck on who pays? Members get unstuck in the Friday thread.",
    cta: "Join Build Room → $9/mo",
  },
  KEEP: {
    lead: "These 4 files get you started. The full 10-file blueprint, the Wall-Skip Kit, and 50+ working repos are inside Build Room.",
    cta: "Join Build Room → $9/mo",
  },
};

export function Terminal({ children }: { children: React.ReactNode }) {
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

export function PromptLine({ surface }: { surface: "public" | "whop" }) {
  return (
    <div className="text-[var(--color-terminal-faint)]">
      <span className="text-[var(--color-accent-warm)]">$</span>{" "}
      <span className="text-[var(--color-terminal-text)]">kf score</span>{" "}
      <span className="opacity-60">--surface={surface}</span>
    </div>
  );
}

export function InputRow({
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

export function ScoringProgress({
  scoredCount,
  isActive,
}: {
  scoredCount: number;
  isActive: boolean;
}) {
  const total = 5;
  const phase =
    scoredCount === 0
      ? "Reading rubric…"
      : scoredCount < total
        ? `Scoring criterion ${scoredCount} of ${total}…`
        : "Computing verdict…";
  const pct = isActive
    ? Math.max(8, (scoredCount / total) * 100)
    : (scoredCount / total) * 100;

  return (
    <div className="mt-3 mb-1">
      <div className="flex items-center justify-between font-mono text-[11.5px] text-[var(--color-terminal-faint)] mb-2">
        <span>
          <span className="text-[var(--color-accent-warm)]">▸</span>{" "}
          <span className="text-[var(--color-terminal-text)]">{phase}</span>
          {isActive && <span className="cursor-blink" />}
        </span>
        <span>
          {scoredCount}/{total}
        </span>
      </div>
      <div className="h-[3px] bg-white/[0.06] rounded-[1px] overflow-hidden relative">
        <div
          className="h-full transition-[width] duration-700 ease-out"
          style={{
            width: `${pct}%`,
            background: "var(--color-accent-warm)",
            opacity: isActive ? 1 : 0.6,
          }}
        />
        {isActive && scoredCount < total && (
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(90deg, transparent 0%, rgba(232,93,44,0.25) 50%, transparent 100%)",
              animation: "scoreShimmer 1.6s ease-in-out infinite",
            }}
          />
        )}
      </div>
    </div>
  );
}

export function ScoreRow({
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
  const scoreColor = barColor;
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

export interface EnhancementFields {
  idea: string;
  buyer: string;
  pays_for: string;
  frequency: string;
  you: string;
}

export interface EnhancementOption {
  tag: string;
  idea: string;
  fit: string;
  fields: EnhancementFields;
  criterion: string;
}

type EnhanceStatus =
  | { kind: "loading" }
  | { kind: "ready"; options: EnhancementOption[] }
  | { kind: "error"; message: string };

export function Enhancements({
  runId,
  mode,
  onSelect,
}: {
  runId: string;
  mode: "REWORK" | "KILL";
  onSelect: (option: EnhancementOption, parentRunId: string) => void;
}) {
  const [status, setStatus] = useState<EnhanceStatus>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    setStatus({ kind: "loading" });
    (async () => {
      try {
        const res = await fetch("/api/enhance", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ run_id: runId }),
        });
        const json = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          setStatus({
            kind: "error",
            message: typeof json.error === "string" ? json.error : "request_failed",
          });
          return;
        }
        const opts = Array.isArray(json.enhancements) ? json.enhancements : [];
        setStatus({ kind: "ready", options: opts as EnhancementOption[] });
      } catch (err) {
        if (cancelled) return;
        setStatus({
          kind: "error",
          message: err instanceof Error ? err.message : "network_error",
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [runId]);

  const lead =
    mode === "REWORK"
      ? "Sharpen your idea and rerun. The next score is free."
      : "This framing won't work. Try one of these rebuilds. The next score is free.";
  const eyebrow = mode === "REWORK" ? "Rework options" : "Rebuild options";

  if (status.kind === "loading") {
    return (
      <EnhanceFrame eyebrow={eyebrow} title="" subtitle="">
        <EnhancementProgress />
      </EnhanceFrame>
    );
  }

  if (status.kind === "error") {
    return (
      <EnhanceFrame eyebrow={eyebrow} title="Couldn't generate options" subtitle="">
        <div
          className="px-4 py-3 rounded-[3px] text-[12.5px]"
          style={{
            background: "rgba(204, 51, 51, 0.10)",
            border: "1px solid rgba(204, 51, 51, 0.4)",
            color: "#FF8B8B",
          }}
        >
          <div className="font-semibold uppercase tracking-[0.1em] text-[10px] mb-1">Error</div>
          <div className="font-mono text-[12.5px]">{status.message}</div>
        </div>
      </EnhanceFrame>
    );
  }

  return (
    <EnhanceFrame eyebrow={eyebrow} title={lead} subtitle="">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {status.options.map((opt, i) => (
          <EnhanceCard
            key={i}
            option={opt}
            onClick={() => onSelect(opt, runId)}
          />
        ))}
      </div>
    </EnhanceFrame>
  );
}

// Phased progress while /api/enhance generates + KEEP-validates options.
// Walks through the actual server stages (generate ~5s, score in parallel
// ~8s, validate). The bar animates indeterminately because the client
// can't know exactly where the server is in real time.
const ENHANCEMENT_PHASES = [
  { atMs: 0, label: "Generating 3 options…" },
  { atMs: 5000, label: "Scoring each option against the rubric…" },
  { atMs: 13000, label: "Validating KEEP candidates…" },
  { atMs: 22000, label: "Regenerating any that didn't clear…" },
  { atMs: 32000, label: "Almost there — this run is on the slow side…" },
] as const;
const ENHANCEMENT_TOTAL_MS = 28000;

function EnhancementProgress() {
  const [elapsedMs, setElapsedMs] = useState(0);
  useEffect(() => {
    const start = Date.now();
    const t = setInterval(() => setElapsedMs(Date.now() - start), 250);
    return () => clearInterval(t);
  }, []);

  const phase =
    [...ENHANCEMENT_PHASES].reverse().find((p) => elapsedMs >= p.atMs) ??
    ENHANCEMENT_PHASES[0];
  const pct = Math.min(96, (elapsedMs / ENHANCEMENT_TOTAL_MS) * 100);

  return (
    <div className="py-2">
      <div className="flex items-center justify-between font-mono text-[12px] text-[var(--color-ink-soft)] mb-2">
        <span>
          <span className="text-[var(--color-accent-warm)]">▸</span>{" "}
          <span className="text-[var(--color-ink)]">{phase.label}</span>
          <span className="cursor-blink" />
        </span>
        <span className="text-[var(--color-ink-faint)] font-mono text-[11px]">
          {Math.floor(elapsedMs / 1000)}s
        </span>
      </div>
      <div className="h-[4px] bg-black/[0.06] rounded-[1px] overflow-hidden relative">
        <div
          className="h-full transition-[width] duration-300 ease-out"
          style={{
            width: `${pct}%`,
            background: "var(--color-accent-warm)",
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(90deg, transparent 0%, rgba(232,93,44,0.3) 50%, transparent 100%)",
            animation: "scoreShimmer 1.6s ease-in-out infinite",
          }}
        />
      </div>
      <div className="mt-2 font-mono text-[11px] text-[var(--color-ink-faint)]">
        Each option is rerun-tested to make sure it would score KEEP.
      </div>
    </div>
  );
}

function EnhanceFrame({
  eyebrow,
  title,
  subtitle,
  children,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      className="mt-6 px-6 py-5 rounded-md"
      style={{
        background: "rgba(232, 93, 44, 0.05)",
        border: "1px solid rgba(232, 93, 44, 0.25)",
      }}
    >
      <div className="font-mono text-[11px] uppercase tracking-[0.12em] text-[var(--color-accent-warm)] mb-1.5">
        {eyebrow}
      </div>
      {title && (
        <div className="font-display font-bold text-[18px] leading-[1.25] tracking-[-0.015em] text-[var(--color-ink)] mb-1">
          {title}
        </div>
      )}
      {subtitle && (
        <div className="text-[13px] text-[var(--color-ink-soft)] mb-4">{subtitle}</div>
      )}
      <div className={title || subtitle ? "mt-4" : "mt-2"}>{children}</div>
    </div>
  );
}

function EnhanceCard({
  option,
  onClick,
}: {
  option: EnhancementOption;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left bg-[var(--color-terminal-bg)] border border-[var(--color-terminal-border)] rounded-[3px] p-4 cursor-pointer hover:border-[var(--color-accent-warm)] hover:-translate-y-px transition-all flex flex-col gap-2 min-h-[180px]"
    >
      <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-[var(--color-accent-warm)]">
        {option.tag}
      </span>
      <span className="font-mono text-[13px] leading-[1.45] text-[var(--color-terminal-text)]">
        {option.idea}
      </span>
      <span className="mt-auto pt-2 font-mono text-[11.5px] leading-[1.5] text-[var(--color-terminal-faint)]">
        {option.fit}
      </span>
      <span className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-[var(--color-accent)] mt-1">
        Use this →
      </span>
    </button>
  );
}

export function RefinementBanner({
  mode,
  onClear,
}: {
  mode: "REWORK" | "KILL";
  onClear: () => void;
}) {
  const text =
    mode === "REWORK"
      ? "✓ Idea sharpened — ready to rerun. This run won't count against your daily limit."
      : "✓ Idea rebuilt — ready to rerun. This run won't count against your daily limit.";
  return (
    <div
      className="my-4 px-3.5 py-2.5 rounded-r-[3px] text-[12.5px] text-[var(--color-terminal-text)] flex items-center justify-between gap-3"
      style={{
        background: "rgba(63, 179, 105, 0.08)",
        borderLeft: "2px solid var(--color-keep-bright)",
      }}
    >
      <span>{text}</span>
      <button
        type="button"
        onClick={onClear}
        className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-[var(--color-terminal-faint)] hover:text-[var(--color-terminal-text)] cursor-pointer"
      >
        clear
      </button>
    </div>
  );
}

export function VerdictBlock({ verdict }: { verdict: VerdictEvent }) {
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
        <span className="text-[var(--color-terminal-text)]">
          {VERDICT_FOOTER[verdict.verdict].lead}
        </span>
        <a
          href={BUILD_ROOM_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-block bg-[var(--color-accent)] text-white px-4 py-2 rounded-[3px] font-mono text-[11px] uppercase tracking-[0.1em] font-medium hover:bg-[var(--color-accent-warm)] transition-colors"
        >
          {VERDICT_FOOTER[verdict.verdict].cta}
        </a>
      </div>
    </div>
  );
}
