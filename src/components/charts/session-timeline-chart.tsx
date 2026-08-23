"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { TOKEN_SERIES } from "@/lib/colors";
import { fmtCompact } from "@/lib/format";

export interface SessionEventPoint {
  ts: string;
  input_tokens: number;
  cache_read_tokens: number;
  output_tokens: number;
  reasoning_tokens: number;
}

const config: ChartConfig = Object.fromEntries(
  TOKEN_SERIES.map((s) => [s.key, { label: s.label, color: s.color }])
) as ChartConfig;

function labelFor(ts: string, index: number, multiDay: boolean): string {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return String(index + 1);
  const day = d.toISOString().slice(5, 10).replace("-", "/");
  const time = d.toISOString().slice(11, 16);
  return multiDay ? `${day} ${time}` : time;
}

/** Stacked per-request token usage across a single session, chronological. */
export function SessionTimelineChart({ data }: { data: SessionEventPoint[] }) {
  if (!data.length) return null;
  const days = new Set(data.map((d) => d.ts.slice(0, 10)));
  const multiDay = days.size > 1;

  return (
    <ChartContainer config={config} className="h-64 w-full">
      <BarChart data={data} margin={{ left: 4, right: 8 }}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="ts"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={32}
          tickFormatter={(v: string, i: number) => labelFor(v, i, multiDay)}
          fontSize={11}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={52}
          tickFormatter={(v: number) => fmtCompact(v)}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              labelFormatter={(l) => new Date(String(l)).toLocaleString()}
            />
          }
        />
        <ChartLegend content={<ChartLegendContent />} />
        {TOKEN_SERIES.map((s) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            stackId="tokens"
            fill={s.color}
            radius={s.key === "reasoning_tokens" ? [3, 3, 0, 0] : undefined}
            maxBarSize={28}
          />
        ))}
      </BarChart>
    </ChartContainer>
  );
}
