"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Rows3, Rows4 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/dashboard/empty-state";
import { RequestDetailSheet } from "@/components/usage/request-detail-sheet";
import { ModelMultiSelect } from "@/components/dashboard/model-multi-select";
import { fmtCost, fmtDateTime, fmtInt } from "@/lib/format";
import { TOKEN_SERIES } from "@/lib/colors";
import type { UsageListResponse } from "@/lib/types";

interface Props {
  models: string[];
}

interface Row {
  id: number;
  ts: string;
  model: string;
  provider: string | null;
  session_id: string | null;
  input_tokens: number;
  cache_read_tokens: number;
  output_tokens: number;
  reasoning_tokens: number;
  cost: number | null;
}

const PAGE_SIZES = [25, 50, 100];

type Density = "comfortable" | "compact";
const DENSITY_KEY = "ta-density";

function initialDensity(): Density {
  if (typeof window === "undefined") return "comfortable";
  return window.localStorage.getItem(DENSITY_KEY) === "compact" ? "compact" : "comfortable";
}

export function UsageTable({ models }: Props) {
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [loadedQuery, setLoadedQuery] = useState<string | null>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [sort, setSort] = useState<{ id: string; desc: boolean }>({ id: "ts", desc: true });
  const [modelFilter, setModelFilter] = useState<string[]>([]);
  const [sessionDraft, setSessionDraft] = useState("");
  const [sessionFilter, setSessionFilter] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  const [density, setDensity] = useState<Density>(initialDensity);

  const toggleDensity = () => {
    setDensity((cur) => {
      const next = cur === "compact" ? "comfortable" : "compact";
      window.localStorage.setItem(DENSITY_KEY, next);
      return next;
    });
  };

  const query = useMemo(() => {
    const q = new URLSearchParams();
    q.set("page", String(pageIndex + 1));
    q.set("page_size", String(pageSize));
    q.set("sort", sort.id);
    q.set("dir", sort.desc ? "desc" : "asc");
    for (const m of modelFilter) q.append("model", m);
    if (sessionFilter) q.set("session", sessionFilter);
    if (from) q.set("from", from);
    if (to) q.set("to", to);
    return q.toString();
  }, [pageIndex, pageSize, sort, modelFilter, sessionFilter, from, to]);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/usage?${query}`, { signal: controller.signal })
      .then((r) => r.json() as Promise<UsageListResponse>)
      .then((data) => {
        setRows(data.rows as unknown as Row[]);
        setTotal(data.total);
        setLoadedQuery(query);
      })
      .catch((e) => {
        if (!(e instanceof DOMException && e.name === "AbortError")) {
          console.error(e);
          setLoadedQuery(query);
        }
      });
    return () => controller.abort();
  }, [query]);

  const loading = loadedQuery !== query;

  const resetPage = () => setPageIndex(0);

  const toggleSort = (id: string) => {
    setSort((cur) =>
      cur.id !== id ? { id, desc: true } : cur.desc ? { id, desc: false } : { id, desc: true }
    );
    resetPage();
  };

  const pageCount = Math.max(Math.ceil(total / pageSize), 1);
  const rangeStart = total === 0 ? 0 : pageIndex * pageSize + 1;
  const rangeEnd = Math.min((pageIndex + 1) * pageSize, total);

  const sortHeader = (col: string, label: string, align: "left" | "right" = "left") => (
    <TableHead className={align === "right" ? "text-right" : undefined}>
      <button
        onClick={() => toggleSort(col)}
        className={`inline-flex items-center gap-1 hover:text-foreground ${
          sort.id === col ? "text-foreground" : ""
        } ${align === "right" ? "flex-row-reverse w-full" : ""}`}
      >
        {label}
        {sort.id === col &&
          (sort.desc ? <ArrowDown className="size-3" /> : <ArrowUp className="size-3" />)}
      </button>
    </TableHead>
  );

  return (
    <div className="flex flex-col gap-4">
      {/* filters */}
      <div className="sticky top-0 z-10 -mx-1 flex flex-wrap items-end gap-3 rounded-md bg-background/95 px-1 py-1.5 backdrop-blur supports-[backdrop-filter]:bg-background/75">
        <div>
          <Label className="text-xs text-muted-foreground">Models</Label>
          <ModelMultiSelect
            models={models}
            selected={modelFilter}
            onChange={(selected) => {
              setModelFilter(selected);
              resetPage();
            }}
            className="mt-1.5 w-48"
          />
        </div>

        <div>
          <Label htmlFor="usage-from" className="text-xs text-muted-foreground">From</Label>
          <Input
            id="usage-from"
            type="date"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              resetPage();
            }}
            className="mt-1.5 w-36"
          />
        </div>

        <div>
          <Label htmlFor="usage-to" className="text-xs text-muted-foreground">To</Label>
          <Input
            id="usage-to"
            type="date"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              resetPage();
            }}
            className="mt-1.5 w-36"
          />
        </div>

        <div className="w-52">
          <Label htmlFor="usage-session" className="text-xs text-muted-foreground">Session contains</Label>
          <Input
            id="usage-session"
            placeholder="ses_…"
            value={sessionDraft}
            onChange={(e) => setSessionDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (setSessionFilter(sessionDraft), resetPage())}
            onBlur={() => {
              if ((sessionFilter || "") !== sessionDraft) {
                setSessionFilter(sessionDraft);
                resetPage();
              }
            }}
            className="mt-1.5 font-mono text-xs"
          />
        </div>

        {(modelFilter.length > 0 || sessionFilter || from || to) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setModelFilter([]);
              setSessionDraft("");
              setSessionFilter("");
              setFrom("");
              setTo("");
              resetPage();
            }}
          >
            Clear
          </Button>
        )}
      </div>

      {/* table */}
      <div
        className={
          density === "compact"
            ? "overflow-x-auto rounded-lg border [&_td]:py-1 [&_td]:text-xs [&_th]:h-8"
            : "overflow-x-auto rounded-lg border"
        }
      >
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow>
              <TableHead colSpan={4} />
              <TableHead colSpan={2} className="text-center text-[11px] font-medium tracking-wide">
                <span style={{ color: TOKEN_SERIES[0].color }}>INPUT</span>
                <span className="mx-1.5 text-muted-foreground">+</span>
                <span style={{ color: TOKEN_SERIES[1].color }}>CACHE READ</span>
              </TableHead>
              <TableHead colSpan={2} className="text-center text-[11px] font-medium tracking-wide">
                <span style={{ color: TOKEN_SERIES[2].color }}>OUTPUT</span>
                <span className="mx-1.5 text-muted-foreground">+</span>
                <span style={{ color: TOKEN_SERIES[3].color }}>REASONING</span>
              </TableHead>
              <TableHead />
            </TableRow>
            <TableRow>
              {sortHeader("ts", "Timestamp")}
              {sortHeader("provider", "Provider")}
              {sortHeader("model", "Model")}
              {sortHeader("session_id", "Session")}
              {sortHeader("input_tokens", "Input", "right")}
              {sortHeader("cache_read_tokens", "Cache read", "right")}
              {sortHeader("output_tokens", "Output", "right")}
              {sortHeader("reasoning_tokens", "Reasoning", "right")}
              {sortHeader("cost", "Cost", "right")}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && rows.length === 0 ? (
              Array.from({ length: 8 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 9 }).map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="p-0">
                  <EmptyState
                    title="No usage records match these filters"
                    description="Adjust or clear the filters above to see more results."
                    actions={
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setModelFilter([]);
                          setSessionDraft("");
                          setSessionFilter("");
                          setFrom("");
                          setTo("");
                          resetPage();
                        }}
                      >
                        Clear filters
                      </Button>
                    }
                  />
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow
                  key={row.id}
                  tabIndex={0}
                  aria-label={`Request ${row.id} details`}
                  className="cursor-pointer focus-visible:bg-accent/50 hover:bg-accent/30"
                  onClick={() => setSelectedEventId(row.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelectedEventId(row.id);
                    }
                  }}
                >
                  <TableCell className="whitespace-nowrap tabular-nums">
                    {fmtDateTime(row.ts)}
                  </TableCell>
                  <TableCell>{row.provider ?? "—"}</TableCell>
                  <TableCell>{row.model}</TableCell>
                  <TableCell>
                    {row.session_id ? (
                      <Link
                        href={`/sessions/${encodeURIComponent(row.session_id)}`}
                        onClick={(e) => e.stopPropagation()}
                        className="font-mono text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                      >
                        {row.session_id}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{fmtInt(row.input_tokens)}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmtInt(row.cache_read_tokens)}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmtInt(row.output_tokens)}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmtInt(row.reasoning_tokens)}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmtCost(row.cost)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* pagination */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground tabular-nums">
          {total === 0
            ? "0 records"
            : `${fmtInt(rangeStart)}–${fmtInt(rangeEnd)} of ${fmtInt(total)}`}
        </p>
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            title={density === "compact" ? "Comfortable rows" : "Compact rows"}
            onClick={toggleDensity}
          >
            {density === "compact" ? <Rows3 className="size-4" /> : <Rows4 className="size-4" />}
          </Button>
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground">Rows</Label>
            <Select
              value={String(pageSize)}
              onValueChange={(v) => {
                setPageSize(Number(v));
                resetPage();
              }}
            >
              <SelectTrigger size="sm" className="w-18">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZES.map((s) => (
                  <SelectItem key={s} value={String(s)}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="icon"
              disabled={pageIndex === 0}
              onClick={() => setPageIndex((p) => p - 1)}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <span className="text-sm tabular-nums">
              {pageIndex + 1} / {pageCount}
            </span>
            <Button
              variant="outline"
              size="icon"
              disabled={rangeEnd >= total}
              onClick={() => setPageIndex((p) => p + 1)}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      </div>
      {/* request detail sheet */}
      <RequestDetailSheet
        eventId={selectedEventId}
        onOpenChange={(open) => !open && setSelectedEventId(null)}
      />
    </div>
  );
}
