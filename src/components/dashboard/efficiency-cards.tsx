import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { fmtCompact, fmtCost, fmtInt, fmtPct } from "@/lib/format";
import type { EfficiencyStats } from "@/lib/types";

export function EfficiencyCards({ stats }: { stats: EfficiencyStats }) {
  const items: {
    label: string;
    value: string;
    hint?: string;
  }[] = [
    {
      label: "Cache hit rate",
      value: fmtPct(stats.cache_hit_rate),
      hint:
        stats.cache_hit_rate != null
          ? "share of context served from provider cache"
          : undefined,
    },
    {
      label: "Blended $ / 1M tokens",
      value: stats.blended_cost_per_1m == null ? "—" : `$${stats.blended_cost_per_1m.toFixed(2)}`,
      hint: `${fmtInt(stats.total_tokens)} tokens total`,
    },
    {
      label: "Avg tokens / request",
      value: fmtCompact(stats.avg_tokens_per_request ?? 0),
      hint: `${fmtInt(stats.requests)} requests`,
    },
    {
      label: "Avg cost / request",
      value: stats.avg_cost_per_request == null ? "—" : fmtCost(stats.avg_cost_per_request),
    },
    {
      label: "Avg requests / session",
      value: fmtPct2(stats.avg_requests_per_session),
      hint: `${fmtInt(stats.sessions)} sessions`,
    },
    {
      label: "Avg tokens / session",
      value: fmtCompact(stats.avg_tokens_per_session ?? 0),
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {items.map((it) => (
        <Card key={it.label}>
          <CardHeader className="pb-1">
            <CardDescription className="text-xs">{it.label}</CardDescription>
            <CardTitle className="text-2xl tabular-nums">{it.value}</CardTitle>
          </CardHeader>
          {it.hint && (
            <CardContent className="pt-0 text-xs text-muted-foreground">{it.hint}</CardContent>
          )}
        </Card>
      ))}
    </div>
  );
}

function fmtPct2(n: number | null): string {
  return n == null ? "—" : n.toFixed(1);
}
