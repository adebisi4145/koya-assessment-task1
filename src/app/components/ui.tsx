import type { ReactNode } from "react";

// Small shared primitives so buttons, cards and notices look the same everywhere.

export const buttonPrimary =
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full bg-fg px-6 py-3 font-medium text-bg transition-transform duration-200 hover:-translate-y-px active:translate-y-px disabled:pointer-events-none disabled:opacity-50";

export const buttonSecondary =
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full border border-line bg-card px-5 py-2.5 text-sm font-medium transition-colors hover:border-fg/30 disabled:pointer-events-none disabled:opacity-50";

export const inputClass =
  "w-full rounded-lg border border-line bg-card px-3.5 py-2.5 text-fg placeholder:text-muted/70 focus:border-accent focus:outline-none focus-visible:outline-2 focus-visible:outline-accent";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-line bg-card p-5 sm:p-6 ${className}`}>
      {children}
    </div>
  );
}

export function ErrorNotice({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="rounded-lg bg-danger-soft px-4 py-3 text-sm text-danger">
      {children}
    </p>
  );
}

export function AvailableDot() {
  return (
    <span aria-hidden className="relative flex size-2.5">
      <span className="absolute inline-flex size-full animate-ping rounded-full bg-accent opacity-60" />
      <span className="relative inline-flex size-2.5 rounded-full bg-accent" />
    </span>
  );
}

export function StatusBadge({ status }: { status: "confirmed" | "cancelled" }) {
  return status === "confirmed" ? (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1 text-sm font-medium text-accent">
      <svg viewBox="0 0 20 20" className="size-4" fill="currentColor" aria-hidden>
        <path
          fillRule="evenodd"
          d="M16.7 5.3a1 1 0 0 1 0 1.4l-8 8a1 1 0 0 1-1.4 0l-4-4a1 1 0 1 1 1.4-1.4L8 12.6l7.3-7.3a1 1 0 0 1 1.4 0Z"
          clipRule="evenodd"
        />
      </svg>
      Confirmed
    </span>
  ) : (
    <span className="inline-flex items-center rounded-full border border-line px-3 py-1 text-sm font-medium text-muted">
      Cancelled
    </span>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`animate-pulse rounded-lg bg-line/60 ${className}`} />;
}
