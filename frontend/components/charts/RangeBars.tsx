"use client";

import { useState } from "react";
import { VALUE_FORMATS, type ValueFormat } from "@/lib/format";
import { colors } from "@/lib/theme";
import { SrTable, TooltipBox } from "./Tooltip";

export interface RangeRow {
  label: string;
  /** The marker (e.g. a median or an average). null = not available. */
  value: number | null;
  /** Optional band, e.g. 25th to 75th percentile. */
  low?: number | null;
  high?: number | null;
}

/**
 * One row per group on a shared horizontal scale: an optional band (low–high) and a dot
 * for the value. Dots do not imply a zero baseline, so a narrow scale (e.g. ratings 3–5)
 * is honest here, and the scale is printed under the rows.
 */
export function RangeBars({
  rows,
  caption,
  domain,
  format,
  valueLabel,
  bandLabel,
  steps = 4,
}: {
  rows: RangeRow[];
  caption: string;
  domain: [number, number];
  format: ValueFormat;
  valueLabel: string;
  bandLabel?: string;
  /** Number of intervals between scale labels (choose one that gives round values). */
  steps?: number;
}) {
  const [active, setActive] = useState<number | null>(null);
  const f = VALUE_FORMATS[format];
  const [lo, hi] = domain;
  const pos = (v: number) => `${Math.min(100, Math.max(0, ((v - lo) / (hi - lo)) * 100))}%`;
  const ticks = Array.from({ length: steps + 1 }, (_, i) => lo + (i / steps) * (hi - lo));

  return (
    <>
      <ul aria-hidden className="space-y-2.5">
        {rows.map((r, i) => (
          <li
            key={r.label}
            tabIndex={0}
            onMouseEnter={() => setActive(i)}
            onMouseLeave={() => setActive(null)}
            onFocus={() => setActive(i)}
            onBlur={() => setActive(null)}
            className="relative grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)_3.5rem] items-center gap-3 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-burgundy"
          >
            <span className="truncate text-sm text-charcoal" title={r.label}>
              {r.label}
            </span>
            <span className="relative h-4">
              <span className="absolute inset-x-0 top-1/2 h-px bg-line" />
              {r.low != null && r.high != null && (
                <span
                  className="absolute top-1/2 h-2 -translate-y-1/2 rounded-full"
                  style={{ left: pos(r.low), width: `calc(${pos(r.high)} - ${pos(r.low)})`, background: colors.rose, opacity: active === null || active === i ? 1 : 0.5 }}
                />
              )}
              {r.value !== null && (
                <span
                  className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white"
                  style={{ left: pos(r.value), background: colors.burgundy }}
                />
              )}
            </span>
            <span className="text-right text-xs font-medium tabular-nums text-charcoal">{r.value === null ? "—" : f(r.value)}</span>
            {active === i && (
              <span className="pointer-events-none absolute right-16 top-full z-10 mt-1">
                <TooltipBox
                  title={r.label}
                  rows={[
                    { label: valueLabel, value: r.value === null ? "Not available" : f(r.value) },
                    ...(bandLabel && r.low != null && r.high != null ? [{ label: bandLabel, value: `${f(r.low)} – ${f(r.high)}` }] : []),
                  ]}
                />
              </span>
            )}
          </li>
        ))}
      </ul>
      <div aria-hidden className="mt-2 grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)_3.5rem] gap-3 text-[11px] text-muted">
        <span />
        <span className="relative h-4">
          {ticks.map((t) => (
            <span key={t} className="absolute -translate-x-1/2 tabular-nums" style={{ left: pos(t) }}>
              {f(t)}
            </span>
          ))}
        </span>
        <span />
      </div>
      <SrTable
        caption={caption}
        head={["Group", valueLabel, ...(bandLabel ? [bandLabel] : [])]}
        rows={rows.map((r) => [
          r.label,
          r.value === null ? "Not available" : f(r.value),
          ...(bandLabel ? [r.low != null && r.high != null ? `${f(r.low)} – ${f(r.high)}` : "Not available"] : []),
        ])}
      />
    </>
  );
}
