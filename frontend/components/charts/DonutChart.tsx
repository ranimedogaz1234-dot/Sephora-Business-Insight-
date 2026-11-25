"use client";

import { useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { formatCompact, formatInteger, formatPercent } from "@/lib/format";
import { TooltipBox, SrTable } from "./Tooltip";

export interface Slice {
  label: string;
  value: number;
  color: string;
  /** Extra tooltip line, e.g. which categories were folded into "Other". */
  detail?: string;
}

interface DonutChartProps {
  slices: Slice[];
  centerLabel: string;
  unit: string;
  caption: string;
}

function DonutTooltip({ active, payload, total, unit }: { active?: boolean; payload?: { payload: Slice }[]; total: number; unit: string }) {
  if (!active || !payload?.length) return null;
  const s = payload[0].payload;
  return (
    <TooltipBox
      title={s.label}
      rows={[
        { label: unit, value: formatInteger(s.value) },
        { label: "Share", value: formatPercent(s.value / total) },
        ...(s.detail ? [{ label: "Includes", value: s.detail }] : []),
      ]}
    />
  );
}

/** Donut with the total in the centre and a labelled legend (values never depend on colour alone). */
export function DonutChart({ slices, centerLabel, unit, caption }: DonutChartProps) {
  const [active, setActive] = useState<number | null>(null);
  const total = slices.reduce((a, s) => a + s.value, 0);

  return (
    // Layout follows the card's width (container query), not the screen's.
    <div className="@container">
    <div className="grid items-center gap-6 @md:grid-cols-[220px_minmax(0,1fr)]">
      <div className="relative mx-auto h-[220px] w-[220px]" role="img" aria-label={caption}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={slices}
              dataKey="value"
              nameKey="label"
              innerRadius={70}
              outerRadius={104}
              paddingAngle={1.5}
              stroke="#fff"
              strokeWidth={2}
              cornerRadius={4}
              isAnimationActive={false}
              onMouseEnter={(_, i) => setActive(i)}
              onMouseLeave={() => setActive(null)}
            >
              {slices.map((s, i) => (
                <Cell key={s.label} fill={s.color} opacity={active === null || active === i ? 1 : 0.45} />
              ))}
            </Pie>
            <Tooltip content={<DonutTooltip total={total} unit={unit} />} isAnimationActive={false} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-semibold text-charcoal">{formatCompact(total)}</span>
          <span className="text-xs text-muted">{centerLabel}</span>
        </div>
      </div>

      <ul className="space-y-2.5">
        {slices.map((s, i) => (
          <li
            key={s.label}
            onMouseEnter={() => setActive(i)}
            onMouseLeave={() => setActive(null)}
            className={`flex items-center gap-3 rounded-lg px-2 py-1 text-sm transition-colors ${active === i ? "bg-blush" : ""}`}
          >
            <span aria-hidden className="h-3 w-3 shrink-0 rounded-full" style={{ background: s.color }} />
            <span className="min-w-0 flex-1 truncate text-charcoal" title={s.detail}>
              {s.label}
            </span>
            <span className="tabular-nums text-muted">{formatInteger(s.value)}</span>
            <span className="w-14 text-right font-medium tabular-nums text-charcoal">{formatPercent(s.value / total)}</span>
          </li>
        ))}
      </ul>
      <SrTable
        caption={caption}
        head={["Segment", unit, "Share"]}
        rows={slices.map((s) => [s.label, s.value, formatPercent(s.value / total)])}
      />
    </div>
    </div>
  );
}
