import Link from "next/link";
import { ArrowLeft, Clock, FolderGit2 } from "lucide-react";
import { getSessionDetail, listSessionEvents } from "@/lib/db/queries";
import { SummaryCards } from "@/components/dashboard/summary-cards";
import { SessionTimelineChart } from "@/components/charts/session-timeline-chart";
import { RenameControl } from "@/components/shared/rename-control";
import { LiveRefresh } from "@/components/live-refresh";
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
import { fmtCost, fmtDuration, fmtInt, sessionTitle } from "@/lib/format";
import { LocalTime } from "@/components/local-time";
import type { UsageEvent } from "@/lib/types";

export const dynamic = "force-dynamic";

interface SessionEventRow extends UsageEvent {
  ts: string;
  model: string;
  provider: string | null;
  input_tokens: number;
  cache_read_tokens: number;
  cache_write_tokens: number;
  output_tokens: number;
  reasoning_tokens: number;
  cost: number | null;
}

export default async function SessionPage(
  props: PageProps<"/sessions/[id]">
) {
  const { id: sessionId } = await props.params;
  const decoded = decodeURIComponent(sessionId);
  const detail = getSessionDetail(decoded);

  if (!detail) {
    return (
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-6">
        <BackLink />
        <Card>
          <CardContent className="flex h-40 flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
            <p>No usage records found for this session.</p>
            <p className="font-mono text-xs">{decoded}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const events = listSessionEvents(decoded) as unknown as SessionEventRow[];
  const duration = fmtDuration(detail.first_ts, detail.last_ts);
  const name = sessionTitle(detail);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-6">
      <BackLink />

      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-semibold tracking-tight">{name}</h1>
          <RenameControl
            endpoint={`/api/sessions/${encodeURIComponent(detail.session_id)}`}
            field="title"
            initialValue={detail.title}
          />
        </div>
        <p className="font-mono text-sm break-all text-muted-foreground">{decoded}</p>
        <div className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
          <FolderGit2 className="size-3.5" />
          {detail.project_id ? (
            <Link
              href={`/projects/${encodeURIComponent(detail.project_id)}`}
              className="underline-offset-4 hover:text-foreground hover:underline"
            >
              {detail.project_name || detail.project_id}
            </Link>
          ) : (
            <span>(no project)</span>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <Clock className="size-4" /> {duration}
        </span>
        <span>
          First request:{" "}
          <span className="tabular-nums">
            <LocalTime iso={detail.first_ts ?? ""} />
          </span>
        </span>
        <span>
          Last request:{" "}
          <span className="tabular-nums">
            <LocalTime iso={detail.last_ts ?? ""} />
          </span>
        </span>
      </div>

      <SummaryCards s={detail} />

      <Card>
        <CardHeader>
          <CardTitle>Per-request timeline</CardTitle>
          <CardDescription>
            {fmtInt(events.length)} requests, chronological — stacked by token
            category
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SessionTimelineChart data={events} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Requests</CardTitle>
          <CardDescription>Every logged event in this session</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead className="text-right">Input</TableHead>
                  <TableHead className="text-right">Cache read</TableHead>
                  <TableHead className="text-right">Output</TableHead>
                  <TableHead className="text-right">Reasoning</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="whitespace-nowrap tabular-nums">
                      <LocalTime iso={e.ts} />
                    </TableCell>
                    <TableCell>{e.provider ?? "—"}</TableCell>
                    <TableCell>{e.model}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {fmtInt(e.input_tokens)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {fmtInt(e.cache_read_tokens)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {fmtInt(e.output_tokens)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {fmtInt(e.reasoning_tokens)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {fmtCost(e.cost)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      <LiveRefresh />
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/"
      className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
    >
      <ArrowLeft className="size-4" /> Back to dashboard
    </Link>
  );
}
