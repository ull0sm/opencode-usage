"use client";

import { useMemo } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { EmptyState } from "@/components/dashboard/empty-state";
import { fmtCompact, fmtInt } from "@/lib/format";
import type { TimeseriesPoint } from "@/lib/types";

interface Props {
  data: TimeseriesPoint[];
}

const CELL = 12; // px, matches size-3
const GAP = 3;
const LEVELS = [
  "var(--muted)", // no usage
  "rgba(96,165,250,0.25)",
  "rgba(96,165,250,0.45)",
  "rgba(96,165,250,0.7)",
  "rgba(96,165,250,1)",
];

function dayTotal(p: TimeseriesPoint): number {
  return p.input_tokens + p.cache_read_tokens + p.output_tokens + p.reasoning_tokens;
}

function toUtcDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** GitHub-style calendar heatmap of daily total token volume. */
export function CalendarHeatmap({ data }: Props) {
  const { weeks, monthLabels, max } = useMemo(() => {
    const byDate = new Map(data.map((p) => [p.date, p]));
    if (data.length === 0) return { weeks: [], monthLabels: [], max: 0 };

    const dates = data.map((p) => p.date).sort();
    const start = new Date(`${dates[0]}T00:00:00Z`);
    // align the grid so each column is a Sun→Sat week
    start.setUTCDate(start.getUTCDate() - start.getUTCDay());
    const end = new Date(`${dates[dates.length - 1]}T00:00:00Z`);

    const cols: { date: string; point?: TimeseriesPoint }[][] = [];
    const labels: { col: number; label: string }[] = [];
    let lastMonth = -1;
    let maxTotal = 0;

    for (const d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
      const col = Math.floor((d.getTime() - start.getTime()) / (7 * 86400000));
      if (!cols[col]) cols[col] = [];
      const key = toUtcDay(d);
      const point = byDate.get(key);
      if (point) maxTotal = Math.max(maxTotal, dayTotal(point));
      cols[col].push({ date: key, point });
      if (d.getUTCMonth() !== lastMonth && d.getUTCDate() <= 7) {
        lastMonth = d.getUTCMonth();
        labels.push({
          col,
          label: d.toLocaleString("en-US", { month: "short", timeZone: "UTC" }),
        });
      }
    }

    return { weeks: cols, monthLabels: labels, max: maxTotal };
  }, [data]);

  if (weeks.length === 0) return <EmptyState className="py-16" />;

  const threshold = (level: number): number => (max * level * level) / 16;

  return (
    <div className="flex flex-col gap-2">
      <div className="overflow-x-auto pb-1">
        <div className="inline-flex flex-col gap-1">
          <div className="relative h-4" style={{ width: weeks.length * (CELL + GAP) }}>
            {monthLabels.map((m) => (
              <span
                key={`${m.col}-${m.label}`}
                className="absolute text-[10px] text-muted-foreground"
                style={{ left: m.col * (CELL + GAP) }}
              >
                {m.label}
              </span>
            ))}
          </div>
          <div className="flex gap-[3px]">
            {weeks.map((week, i) => (
              <div key={i} className="flex flex-col gap-[3px]">
                {Array.from({ length: 7 }).map((_, dayIdx) => {
                  const cell = week[dayIdx];
                  if (!cell) return <div key={dayIdx} style={{ width: CELL, height: CELL }} />;
                  const total = cell.point ? dayTotal(cell.point) : 0;
                  const requests = cell.point?.requests ?? 0;
                  let level = 0;
                  if (total > 0) {
                    for (let l = 1; l < LEVELS.length; l++) {
                      if (total >= threshold(l - 0.5)) level = l;
                    }
                  }
                  return (
                    <Tooltip key={cell.date}>
                      <TooltipTrigger asChild>
                        <div
                          tabIndex={0}
                          aria-label={`${cell.date}: ${fmtInt(total)} tokens`}
                          className="rounded-sm outline-none ring-ring focus-visible:ring-2"
                          style={{ width: CELL, height: CELL, backgroundColor: LEVELS[level] }}
                        />
                      </TooltipTrigger>
                      <TooltipContent>
                        <span className="font-medium">{cell.date}</span>
                        <span className="opacity-70">·</span>
                        {fmtInt(total)} tokens
                        <span className="opacity-70">·</span>
                        {fmtCompact(requests)} req
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-1 text-[10px] text-muted-foreground">
        Less
        {LEVELS.map((c) => (
          <span
            key={c}
            className="rounded-sm"
            style={{ width: CELL, height: CELL, backgroundColor: c }}
          />
        ))}
        More
      </div>
    </div>
  );
}
