"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/dashboard/empty-state";
import { CompactNumber } from "@/components/dashboard/compact-number";
import { fmtCost, fmtDateTime, projectLabel } from "@/lib/format";
import type { ProjectBreakdown } from "@/lib/types";

export function ProjectsTable({ rows }: { rows: ProjectBreakdown[] }) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((r) =>
      [r.name ?? "", r.worktree ?? "", r.project_id ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(needle)
    );
  }, [rows, q]);

  return (
    <div className="flex flex-col gap-4">
      <div className="relative w-full max-w-sm">
        <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search projects…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="pl-8"
        />
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow>
              <TableHead>Project</TableHead>
              <TableHead className="text-right">Sessions</TableHead>
              <TableHead className="text-right">Requests</TableHead>
              <TableHead className="text-right">Tokens</TableHead>
              <TableHead className="text-right">Cost</TableHead>
              <TableHead>Last activity</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="p-0">
                  <EmptyState
                    title={q ? "No projects match your search" : "No projects yet"}
                    description={
                      q
                        ? "Try a different search term."
                        : "Import OpenCode data to group your usage by project."
                    }
                  />
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((p) => (
                <TableRow key={p.project_id ?? "none"} className="cursor-pointer hover:bg-accent/30">
                  <TableCell className="max-w-72">
                    {p.project_id ? (
                      <Link
                        href={`/projects/${encodeURIComponent(p.project_id)}`}
                        className="block truncate font-medium underline-offset-4 hover:underline"
                      >
                        {projectLabel(p)}
                      </Link>
                    ) : (
                      <span className="block truncate font-medium">{projectLabel(p)}</span>
                    )}
                    <span className="block truncate font-mono text-[11px] text-muted-foreground">
                      {p.worktree ?? p.name ?? ""}
                    </span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{p.sessions}</TableCell>
                  <TableCell className="text-right tabular-nums">{p.requests}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    <CompactNumber
                      value={
                        p.input_tokens +
                        p.cache_read_tokens +
                        p.output_tokens +
                        p.reasoning_tokens
                      }
                    />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{fmtCost(p.cost)}</TableCell>
                  <TableCell className="whitespace-nowrap tabular-nums text-muted-foreground">
                    {fmtDateTime(p.last_ts)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-muted-foreground">
        Showing {filtered.length} of {rows.length} projects
      </p>
    </div>
  );
}
