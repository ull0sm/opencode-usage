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
import { EmptyState } from "@/components/dashboard/empty-state";
import { TOKEN_SERIES } from "@/lib/colors";
import { fmtCompact, truncate } from "@/lib/format";

interface CompositionDatum {
  name: string;
  input_tokens: number;
  cache_read_tokens: number;
  output_tokens: number;
  reasoning_tokens: number;
}

const config: ChartConfig = Object.fromEntries(
  TOKEN_SERIES.map((s) => [s.key, { label: s.label, color: s.color }])
) as ChartConfig;

/**
 * Horizontal stacked bars showing token composition per entity (model / session).
 */
export function CompositionChart({
  data,
  labelWidth = 150,
}: {
  data: CompositionDatum[];
  labelWidth?: number;
}) {
  if (!data.length) {
    return <EmptyState />;
  }
  return (
    <ChartContainer config={config} className="w-full" style={{ height: Math.max(data.length * 44 + 60, 200) }}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16 }}>
        <CartesianGrid horizontal={false} />
        <XAxis
          type="number"
          tickLine={false}
          axisLine={false}
          tickFormatter={(v: number) => fmtCompact(v)}
        />
        <YAxis
          type="category"
          dataKey="name"
          tickLine={false}
          axisLine={false}
          width={labelWidth}
          tickFormatter={(v: string) => truncate(v, 20)}
          fontSize={11}
        />
        <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
        <ChartLegend content={<ChartLegendContent />} />
        {TOKEN_SERIES.map((s) => (
          <Bar key={s.key} dataKey={s.key} stackId="tokens" fill={s.color} radius={s.key === "reasoning_tokens" ? [0, 3, 3, 0] : undefined} maxBarSize={24} />
        ))}
      </BarChart>
    </ChartContainer>
  );
}
