"use client";

import { CartesianGrid, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from "recharts";
import { VALUE_FORMATS, type ValueFormat } from "@/lib/format";
import { axis, colors } from "@/lib/theme";
import { SrTable, TooltipBox } from "./Tooltip";

export interface Point {
  label: string;
  x: number;
  y: number;
  /** Optional third value shown in the tooltip (e.g. number of products). */
  size?: number;
}

interface ScatterPlotProps {
  points: Point[];
  caption: string;
  xLabel: string;
  yLabel: string;
  xFormat: ValueFormat;
  yFormat: ValueFormat;
  sizeLabel?: string;
  /** Log scale for skewed values such as prices. */
  logX?: boolean;
  yDomain?: [number, number];
  height?: number;
  /** Optional dashed split lines, e.g. the medians that define quadrants. */
  xSplit?: number;
  ySplit?: number;
}

const LOG_TICKS = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10_000, 20_000, 50_000, 100_000, 200_000, 500_000];

function PointTooltip({
  active,
  payload,
  xLabel,
  yLabel,
  sizeLabel,
  xFormat,
  yFormat,
}: {
  active?: boolean;
  payload?: { payload: Point }[];
  xLabel: string;
  yLabel: string;
  sizeLabel?: string;
  xFormat: ValueFormat;
  yFormat: ValueFormat;
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <TooltipBox
      title={p.label}
      rows={[
        { label: xLabel, value: VALUE_FORMATS[xFormat](p.x) },
        { label: yLabel, value: VALUE_FORMATS[yFormat](p.y) },
        ...(sizeLabel && p.size !== undefined ? [{ label: sizeLabel, value: VALUE_FORMATS.integer(p.size) }] : []),
      ]}
    />
  );
}

/** One series of points: hover shows the item, a hidden table lists every point. */
export function ScatterPlot({
  points,
  caption,
  xLabel,
  yLabel,
  xFormat,
  yFormat,
  sizeLabel,
  logX = false,
  yDomain,
  height = 320,
  xSplit,
  ySplit,
}: ScatterPlotProps) {
  const fx = VALUE_FORMATS[xFormat];
  const fy = VALUE_FORMATS[yFormat];
  // Recharts picks few ticks on a log axis; use round values within the data's range.
  const xs = points.map((p) => p.x);
  const logTicks = logX && xs.length
    ? LOG_TICKS.filter((t) => t >= Math.min(...xs) * 0.8 && t <= Math.max(...xs) * 1.25)
    : undefined;
  return (
    <>
      <div style={{ height }} role="img" aria-label={caption}>
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 8, right: 16, bottom: 24, left: 0 }}>
            <CartesianGrid stroke={colors.grid} />
            <XAxis
              type="number"
              dataKey="x"
              name={xLabel}
              scale={logX ? "log" : "auto"}
              ticks={logTicks}
              domain={logX ? ["auto", "auto"] : [0, "auto"]}
              tickFormatter={(v: number) => fx(v)}
              label={{ value: xLabel, position: "insideBottom", offset: -16, fill: colors.muted, fontSize: 12 }}
              {...axis}
            />
            <YAxis
              type="number"
              dataKey="y"
              name={yLabel}
              domain={yDomain ?? ["auto", "auto"]}
              tickFormatter={(v: number) => fy(v)}
              width={48}
              {...axis}
            />
            <ZAxis range={[56, 56]} />
            {xSplit !== undefined && <ReferenceLine x={xSplit} stroke={colors.muted} strokeDasharray="4 4" />}
            {ySplit !== undefined && <ReferenceLine y={ySplit} stroke={colors.muted} strokeDasharray="4 4" />}
            <Tooltip content={<PointTooltip xLabel={xLabel} yLabel={yLabel} sizeLabel={sizeLabel} xFormat={xFormat} yFormat={yFormat} />} cursor={{ stroke: colors.muted, strokeDasharray: "3 3" }} isAnimationActive={false} />
            <Scatter data={points} fill={colors.burgundy} fillOpacity={0.55} stroke="#fff" strokeWidth={1} isAnimationActive={false} />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
      <SrTable
        caption={caption}
        head={["Item", xLabel, yLabel, ...(sizeLabel ? [sizeLabel] : [])]}
        rows={points.map((p) => [p.label, fx(p.x), fy(p.y), ...(sizeLabel ? [p.size ?? ""] : [])])}
      />
    </>
  );
}
