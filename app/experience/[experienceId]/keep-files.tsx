"use client";

import { useEffect, useState } from "react";
import JSZip from "jszip";

interface FilesPayload {
  "CLAUDE.md": string;
  "spec.md": string;
  "stack.md": string;
  "cut-list.md": string;
}

const FILE_ORDER: (keyof FilesPayload)[] = [
  "CLAUDE.md",
  "spec.md",
  "stack.md",
  "cut-list.md",
];

const FILE_BLURB: Record<keyof FilesPayload, string> = {
  "CLAUDE.md": "Master agent contract — Claude Code reads this first.",
  "spec.md": "Four-feature MVP scope.",
  "stack.md": "Locked tech stack.",
  "cut-list.md": "Explicit do-not-build list.",
};

type Status =
  | { kind: "loading" }
  | { kind: "ready"; files: FilesPayload; cached: boolean }
  | { kind: "error"; message: string };

export function KeepFiles({ runId }: { runId: string }) {
  const [status, setStatus] = useState<Status>({ kind: "loading" });
  const [openFile, setOpenFile] = useState<keyof FilesPayload | null>(
    "CLAUDE.md",
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/generate-files", {
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
        setStatus({
          kind: "ready",
          files: json.files as FilesPayload,
          cached: Boolean(json.cached),
        });
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

  if (status.kind === "loading") {
    return <Frame title="Generating your four starter files…" subtitle="Usually under 20 seconds." />;
  }

  if (status.kind === "error") {
    return (
      <Frame title="Couldn't generate files" subtitle="">
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
      </Frame>
    );
  }

  const { files, cached } = status;

  const downloadZip = async () => {
    const zip = new JSZip();
    for (const name of FILE_ORDER) {
      zip.file(name, files[name]);
    }
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "kill-filter-starter.zip";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <Frame
      title="Your four starter files"
      subtitle={
        cached
          ? "Restored from your previous run."
          : "Read CLAUDE.md first. Then spec.md before you write any code."
      }
    >
      <div className="flex justify-end mb-4">
        <button
          type="button"
          onClick={downloadZip}
          className="bg-[var(--color-accent)] text-white px-4 py-2 rounded-[3px] font-mono text-[11px] uppercase tracking-[0.1em] font-medium hover:bg-[var(--color-accent-warm)] transition-colors cursor-pointer"
        >
          Download all (.zip) ↓
        </button>
      </div>
      <div className="flex flex-col gap-2">
        {FILE_ORDER.map((name) => (
          <FileCard
            key={name}
            name={name}
            content={files[name]}
            blurb={FILE_BLURB[name]}
            isOpen={openFile === name}
            onToggle={() => setOpenFile(openFile === name ? null : name)}
          />
        ))}
      </div>
    </Frame>
  );
}

function Frame({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      className="mt-8 px-6 py-5 rounded-md"
      style={{
        background: "rgba(63, 179, 105, 0.05)",
        border: "1px solid rgba(63, 179, 105, 0.25)",
      }}
    >
      <div className="font-mono text-[11px] uppercase tracking-[0.12em] text-[var(--color-keep-bright)] mb-1.5">
        Output files · KEEP
      </div>
      <div className="font-display font-bold text-[22px] leading-[1.2] tracking-[-0.02em] text-[var(--color-ink)] mb-1">
        {title}
      </div>
      {subtitle && (
        <div className="text-[13px] text-[var(--color-ink-soft)] mb-4">{subtitle}</div>
      )}
      {children}
    </div>
  );
}

function FileCard({
  name,
  content,
  blurb,
  isOpen,
  onToggle,
}: {
  name: string;
  content: string;
  blurb: string;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  return (
    <div
      className="rounded-[3px] overflow-hidden"
      style={{
        background: "var(--color-terminal-bg)",
        border: "1px solid var(--color-terminal-border)",
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center justify-between gap-3 cursor-pointer hover:bg-white/[0.02] transition-colors text-left"
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="font-mono text-[11px] text-[var(--color-terminal-faint)]">
            {isOpen ? "▾" : "▸"}
          </span>
          <span className="font-mono text-[13px] text-[var(--color-terminal-text)] font-medium">
            {name}
          </span>
          <span className="font-mono text-[11.5px] text-[var(--color-terminal-faint)] truncate">
            {blurb}
          </span>
        </div>
        <span
          onClick={copy}
          className="flex-shrink-0 bg-transparent border border-[var(--color-terminal-border)] text-[var(--color-terminal-text)] px-3 py-1 rounded-[3px] font-mono text-[10.5px] uppercase tracking-[0.1em] hover:border-[var(--color-accent-warm)] hover:text-[var(--color-accent-warm)]"
          role="button"
        >
          {copied ? "copied ✓" : "copy"}
        </span>
      </button>
      {isOpen && (
        <pre
          className="px-4 py-4 m-0 font-mono text-[12px] leading-[1.6] text-[var(--color-terminal-text)] overflow-x-auto whitespace-pre-wrap break-words"
          style={{
            borderTop: "1px solid var(--color-terminal-border)",
            background: "rgba(0,0,0,0.15)",
            maxHeight: "560px",
            overflowY: "auto",
          }}
        >
          {content}
        </pre>
      )}
    </div>
  );
}
