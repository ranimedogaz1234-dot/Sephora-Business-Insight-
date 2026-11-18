"use client";

import { useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { TrendPoint } from "@/lib/api";
import { formatCompact, formatInteger, formatPeriod, formatRating } from "@/lib/format";
import { axis, colors } from "@/lib/theme";
import { TooltipBox, SrTable } from "./Tooltip";

function TrendTooltip({ active, payload }: { active?: boolean; payload?: { payload: TrendPoint }[] }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <TooltipBox
      title={formatPeriod(p.period)}
      rows={[
        { label: "Reviews", value: formatInteger(p.review_count) },
        { label: "Average rating", value: p.average_rating === null ? "—" : `★ ${formatRating(p.average_rating)}` },
      ]}
    />
  );
}

/** Long monthly series are labelled by year only (on each January). */
export function yearTicks(points: TrendPoint[]): string[] | undefined {
  if (points.length <= 24 || !points[0]?.period.includes("-")) return undefined;
  const januaries = points.filter((p) => p.period.endsWith("-01")).map((p) => p.period);
  const step = januaries.length > 8 ? 2 : 1;
  return januaries.filter((_, i) => i % step === 0);
}

interface TrendChartProps {
  /** One or more series the viewer can switch between (e.g. monthly and yearly). */
  series: { key: string; label: string; points: TrendPoint[] }[];
  height?: number;
}

export function TrendChart({ series, height = 280 }: TrendChartProps) {
  const [key, setKey] = useState(series[0]?.key);
  const current = series.find((s) => s.key === key) ?? series[0];
  const points = current?.points ?? [];
  const ticks = yearTicks(points);
  const tickFormat = (p: string) => (ticks ? p.slice(0, 4) : formatPeriod(p));

  return (
    <div>
      {series.length > 1 && (
        <div role="group" aria-label="Time scale" className="mb-4 inline-flex rounded-full bg-surface p-1">
          {series.map((s) => (
            <button
              key={s.key}
              type="button"
              aria-pressed={s.key === current?.key}
              onClick={() => setKey(s.key)}
              className={`h-8 rounded-full px-4 text-xs font-medium transition-colors ${
                s.key === current?.key ? "bg-white text-burgundy shadow-card" : "text-muted hover:text-charcoal"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}
      <div style={{ height }} role="img" aria-label={`Area chart of reviews per period (${current?.label ?? ""})`}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={colors.burgundy} stopOpacity={0.18} />
                <stop offset="100%" stopColor={colors.burgundy} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={colors.grid} vertical={false} />
            <XAxis dataKey="period" ticks={ticks} tickFormatter={tickFormat} minTickGap={20} {...axis} />
            <YAxis tickFormatter={formatCompact} width={48} {...axis} />
            <Tooltip content={<TrendTooltip />} cursor={{ stroke: colors.muted, strokeWidth: 1 }} isAnimationActive={false} />
            <Area
              type="monotone"
              dataKey="review_count"
              stroke={colors.burgundy}
              strokeWidth={2}
              fill="url(#trendFill)"
              activeDot={{ r: 5, fill: colors.burgundy, stroke: "#fff", strokeWidth: 2 }}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <SrTable
        caption={`Reviews per period (${current?.label ?? ""})`}
        head={["Period", "Reviews", "Average rating"]}
        rows={points.map((p) => [p.period, p.review_count, p.average_rating === null ? "—" : formatRating(p.average_rating)])}
      />
    </div>
  );
}
