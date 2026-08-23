"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { FileUp, FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import type { ImportResult } from "@/lib/types";
import { fmtCost, fmtDateTime, fmtInt } from "@/lib/format";

const TEMPLATE_CSV = `timestamp,model,provider,input_tokens,cache_read_tokens,cache_write_tokens,output_tokens,reasoning_tokens,cost,session_id
2026-08-20T10:15:00Z,claude-sonnet-4-5,anthropic,1204,8800,1400,356,210,0.0312,ses_demo01
`;

export function ImportClient() {
  const [fileText, setFileText] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [pasteText, setPasteText] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const activeText =
    fileText !== null ? fileText : pasteText.trim() ? pasteText : null;

  async function run(dryRun: boolean) {
    if (!activeText) return;
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch(`/api/import${dryRun ? "?dry_run=true" : ""}`, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: activeText,
      });
      const data = (await res.json()) as ImportResult & { error?: string };
      if (!res.ok) {
        toast.error(data.error ?? "Import failed");
        return;
      }
      setResult(data);
      if (!dryRun && data.inserted) {
        toast.success(`Inserted ${data.inserted} record${data.inserted === 1 ? "" : "s"}`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import failed");
    } finally {
      setBusy(false);
    }
  }

  function downloadTemplate() {
    const blob = new Blob([TEMPLATE_CSV], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "usage-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) readFile(f);
  };

  function readFile(f: File) {
    setFileName(f.name);
    setPasteText("");
    f.text().then(setFileText);
  }

  return (
    <div className="flex flex-col gap-6">
      <Tabs defaultValue="upload">
        <TabsList>
          <TabsTrigger value="upload">Upload file</TabsTrigger>
          <TabsTrigger value="paste">Paste text</TabsTrigger>
        </TabsList>

        <TabsContent value="upload">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => fileInput.current?.click()}
            className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-10 text-center transition-colors ${
              dragging ? "border-primary bg-accent/50" : "border-border hover:bg-accent/30"
            }`}
          >
            <FileUp className="size-8 text-muted-foreground" />
            {fileName ? (
              <>
                <p className="text-sm font-medium">{fileName}</p>
                <p className="text-xs text-muted-foreground">
                  {fmtInt(new Blob([fileText ?? ""],).size)} bytes — click to choose another file
                </p>
              </>
            ) : (
              <>
                <p className="text-sm font-medium">
                  Drop a CSV / JSON / NDJSON file here, or click to browse
                </p>
                <p className="text-xs text-muted-foreground">Max 50MB</p>
              </>
            )}
          </div>
          <input
            ref={fileInput}
            type="file"
            accept=".csv,.json,.jsonl,.ndjson,.txt,text/csv,application/json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) readFile(f);
            }}
          />
        </TabsContent>

        <TabsContent value="paste">
          <textarea
            value={pasteText}
            onChange={(e) => {
              setPasteText(e.target.value);
              setFileText(null);
              setFileName(null);
            }}
            placeholder='{"timestamp":"2026-08-20T10:15:00Z","model":"…", …} — JSON array, NDJSON lines, or CSV'
            rows={10}
            className="w-full rounded-lg border bg-background p-3 font-mono text-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          />
        </TabsContent>
      </Tabs>

      <div className="flex items-center gap-2">
        <Button disabled={!activeText || busy} onClick={() => run(false)}>
          {busy ? "Working…" : fileText !== null ? "Import file" : "Import"}
        </Button>
        <Button variant="outline" disabled={!activeText || busy} onClick={() => run(true)}>
          <FlaskConical className="size-4" /> Preview (dry run)
        </Button>
        <Button variant="ghost" size="sm" onClick={downloadTemplate}>
          Download CSV template
        </Button>
      </div>

      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {result.dry_run ? "Preview" : "Result"}
              {result.dry_run && <Badge variant="secondary">dry run — nothing written</Badge>}
              {!result.dry_run && (
                <Badge>
                  +{fmtInt(result.inserted ?? 0)} inserted
                  {(result.skipped_duplicates ?? 0) > 0 &&
                    ` · ${result.skipped_duplicates} duplicates skipped`}
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              Detected format: {result.format ?? "?"} · {fmtInt(result.total)} input rows,{" "}
              {fmtInt(result.accepted)} valid
              {result.ignored > 0 && `, ${result.ignored} ignored (non-assistant messages)`}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {result.errors.length > 0 && (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs">
                <p className="mb-1 font-medium text-destructive">{result.errors.length} row(s) with errors:</p>
                <ul className="list-inside list-disc space-y-0.5 font-mono">
                  {result.errors.slice(0, 10).map((e, i) => (
                    <li key={i}>
                      row {e.index}: {e.error}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {result.preview && result.preview.length > 0 && (
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Timestamp</TableHead>
                      <TableHead>Model</TableHead>
                      <TableHead className="text-right">Input</TableHead>
                      <TableHead className="text-right">Cache read</TableHead>
                      <TableHead className="text-right">Output</TableHead>
                      <TableHead className="text-right">Reasoning</TableHead>
                      <TableHead className="text-right">Cost</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.preview.map((r, i) => (
                      <TableRow key={i}>
                        <TableCell className="whitespace-nowrap text-xs">{fmtDateTime(String(r.ts))}</TableCell>
                        <TableCell className="text-xs">{String(r.model)}</TableCell>
                        <TableCell className="text-right tabular-nums">{fmtInt(Number(r.input_tokens))}</TableCell>
                        <TableCell className="text-right tabular-nums">{fmtInt(Number(r.cache_read_tokens))}</TableCell>
                        <TableCell className="text-right tabular-nums">{fmtInt(Number(r.output_tokens))}</TableCell>
                        <TableCell className="text-right tabular-nums">{fmtInt(Number(r.reasoning_tokens))}</TableCell>
                        <TableCell className="text-right tabular-nums">{fmtCost(Number(r.cost))}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
