import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { EmptyState } from "@/components/dashboard/empty-state";
import { fmtCompact, fmtCost, fmtInt } from "@/lib/format";
import type { ModelEfficiencyRow } from "@/lib/types";

interface Props {
  rows: ModelEfficiencyRow[];
  blendedCostPer1m: number | null;
}

/** Per-model cost efficiency, sorted by $/1M descending. Flags outliers >2x blended. */
export function ModelEfficiencyTable({ rows, blendedCostPer1m }: Props) {
  if (rows.length === 0) {
    return <EmptyState />;
  }

  const threshold = blendedCostPer1m != null && blendedCostPer1m > 0 ? blendedCostPer1m * 2 : null;

  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader className="bg-muted/40">
          <TableRow>
            <TableHead>Model</TableHead>
            <TableHead className="text-right">Requests</TableHead>
            <TableHead className="text-right">Tokens</TableHead>
            <TableHead className="text-right">Cost</TableHead>
            <TableHead className="text-right">$ / 1M tokens</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => {
            const isOutlier =
              threshold != null && r.cost_per_1m != null && r.cost_per_1m > threshold;
            return (
              <TableRow key={r.model}>
                <TableCell className="font-medium">{r.model}</TableCell>
                <TableCell className="text-right tabular-nums">{fmtInt(r.requests)}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {fmtCompact(r.total_tokens)}
                </TableCell>
                <TableCell className="text-right tabular-nums">{fmtCost(r.cost)}</TableCell>
                <TableCell className="text-right tabular-nums">
                  <span className={isOutlier ? "inline-flex items-center gap-1.5 text-amber-500 dark:text-amber-400" : ""}>
                    {r.cost_per_1m == null ? "—" : `$${r.cost_per_1m.toFixed(2)}`}
                    {isOutlier && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge variant="outline" className="border-amber-500/50 text-amber-500 dark:text-amber-400">
                            outlier
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent>
                          More than 2× the blended average
                          {blendedCostPer1m != null &&
                            ` ($${blendedCostPer1m.toFixed(2)} / 1M)`}
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </span>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
