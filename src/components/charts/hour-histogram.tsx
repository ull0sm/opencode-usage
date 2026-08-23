"use client";

import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { EmptyState } from "@/components/dashboard/empty-state";
import { cn } from "@/lib/utils";
import { fmtCompact, fmtInt } from "@/lib/format";
import type { HourBucket } from "@/lib/types";

type Metric = "tokens" | "requests";

const config = {
  tokens: { label: "Tokens", color: "#60a5fa" },
  requests: { label: "Requests", color: "#34d399" },
} satisfies ChartConfig;

const HOURS = Array.from({ length: 24 }, (_, h) => String(h).padStart(2, "0"));

function label(hour: number): string {
  const h = hour % 12 === 0 ? 12 : hour % 12;
  return `${h}${hour < 12 ? "am" : "pm"}`;
}

/** Request counts / token volume aggregated by UTC hour of day (00–23). */
export function HourHistogram({ data }: { data: HourBucket[] }) {
  const [metric, setMetric] = useState<Metric>("tokens");

  const chartData = useMemo(() => {
    const byHour = new Map(data.map((d) => [d.hour, d]));
    return HOURS.map((hour) => ({
      hour,
      requests: byHour.get(hour)?.requests ?? 0,
      tokens: byHour.get(hour)?.tokens ?? 0,
    }));
  }, [data]);

  const totalRequests = chartData.reduce((a, d) => a + d.requests, 0);
  if (totalRequests === 0) {
    return <EmptyState className="py-16" />;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-end">
        <div className="inline-flex rounded-md border p-0.5 text-xs">
          {(Object.keys(config) as Metric[]).map((m) => (
            <button
              key={m}
              onClick={() => setMetric(m)}
              className={cn(
                "rounded px-2 py-1 transition-colors",
                metric === m
                  ? "bg-accent font-medium text-accent-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {config[m].label}
            </button>
          ))}
        </div>
      </div>

      <ChartContainer config={config} className="h-56 w-full">
        <BarChart data={chartData} margin={{ left: 4, right: 8 }}>
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="hour"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            interval={2}
            tickFormatter={(v: string) => label(Number(v))}
            fontSize={11}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={44}
            tickFormatter={(v: number) => fmtCompact(v)}
          />
          <ChartTooltip
            content={
              <ChartTooltipContent
                labelFormatter={(l) => `${label(Number(l))} (UTC)`}
              />
            }
          />
          <Bar dataKey={metric} fill={config[metric].color} radius={[3, 3, 0, 0]} maxBarSize={24} />
        </BarChart>
      </ChartContainer>

      <p className="text-xs text-muted-foreground">
        Peak hour:{" "}
        {(() => {
          const peak = chartData.reduce((a, b) => (b[metric] > a[metric] ? b : a));
          return `${label(Number(peak.hour))} — ${fmtInt(peak.requests)} req · ${fmtCompact(peak.tokens)} tokens`;
        })()}
      </p>
    </div>
  );
}
