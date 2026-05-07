interface GateScreenProps {
  title: string;
  body: string;
  ctaLabel?: string;
  ctaHref?: string;
}

export function GateScreen({ title, body, ctaLabel, ctaHref }: GateScreenProps) {
  return (
    <div className="min-h-screen flex items-center justify-center px-8 py-16">
      <div className="max-w-[480px] text-center">
        <span className="inline-block px-3 py-[5px] mb-5 rounded-[2px] font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--color-accent)] bg-[rgba(221,51,0,0.1)] border border-[rgba(221,51,0,0.25)]">
          Kill Filter · Whop
        </span>
        <h1 className="font-display font-bold text-[clamp(28px,4vw,40px)] leading-[1.05] tracking-[-0.025em] text-[var(--color-ink)] mb-4">
          {title}
        </h1>
        <p className="text-[15px] leading-[1.5] text-[var(--color-ink-soft)] mb-7">{body}</p>
        {ctaLabel && ctaHref && (
          <a
            href={ctaHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block bg-[var(--color-accent)] text-white px-6 py-3 rounded-[3px] font-mono text-xs uppercase tracking-[0.1em] font-medium hover:bg-[var(--color-accent-warm)] transition-colors"
          >
            {ctaLabel}
          </a>
        )}
      </div>
    </div>
  );
}
