"use client";

import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { RatingBucket } from "@/lib/api";
import { formatCompact, formatInteger, formatPercent } from "@/lib/format";
import { axis, colors } from "@/lib/theme";
import { TooltipBox, SrTable } from "./Tooltip";

interface Row extends RatingBucket {
  label: string;
}

function RatingTooltip({ active, payload }: { active?: boolean; payload?: { payload: Row }[] }) {
  if (!active || !payload?.length) return null;
  const r = payload[0].payload;
  return (
    <TooltipBox
      title={r.label}
      rows={[
        { label: "Reviews", value: formatInteger(r.count) },
        { label: "Share", value: formatPercent(r.share) },
      ]}
    />
  );
}

/** Reviews per star rating, with each bar's share printed above it. */
export function RatingBars({ buckets }: { buckets: RatingBucket[] }) {
  const rows: Row[] = buckets.map((b) => ({ ...b, label: `${b.rating} ★` }));
  return (
    <>
      <div className="h-[260px]" role="img" aria-label="Column chart of reviews per star rating">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 24, right: 4, bottom: 0, left: 0 }} barCategoryGap="30%">
            <CartesianGrid stroke={colors.grid} vertical={false} />
            <XAxis dataKey="label" {...axis} />
            <YAxis tickFormatter={formatCompact} width={48} {...axis} />
            <Tooltip content={<RatingTooltip />} cursor={{ fill: colors.blush }} isAnimationActive={false} />
            <Bar dataKey="count" fill={colors.burgundy} radius={[4, 4, 0, 0]} maxBarSize={44} isAnimationActive={false}>
              <LabelList
                dataKey="share"
                position="top"
                formatter={(v: unknown) => formatPercent(Number(v), 0)}
                style={{ fill: colors.muted, fontSize: 12 }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <SrTable
        caption="Reviews per star rating"
        head={["Rating", "Reviews", "Share"]}
        rows={rows.map((r) => [r.label, r.count, formatPercent(r.share)])}
      />
    </>
  );
}
