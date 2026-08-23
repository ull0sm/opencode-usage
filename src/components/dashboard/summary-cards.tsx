import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Card, CardDescription, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Sparkline } from "@/components/dashboard/sparkline";
import { fmtCost, fmtInt } from "@/lib/format";
import type { SummaryRow, TimeseriesPoint } from "@/lib/types";

interface Props {
  s: SummaryRow;
  /** Same metrics for the immediately preceding period of equal length. */
  previous?: SummaryRow | null;
  /** Daily buckets for the sparklines (current period). */
  series?: TimeseriesPoint[];
}

const GOOD = "#34d399";
const BAD = "#f87171";

export function SummaryCards({ s, previous, series }: Props) {
  const contextSent = s.input_tokens + s.cache_read_tokens;
  const generated = s.output_tokens + s.reasoning_tokens;
  const prevContext = previous ? previous.input_tokens + previous.cache_read_tokens : null;
  const prevGenerated = previous ? previous.output_tokens + previous.reasoning_tokens : null;

  const dailyRequests = (series ?? []).map((p) => p.requests);
  const dailyContext = (series ?? []).map((p) => p.input_tokens + p.cache_read_tokens);
  const dailyGenerated = (series ?? []).map((p) => p.output_tokens + p.reasoning_tokens);
  const dailyCost = (series ?? []).map((p) => p.cost);

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Card>
        <CardHeader>
          <CardDescription>Requests</CardDescription>
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-3xl tabular-nums">{fmtInt(s.requests)}</CardTitle>
            <DeltaBadge current={s.requests} previous={previous?.requests ?? null} />
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <Sparkline data={dailyRequests} color="#60a5fa" className="h-7 w-full" />
        </CardContent>
      </Card>

      <Card className="border-l-2" style={{ borderLeftColor: "#22d3ee" }}>
        <CardHeader>
          <CardDescription>Context sent</CardDescription>
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-3xl tabular-nums">{fmtInt(contextSent)}</CardTitle>
            <DeltaBadge current={contextSent} previous={prevContext} />
          </div>
        </CardHeader>
        <CardContent className="space-y-1 pt-0">
          <Sparkline data={dailyContext} color="#22d3ee" className="h-7 w-full" />
          <p className="text-xs text-muted-foreground">
            input {fmtInt(s.input_tokens)} · cache read{" "}
            <span style={{ color: "#22d3ee" }}>{fmtInt(s.cache_read_tokens)}</span>
            {s.cache_write_tokens > 0 && <> · +{fmtInt(s.cache_write_tokens)} written to cache</>}
          </p>
        </CardContent>
      </Card>

      <Card className="border-l-2" style={{ borderLeftColor: "#34d399" }}>
        <CardHeader>
          <CardDescription>Generated</CardDescription>
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-3xl tabular-nums">{fmtInt(generated)}</CardTitle>
            <DeltaBadge current={generated} previous={prevGenerated} />
          </div>
        </CardHeader>
        <CardContent className="space-y-1 pt-0">
          <Sparkline data={dailyGenerated} color="#34d399" className="h-7 w-full" />
          <p className="text-xs text-muted-foreground">
            output <span style={{ color: "#34d399" }}>{fmtInt(s.output_tokens)}</span> · reasoning{" "}
            <span style={{ color: "#a78bfa" }}>{fmtInt(s.reasoning_tokens)}</span>
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardDescription>Total cost</CardDescription>
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-3xl tabular-nums">{fmtCost(s.cost)}</CardTitle>
            <DeltaBadge
              current={s.cost}
              previous={previous?.cost ?? null}
              invert
              format={fmtCostShort}
            />
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <Sparkline data={dailyCost} color="#a78bfa" className="h-7 w-full" />
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Percentage change vs the previous period. `invert` treats a decrease as the
 * good outcome (used for cost). Returns null when there is nothing to compare.
 */
function DeltaBadge({
  current,
  previous,
  invert = false,
  format,
}: {
  current: number;
  previous: number | null | undefined;
  invert?: boolean;
  format?: (n: number) => string;
}) {
  if (previous == null || !Number.isFinite(previous)) return null;

  let ratio: number | null = null;
  if (previous === 0) {
    ratio = current > 0 ? 1 : null;
  } else {
    ratio = (current - previous) / Math.abs(previous);
  }
  if (ratio == null || Math.abs(ratio) < 0.005) {
    return <span className="text-xs text-muted-foreground">±0% vs prev</span>;
  }

  const up = ratio > 0;
  const good = invert ? !up : up;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  const value =
    format != null
      ? `${up ? "+" : "−"}${format(Math.abs(current - previous)).replace("$", "$")}`
      : `${up ? "+" : "−"}${Math.round(Math.abs(ratio) * 100)}%`;

  return (
    <span
      className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-medium"
      style={{
        color: good ? GOOD : BAD,
        backgroundColor: good ? "rgba(52,211,153,0.12)" : "rgba(248,113,113,0.12)",
      }}
      title={`Previous period: ${format != null ? format(previous) : fmtInt(previous)}`}
    >
      <Icon className="size-3" />
      {value}
    </span>
  );
}

function fmtCostShort(n: number): string {
  return fmtCost(n).replace(".00", "");
}
