"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatMoneyCompact } from "@/lib/format";

export interface TrendPoint {
  month: string;
  [series: string]: string | number;
}

interface SeriesDef {
  key: string;
  label: string;
  color: string;
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; stroke?: string; fill?: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-[12px] shadow-md">
      <p className="mb-1 font-semibold">{label}</p>
      {payload.map((entry) => (
        <p
          key={entry.name}
          className="flex items-center gap-2 text-muted-foreground"
        >
          <span
            className="size-2 rounded-full"
            style={{ background: entry.stroke ?? entry.fill }}
            aria-hidden
          />
          <span>{entry.name}:</span>
          <span className="tnum font-semibold text-foreground">
            {formatMoneyCompact(Number(entry.value))}
          </span>
        </p>
      ))}
    </div>
  );
}

/**
 * Area trend chart matching the QuickRecon dashboard language:
 * blue family, thin dashed grid, minimal axes, subtle fills.
 */
export function TrendChart({
  data,
  series,
  height = 260,
}: {
  data: TrendPoint[];
  series: SeriesDef[];
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -6 }}>
        <CartesianGrid strokeDasharray="3 4" className="stroke-border" vertical={false} />
        <XAxis
          dataKey="month"
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 11 }}
          className="fill-muted-foreground"
          dy={6}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 11 }}
          className="fill-muted-foreground"
          tickFormatter={(v: number) => formatMoneyCompact(v)}
          width={42}
        />
        <Tooltip content={<ChartTooltip />} cursor={{ stroke: "var(--border)" }} />
        {series.map((s, idx) => (
          <Area
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.label}
            stroke={s.color}
            strokeWidth={2.2}
            fill={s.color}
            fillOpacity={idx === 0 ? 0.1 : 0.06}
            dot={{ r: 2.6, fill: s.color, strokeWidth: 0 }}
            activeDot={{ r: 4 }}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}

/** Rounded-corner bars for compact admin volume charts. */
export function BarsChart({
  data,
  series,
  height = 220,
  stacked = false,
}: {
  data: TrendPoint[];
  series: SeriesDef[];
  height?: number;
  stacked?: boolean;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -6 }} barGap={series.length > 1 ? 3 : undefined}>
        <CartesianGrid strokeDasharray="3 4" className="stroke-border" vertical={false} />
        <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} className="fill-muted-foreground" dy={6} />
        <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11 }} className="fill-muted-foreground" tickFormatter={(v: number) => formatMoneyCompact(v)} width={42} />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(37,99,235,0.06)" }} />
        {series.map((s) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            name={s.label}
            fill={s.color}
            stackId={stacked ? "total" : undefined}
            radius={stacked ? 0 : [4, 4, 0, 0]}
            maxBarSize={series.length > 1 ? 14 : 22}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
