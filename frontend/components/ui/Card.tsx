import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { CircleAlert, SearchX } from "lucide-react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <section className={`min-w-0 rounded-2xl border border-line bg-white p-5 shadow-card sm:p-6 ${className}`}>
      {children}
    </section>
  );
}

interface ChartCardProps {
  title: string;
  /** One short sentence: the takeaway, computed from the data. */
  insight?: ReactNode;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}

export function ChartCard({ title, insight, action, className = "", children }: ChartCardProps) {
  return (
    <Card className={`flex flex-col ${className}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-charcoal">{title}</h2>
          {insight && <p className="mt-1 text-sm text-muted">{insight}</p>}
        </div>
        {action}
      </div>
      <div className="mt-5 min-w-0 flex-1">{children}</div>
    </Card>
  );
}

interface KpiCardProps {
  label: string;
  value: string;
  note?: string;
  icon: LucideIcon;
  accent?: boolean;
}

export function KpiCard({ label, value, note, icon: Icon, accent = false }: KpiCardProps) {
  return (
    <Card className={accent ? "bg-gradient-to-br from-white to-blush/70" : ""}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-muted">{label}</p>
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-blush text-burgundy">
          <Icon aria-hidden className="h-5 w-5" strokeWidth={1.75} />
        </span>
      </div>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-charcoal sm:text-4xl">{value}</p>
      {note && <p className="mt-2 text-xs text-muted">{note}</p>}
    </Card>
  );
}

export function EmptyState({ message = "No data matches these filters." }: { message?: string }) {
  return (
    <div className="flex min-h-48 flex-col items-center justify-center gap-2 rounded-xl bg-surface px-6 py-10 text-center">
      <SearchX aria-hidden className="h-6 w-6 text-muted" strokeWidth={1.5} />
      <p className="text-sm text-muted">{message}</p>
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="flex min-h-48 flex-col items-center justify-center gap-2 rounded-xl border border-line px-6 py-10 text-center"
    >
      <CircleAlert aria-hidden className="h-6 w-6 text-burgundy" strokeWidth={1.5} />
      <p className="text-sm font-medium text-charcoal">This section could not be loaded</p>
      <p className="max-w-sm text-xs text-muted">{message}</p>
    </div>
  );
}

export function PageHeader({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <header className="mb-8">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-burgundy">{eyebrow}</p>
      <h1 className="mt-2 font-display text-3xl text-charcoal sm:text-4xl">{title}</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted sm:text-base">{description}</p>
    </header>
  );
}
