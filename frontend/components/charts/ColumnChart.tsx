"use client";

import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { VALUE_FORMATS, type ValueFormat } from "@/lib/format";
import { axis, colors } from "@/lib/theme";
import { TooltipBox, SrTable } from "./Tooltip";

export interface Column {
  label: string;
  /** null = not available (drawn as a gap, never as 0). */
  value: number | null;
  /** Optional per-bar colour (e.g. an ordered ramp); defaults to one hue. */
  color?: string;
  /** Extra tooltip rows, e.g. the sample size behind a rate. */
  details?: { label: string; value: string }[];
}

interface ColumnChartProps {
  data: Column[];
  caption: string;
  unit: string;
  format: ValueFormat;
  height?: number;
  /** Print each bar's value above it (use for few bars only). */
  labels?: boolean;
  domain?: [number, number];
  color?: string;
}

function ColumnTooltip({
  active,
  payload,
  unit,
  format,
}: {
  active?: boolean;
  payload?: { payload: Column }[];
  unit: string;
  format: (v: number) => string;
}) {
  if (!active || !payload?.length) return null;
  const c = payload[0].payload;
  return (
    <TooltipBox
      title={c.label}
      rows={[{ label: unit, value: c.value === null ? "Not available" : format(c.value) }, ...(c.details ?? [])]}
    />
  );
}

/** Single-measure vertical bars with a hover tooltip and a screen-reader table. */
export function ColumnChart({
  data,
  caption,
  unit,
  format: formatName,
  height = 260,
  labels = true,
  domain,
  color = colors.burgundy,
}: ColumnChartProps) {
  const format = VALUE_FORMATS[formatName];
  return (
    <>
      <div style={{ height }} role="img" aria-label={caption}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: labels ? 24 : 8, right: 4, bottom: 0, left: 0 }} barCategoryGap="28%">
            <CartesianGrid stroke={colors.grid} vertical={false} />
            <XAxis dataKey="label" interval={0} {...axis} />
            <YAxis tickFormatter={(v: number) => format(v)} width={56} domain={domain} {...axis} />
            <Tooltip
              content={<ColumnTooltip unit={unit} format={format} />}
              cursor={{ fill: colors.blush }}
              isAnimationActive={false}
            />
            <Bar dataKey="value" fill={color} radius={[4, 4, 0, 0]} maxBarSize={48} isAnimationActive={false}>
              {data.map((d) => (
                <Cell key={d.label} fill={d.color ?? color} />
              ))}
              {labels && (
                <LabelList
                  dataKey="value"
                  position="top"
                  formatter={(v: unknown) => (v === null || v === undefined ? "" : format(Number(v)))}
                  style={{ fill: colors.muted, fontSize: 12 }}
                />
              )}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <SrTable
        caption={caption}
        head={["Group", unit, ...(data[0]?.details?.map((d) => d.label) ?? [])]}
        rows={data.map((d) => [d.label, d.value === null ? "Not available" : format(d.value), ...(d.details?.map((x) => x.value) ?? [])])}
      />
    </>
  );
}
