"use client";

import { useState } from "react";

type Frequency = "monthly" | "yearly" | "one_time" | "unclear" | "";

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

  const required = [idea, buyer, paysFor, frequency];
  const filledCount = required.filter((v) => v.trim().length > 0).length;
  const ready = filledCount === 4;

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

  const onSubmit = () => {
    if (!ready) return;
    // TODO: call /api/score and stream verdict — wired in step 5
    console.log("submit", { idea, buyer, paysFor, frequency, userContext });
  };

  return (
    <div className="min-h-screen">
      <TopBar />

      <div className="max-w-[1080px] mx-auto px-8 pt-12 pb-20">
        <Header />

        <Presets onPick={applyPreset} onSurprise={surprise} />

        <Terminal>
          <PromptLine />

          <InputHelper>
            <span className="text-[var(--color-accent-warm)] uppercase tracking-[0.1em] text-[10px] font-semibold block mb-0.5">
              Required fields
            </span>
            Specific buyer + clear pricing model = better signal. Vague inputs cap your scores.
          </InputHelper>

          <div className="mt-3 flex flex-col gap-3">
            <InputRow
              label="idea"
              required
              value={idea}
              onChange={setIdea}
              placeholder="(your idea — 1-3 sentences)"
            />
            <InputRow
              label="buyer"
              required
              value={buyer}
              onChange={setBuyer}
              placeholder="(who pays you?)"
            />
            <InputRow
              label="pays_for"
              required
              value={paysFor}
              onChange={setPaysFor}
              placeholder="(what they pay for)"
            />
            <InputRow
              label="frequency"
              required
              value={frequency}
              onChange={(v) => setFrequency(v as Frequency)}
              placeholder="monthly / yearly / one-time"
            />
            <InputRow
              label="you"
              optional
              value={userContext}
              onChange={setUserContext}
              placeholder="(your edge — optional)"
            />
          </div>

          <div className="mt-5 flex items-center gap-4">
            <button
              type="button"
              onClick={onSubmit}
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
        </Terminal>

        <BottomStatus />
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
        <em className="not-italic font-extrabold text-[var(--color-accent)] italic">
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
      style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05), 0 24px 48px -12px rgba(0,0,0,0.18)" }}
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

function InputHelper({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="my-4 mb-2 px-3.5 py-2.5 rounded-r-[3px] text-[12.5px] text-[var(--color-terminal-text)]"
      style={{
        background: "rgba(232, 93, 44, 0.08)",
        borderLeft: "2px solid var(--color-accent-warm)",
      }}
    >
      {children}
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

function BottomStatus() {
  return (
    <div className="mt-6 px-2 flex justify-between items-center font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--color-ink-faint)]">
      <span>Public surface · 1 idea/run · 3/day per IP</span>
      <span>Skill v1.0</span>
    </div>
  );
}
