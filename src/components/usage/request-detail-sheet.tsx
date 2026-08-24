"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { fmtCost, fmtDateTime, fmtInt } from "@/lib/format";
import { TOKEN_SERIES } from "@/lib/colors";
import type { UsageEvent } from "@/lib/types";

interface Props {
  eventId: number | null;
  onOpenChange: (open: boolean) => void;
}

interface DetailRow extends UsageEvent {
  ts: string;
  model: string;
  provider: string | null;
  session_id: string | null;
  session_title?: string | null;
  project_name?: string | null;
  input_tokens: number;
  cache_read_tokens: number;
  cache_write_tokens: number;
  output_tokens: number;
  reasoning_tokens: number;
  cost: number | null;
  content_hash?: string;
  source_ref?: string | null;
  raw_usage: string | null;
  created_at?: string;
}

export function RequestDetailSheet({ eventId, onOpenChange }: Props) {
  const open = eventId !== null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md" side="right">
        <SheetHeader>
          <SheetTitle>Request #{eventId ?? "…"}</SheetTitle>
          <SheetDescription>Full details for this logged request.</SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-4 px-4 pb-6">
          {eventId !== null && (
            <DetailBody key={eventId} id={eventId} onClose={() => onOpenChange(false)} />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function DetailBody({ id, onClose }: { id: number; onClose: () => void }) {
  const [row, setRow] = useState<DetailRow | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/usage/${id}`, { signal: controller.signal })
      .then(async (r) => {
        if (!r.ok) throw new Error(r.status === 404 ? "Record not found" : "Failed to load");
        return r.json() as Promise<DetailRow>;
      })
      .then(setRow)
      .catch((e) => {
        if (!(e instanceof DOMException && e.name === "AbortError")) {
          setError(e instanceof Error ? e.message : "Failed to load");
        }
      });
    return () => controller.abort();
  }, [id]);

  const rawJson = row?.raw_usage ? prettyJson(row.raw_usage) : null;

  if (!row && !error) {
    return (
      <div className="w-full space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-5 w-full" />
        ))}
      </div>
    );
  }

  if (error) {
    return <p className="text-sm text-muted-foreground">{error}</p>;
  }

  if (!row) return null;

  return (
    <>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                <Field label="Timestamp" value={fmtDateTime(row.ts)} />
                <Field label="Model" value={row.model} mono />
                <Field label="Provider" value={row.provider ?? "—"} />
                <Field
                  label="Session"
                  value={
                    row.session_id ? (
                      <Link
                        href={`/sessions/${encodeURIComponent(row.session_id)}`}
                        onClick={onClose}
                        title={row.session_title ? row.session_id : undefined}
                        className={`text-xs text-primary underline-offset-4 hover:underline ${
                          row.session_title ? "" : "font-mono"
                        }`}
                      >
                        {row.session_title ?? row.session_id}
                      </Link>
                    ) : (
                      "—"
                    )
                  }
                />
                {row.project_name && <Field label="Project" value={row.project_name} />}
                {row.source_ref && (
                  <Field label="Source ref" value={row.source_ref} mono />
                )}
              </dl>

              <Separator />

              <div className="grid grid-cols-2 gap-2 text-sm">
                {TOKEN_SERIES.map((s) => (
                  <div
                    key={s.key}
                    className="rounded-md border bg-muted/30 px-3 py-2"
                  >
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                    <p
                      className="text-lg font-semibold tabular-nums"
                      style={{ color: s.color }}
                    >
                      {fmtInt(row[s.key as keyof DetailRow] as number)}
                    </p>
                  </div>
                ))}
                <div className="rounded-md border bg-muted/30 px-3 py-2">
                  <p className="text-xs text-muted-foreground">Cache write</p>
                  <p className="text-lg font-semibold tabular-nums">
                    {fmtInt(row.cache_write_tokens)}
                  </p>
                </div>
                <div className="rounded-md border bg-muted/30 px-3 py-2">
                  <p className="text-xs text-muted-foreground">Cost</p>
                  <p className="text-lg font-semibold tabular-nums">
                    {fmtCost(row.cost)}
                  </p>
                </div>
              </div>

              {rawJson && (
                <>
                  <Separator />
                  <div>
                    <p className="mb-1.5 text-sm font-medium">Raw usage JSON</p>
                    <pre className="max-h-72 overflow-auto rounded-md bg-muted p-3 text-xs leading-relaxed">
                      {rawJson}
                    </pre>
                  </div>
                </>
              )}
    </>
  );
}

function Field({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={`text-right ${mono ? "font-mono text-xs break-all" : ""}`}>
        {value}
      </dd>
    </>
  );
}

function prettyJson(raw: string): string {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}
