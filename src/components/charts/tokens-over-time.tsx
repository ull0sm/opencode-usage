"use client";

import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, ReferenceDot, XAxis, YAxis } from "recharts";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/dashboard/empty-state";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { TOKEN_SERIES } from "@/lib/colors";
import type { TimeseriesPoint } from "@/lib/types";

const config: ChartConfig = Object.fromEntries(
  TOKEN_SERIES.map((s) => [s.key, { label: s.label, color: s.color }])
) as ChartConfig;

const ANOMALY_COLOR = "#fbbf24";
const ANOMALY_WINDOW = 14;
const MIN_BASELINE_DAYS = 5;

export function totalTokens(p: TimeseriesPoint): number {
  return p.input_tokens + p.cache_read_tokens + p.output_tokens + p.reasoning_tokens;
}

/**
 * Days whose total exceeds the trailing 14-day rolling mean by more than
 * 2 standard deviations. Value is how many times the daily average it was.
 */
function findAnomalies(data: TimeseriesPoint[]): Map<string, number> {
  const out = new Map<string, number>();
  const totals = data.map(totalTokens);
  for (let i = 0; i < data.length; i++) {
    const window = totals.slice(Math.max(0, i - ANOMALY_WINDOW), i);
    if (window.length < Math.min(MIN_BASELINE_DAYS, i)) continue;
    const mean = window.reduce((a, b) => a + b, 0) / window.length;
    if (mean <= 0) continue;
    const sd = Math.sqrt(
      window.reduce((a, b) => a + (b - mean) ** 2, 0) / window.length
    );
    if (sd > 0 && totals[i] > mean + 2 * sd) {
      out.set(data[i].date, totals[i] / mean);
    }
  }
  return out;
}

type TooltipProps = React.ComponentProps<typeof ChartTooltipContent> & {
  anomalies?: Map<string, number>;
};

/** Default chart tooltip plus an anomaly line when hovering a flagged day. */
function AnomalyTooltipContent({ anomalies, ...rest }: TooltipProps) {
  const multiple =
    anomalies && typeof rest.label === "string" ? anomalies.get(rest.label) : undefined;
  return (
    <div>
      <ChartTooltipContent {...rest} />
      {multiple != null && (
        <div
          className="flex items-center gap-1 px-3 pb-1.5 text-xs font-medium"
          style={{ color: ANOMALY_COLOR }}
        >
          {multiple >= 10 ? Math.round(multiple) : multiple.toFixed(1)}× your daily average
        </div>
      )}
    </div>
  );
}

interface Props {
  data: TimeseriesPoint[];
  /** X values are daily dates (YYYY-MM-DD) or hourly labels ("HH:00"). */
  granularity?: "day" | "hour";
}

function hourLabel(v: string): string {
  const hour = Number(v.slice(0, 2));
  const h = hour % 12 === 0 ? 12 : hour % 12;
  return `${h}${hour < 12 ? "a" : "p"}`;
}

export function TokensOverTimeChart({ data, granularity = "day" }: Props) {
  const anomalies = useMemo(() => findAnomalies(data), [data]);

  if (!data.length) {
    return (
      <EmptyState
        description="Try widening the date range or clearing filters."
        actions={
          <>
            <Button variant="outline" size="sm" asChild>
              <Link href="/?preset=all">All time</Link>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/">Clear filters</Link>
            </Button>
          </>
        }
      />
    );
  }
  return (
    <div className="relative">
      <ChartContainer config={config} className="h-72 w-full">
        <BarChart data={data} margin={{ left: 4, right: 8, top: 12 }}>
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="date"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            minTickGap={24}
            tickFormatter={granularity === "hour" ? hourLabel : (v: string) => v.slice(5)}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={52}
            tickFormatter={(v: number) => Intl.NumberFormat("en-US", { notation: "compact" }).format(v)}
          />
          <ChartTooltip content={<AnomalyTooltipContent anomalies={anomalies} />} />
          <ChartLegend content={<ChartLegendContent />} />
          {TOKEN_SERIES.map((s) => (
            <Bar key={s.key} dataKey={s.key} stackId="tokens" fill={s.color} radius={s.key === "reasoning_tokens" ? [3, 3, 0, 0] : undefined} maxBarSize={40} />
          ))}
          {[...anomalies.keys()].map((date) => {
            const point = data.find((d) => d.date === date);
            if (!point) return null;
            return (
              <ReferenceDot
                key={date}
                x={date}
                y={totalTokens(point) * 1.02}
                r={4}
                fill={ANOMALY_COLOR}
                stroke="none"
                ifOverflow="extendDomain"
              />
            );
          })}
        </BarChart>
      </ChartContainer>
      {anomalies.size > 0 && (
        <p className="mt-1 flex items-center justify-end gap-1.5 text-xs text-muted-foreground">
          <span className="inline-block size-2 rounded-full" style={{ backgroundColor: ANOMALY_COLOR }} />
          spike &gt; 2σ above trailing 14-day average ({anomalies.size} day{anomalies.size === 1 ? "" : "s"})
        </p>
      )}
    </div>
  );
}
