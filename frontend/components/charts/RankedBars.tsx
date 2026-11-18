"use client";

import { useState } from "react";
import { formatCompact, formatInteger, formatRating } from "@/lib/format";
import { colors } from "@/lib/theme";
import { TooltipBox, SrTable } from "./Tooltip";

export interface RankedItem {
  label: string;
  sublabel: string;
  value: number;
  rating: number;
}

/**
 * Ranked horizontal bars built in HTML so long product names stay readable:
 * name and detail above each bar, value at its end, tooltip on hover or keyboard focus.
 */
export function RankedBars({
  items,
  color = colors.burgundy,
  unit = "Reviews",
  caption,
}: {
  items: RankedItem[];
  color?: string;
  unit?: string;
  caption: string;
}) {
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(1, ...items.map((i) => i.value));

  return (
    <>
      <ol aria-hidden className="space-y-3.5">
        {items.map((item, i) => (
          <li
            key={`${item.label}-${i}`}
            tabIndex={0}
            onMouseEnter={() => setActive(i)}
            onMouseLeave={() => setActive(null)}
            onFocus={() => setActive(i)}
            onBlur={() => setActive(null)}
            className="relative rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-burgundy"
          >
            <div className="flex items-baseline gap-3">
              <span className="w-5 shrink-0 text-right text-xs font-semibold tabular-nums text-muted">{i + 1}</span>
              <p className="min-w-0 flex-1 truncate text-sm text-charcoal" title={item.label}>
                {item.label}
                <span className="ml-2 text-xs text-muted">{item.sublabel}</span>
              </p>
            </div>
            <div className="mt-1.5 flex items-center gap-3 pl-8">
              <div className="h-2.5 flex-1 rounded-full bg-surface">
                <div
                  className="h-full rounded-full transition-opacity"
                  style={{
                    width: `${(item.value / max) * 100}%`,
                    background: color,
                    opacity: active === null || active === i ? 1 : 0.45,
                  }}
                />
              </div>
              <span className="w-12 shrink-0 text-right text-xs font-medium tabular-nums text-charcoal">
                {formatCompact(item.value)}
              </span>
            </div>
            {active === i && (
              <div className="pointer-events-none absolute right-14 top-full z-10 mt-1">
                <TooltipBox
                  title={item.label}
                  rows={[
                    { label: "Detail", value: item.sublabel },
                    { label: unit, value: formatInteger(item.value) },
                    { label: "Average rating", value: `★ ${formatRating(item.rating)}` },
                  ]}
                />
              </div>
            )}
          </li>
        ))}
      </ol>
      <SrTable
        caption={caption}
        head={["Rank", "Name", "Detail", unit, "Average rating"]}
        rows={items.map((i, n) => [n + 1, i.label, i.sublabel, i.value, formatRating(i.rating)])}
      />
    </>
  );
}
