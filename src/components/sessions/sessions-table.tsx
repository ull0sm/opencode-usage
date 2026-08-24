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
import { fmtCost, fmtDateTime, sessionTitle } from "@/lib/format";
import type { SessionListItem } from "@/lib/types";

export function SessionsTable({
  rows,
  showProject = true,
}: {
  rows: SessionListItem[];
  showProject?: boolean;
}) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((r) =>
      [
        r.title ?? "",
        r.slug ?? "",
        r.session_id,
        r.project_name ?? "",
        r.project_id ?? "",
        r.directory ?? "",
      ]
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
          placeholder="Search by title, id or project…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="pl-8"
        />
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow>
              <TableHead>Session</TableHead>
              {showProject && <TableHead>Project</TableHead>}
              <TableHead className="text-right">Requests</TableHead>
              <TableHead className="text-right">Tokens</TableHead>
              <TableHead className="text-right">Cost</TableHead>
              <TableHead>Last activity</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={showProject ? 6 : 5} className="p-0">
                  <EmptyState
                    title={q ? "No sessions match your search" : "No sessions yet"}
                    description={
                      q
                        ? "Try a different search term."
                        : "Import OpenCode data to see your named sessions here."
                    }
                  />
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((s) => (
                <TableRow key={s.session_id} className="cursor-pointer hover:bg-accent/30">
                  <TableCell className="max-w-72">
                    <Link
                      href={`/sessions/${encodeURIComponent(s.session_id)}`}
                      className="block truncate font-medium underline-offset-4 hover:underline"
                    >
                      {sessionTitle(s)}
                    </Link>
                    <span className="block truncate font-mono text-[11px] text-muted-foreground">
                      {s.session_id}
                    </span>
                  </TableCell>
                  {showProject && (
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {s.project_name || s.project_id ? (
                        <Link
                          href={`/projects/${encodeURIComponent(s.project_id ?? "")}`}
                          className="underline-offset-4 hover:text-foreground hover:underline"
                        >
                          {s.project_id === "global" ? "Ad-hoc" : s.project_name || s.project_id}
                        </Link>
                      ) : (
                        "(no project)"
                      )}
                    </TableCell>
                  )}
                  <TableCell className="text-right tabular-nums">{s.requests}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    <CompactNumber value={s.total_tokens ?? 0} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{fmtCost(s.cost)}</TableCell>
                  <TableCell className="whitespace-nowrap tabular-nums text-muted-foreground">
                    {fmtDateTime(s.last_ts)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-muted-foreground">
        Showing {filtered.length} of {rows.length} sessions
      </p>
    </div>
  );
}
