import type { ReactNode } from "react";

export type CardStatus = "live" | "building" | "idea";

const statusStyles: Record<CardStatus, string> = {
  live: "bg-emerald-400/15 text-emerald-300 ring-emerald-400/30",
  building: "bg-amber-400/15 text-amber-300 ring-amber-400/30",
  idea: "bg-slate-400/15 text-slate-300 ring-slate-400/30",
};

const statusLabels: Record<CardStatus, string> = {
  live: "Live",
  building: "Building",
  idea: "Idea",
};

export type CardProps = {
  title: string;
  tagline?: string;
  description?: string;
  status?: CardStatus;
  href?: string;
  children?: ReactNode;
  className?: string;
};

export function Card({
  title,
  tagline,
  description,
  status = "idea",
  href,
  children,
  className = "",
}: CardProps) {
  const inner = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold tracking-tight text-white">
            {title}
          </h3>
          {tagline ? (
            <p className="mt-0.5 text-sm text-slate-400">{tagline}</p>
          ) : null}
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${statusStyles[status]}`}
        >
          {statusLabels[status]}
        </span>
      </div>
      {description ? (
        <p className="mt-3 text-sm leading-relaxed text-slate-300">
          {description}
        </p>
      ) : null}
      {children}
    </>
  );

  const classes = `group block rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur transition hover:border-white/20 hover:bg-white/10 ${className}`;

  if (href) {
    return (
      <a href={href} className={classes}>
        {inner}
        <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-sky-300 transition group-hover:gap-2">
          Open experiment <span aria-hidden="true">→</span>
        </span>
      </a>
    );
  }
  return <div className={classes}>{inner}</div>;
}
