"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Download, Trash2, Database, HardDriveDownload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import type { MetaInfo } from "@/lib/types";
import { fmtDateTime, fmtInt } from "@/lib/format";

export function SettingsClient() {
  const [meta, setMeta] = useState<MetaInfo | null>(null);
  const [includeRaw, setIncludeRaw] = useState(false);
  const [importBusy, setImportBusy] = useState(false);

  const refresh = useCallback(() => {
    fetch("/api/usage/meta")
      .then((r) => r.json() as Promise<MetaInfo>)
      .then(setMeta)
      .catch(() => setMeta(null));
  }, []);

  useEffect(refresh, [refresh]);

  async function resetDb() {
    try {
      const res = await fetch("/api/db/reset", { method: "POST" });
      const data = (await res.json()) as { deleted: number };
      toast.success(`Deleted ${fmtInt(data.deleted)} record(s)`);
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Reset failed");
    }
  }

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HardDriveDownload className="size-4 text-muted-foreground" /> Import from OpenCode
          </CardTitle>
          <CardDescription>
            Reads assistant-message usage directly from OpenCode&apos;s local storage
            (~/.local/share/opencode/opencode.db). Safe to run repeatedly — duplicates are skipped.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            disabled={importBusy}
            onClick={async () => {
              setImportBusy(true);
              try {
                const res = await fetch("/api/import/opencode", { method: "POST" });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error ?? "Import failed");
                const bits = [
                  `${data.inserted} new record(s)`,
                  `${data.sessions?.length ?? 0} session(s)`,
                ];
                if (data.skipped_duplicates) bits.push(`${data.skipped_duplicates} duplicate(s) skipped`);
                if (data.skipped_empty) bits.push(`${data.skipped_empty} empty`);
                toast.success(`Imported ${bits.join(", ")}`);
                refresh();
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Import failed");
              } finally {
                setImportBusy(false);
              }
            }}
          >
            {importBusy ? "Reading OpenCode storage…" : "Pull from OpenCode storage"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="size-4 text-muted-foreground" /> Database
          </CardTitle>
          <CardDescription>SQLite file at data/usage.db in the project root</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-1.5 text-sm">
          <Row label="Records">{meta ? fmtInt(meta.row_count) : "…"}</Row>
          <Row label="Earliest record">{meta?.first_ts ? fmtDateTime(meta.first_ts) : "—"}</Row>
          <Row label="Latest record">{meta?.last_ts ? fmtDateTime(meta.last_ts) : "—"}</Row>
          <Row label="Models tracked">{meta ? fmtInt(meta.models.length) : "…"}</Row>
          <Row label="Sessions tracked">{meta ? fmtInt(meta.sessions.length) : "…"}</Row>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="size-4 text-muted-foreground" /> Export
          </CardTitle>
          <CardDescription>Download all records as CSV (applies to the full dataset)</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={includeRaw}
              onChange={(e) => setIncludeRaw(e.target.checked)}
              className="size-4 accent-[var(--primary)]"
            />
            Include raw OpenCode usage JSON column
          </label>
          <div>
            <Button asChild variant="outline">
              <a href={`/api/export${includeRaw ? "?include_raw=true" : ""}`}>
                <Download className="size-4" /> Download CSV
              </a>
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Tip: to export a filtered subset, apply filters on the usage page and use the dashboard
            date range — the export endpoint accepts the same query params
            (<code>from</code>, <code>to</code>, <code>model</code>, <code>session</code>).
          </p>
        </CardContent>
      </Card>

      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle>Danger zone</CardTitle>
          <CardDescription>Permanently delete every usage record.</CardDescription>
        </CardHeader>
        <CardContent>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive">
                <Trash2 className="size-4" /> Reset database
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete all usage records?</AlertDialogTitle>
                <AlertDialogDescription asChild>
                  <div>
                    This removes{" "}
                    <strong>{meta ? fmtInt(meta.row_count) : "all"} record(s)</strong> from the local
                    SQLite database. Exported CSVs and your original log files are not affected.
                    This action cannot be undone.
                  </div>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={resetDb}>Delete everything</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>

      <Separator />
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground"><Label>{label}</Label></span>
      <span className="tabular-nums">{children}</span>
    </div>
  );
}
