import type { ReactNode } from "react";

/** Card-styled data table that scrolls inside its own card on small screens. */
export function DataTable({
  caption,
  minWidth = 720,
  children,
}: {
  caption: string;
  minWidth?: number;
  children: ReactNode;
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-white shadow-card">
      <table className="w-full text-sm" style={{ minWidth }}>
        <caption className="sr-only">{caption}</caption>
        {children}
      </table>
    </div>
  );
}

export function Th({ children, align = "left" }: { children?: ReactNode; align?: "left" | "right" }) {
  return (
    <th
      scope="col"
      className={`bg-blush/60 px-5 py-3 text-xs font-semibold uppercase tracking-wider text-burgundy ${align === "right" ? "text-right" : "text-left"}`}
    >
      {children}
    </th>
  );
}

export function Td({ children, align = "left", className = "" }: { children?: ReactNode; align?: "left" | "right"; className?: string }) {
  return (
    <td className={`px-5 py-3.5 ${align === "right" ? "text-right tabular-nums text-charcoal" : ""} ${className}`}>{children}</td>
  );
}

/** Em dash for a value the data does not provide (never shown as 0). */
export function Missing({ label = "Not available" }: { label?: string }) {
  return (
    <span className="text-muted" title={label}>
      —<span className="sr-only">{label}</span>
    </span>
  );
}
