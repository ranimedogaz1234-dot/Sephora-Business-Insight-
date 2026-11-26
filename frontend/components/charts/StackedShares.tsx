"use client";

import { useState } from "react";
import { formatInteger, formatPercent } from "@/lib/format";
import { SrTable, TooltipBox } from "./Tooltip";

export interface ShareRow {
  label: string;
  /** Shares of each segment (0–1), in the same order as `segments`. */
  shares: (number | null)[];
  /** Number of items behind the shares (shown in the tooltip). */
  total: number;
}

/**
 * 100% stacked horizontal bars: one row per group, one segment per ordered class (e.g.
 * 1★ -> 5★). Segments are separated by a 2px surface gap; a legend names every segment.
 */
export function StackedShares({
  rows,
  segments,
  caption,
  totalLabel,
}: {
  rows: ShareRow[];
  segments: { label: string; color: string }[];
  caption: string;
  totalLabel: string;
}) {
  const [active, setActive] = useState<number | null>(null);
  return (
    <>
      <ul aria-hidden className="mb-4 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted">
        {segments.map((s) => (
          <li key={s.label} className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />
            {s.label}
          </li>
        ))}
      </ul>
      <ul aria-hidden className="space-y-2.5">
        {rows.map((r, i) => (
          <li
            key={r.label}
            tabIndex={0}
            onMouseEnter={() => setActive(i)}
            onMouseLeave={() => setActive(null)}
            onFocus={() => setActive(i)}
            onBlur={() => setActive(null)}
            className="relative grid grid-cols-[minmax(0,8rem)_minmax(0,1fr)] items-center gap-3 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-burgundy"
          >
            <span className="truncate text-sm text-charcoal" title={r.label}>
              {r.label}
            </span>
            <span className="flex h-4 gap-[2px] overflow-hidden rounded">
              {r.shares.map((s, j) =>
                s ? <span key={j} style={{ width: `${s * 100}%`, background: segments[j].color }} className="first:rounded-l last:rounded-r" /> : null,
              )}
            </span>
            {active === i && (
              <span className="pointer-events-none absolute left-32 top-full z-10 mt-1">
                <TooltipBox
                  title={r.label}
                  rows={[
                    ...segments.map((s, j) => ({ label: s.label, value: r.shares[j] === null ? "—" : formatPercent(r.shares[j]!) })),
                    { label: totalLabel, value: formatInteger(r.total) },
                  ]}
                />
              </span>
            )}
          </li>
        ))}
      </ul>
      <SrTable
        caption={caption}
        head={["Group", ...segments.map((s) => s.label), totalLabel]}
        rows={rows.map((r) => [r.label, ...r.shares.map((s) => (s === null ? "—" : formatPercent(s))), r.total])}
      />
    </>
  );
}
