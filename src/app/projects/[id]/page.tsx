import Link from "next/link";
import { cookies } from "next/headers";
import { ArrowLeft, FolderGit2 } from "lucide-react";
import { getProjectDetail, getByModel, listProjectSessions, getTimeseries } from "@/lib/db/queries";
import { filtersFromSearchParams, resolveDayShift } from "@/lib/filters";
import { SummaryCards } from "@/components/dashboard/summary-cards";
import { TokensOverTimeChart } from "@/components/charts/tokens-over-time";
import { CompositionChart } from "@/components/charts/composition-chart";
import { SessionsTable } from "@/components/sessions/sessions-table";
import { RenameControl } from "@/components/shared/rename-control";
import { LiveRefresh } from "@/components/live-refresh";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { projectLabel } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ProjectPage(props: PageProps<"/projects/[id]">) {
  const { id } = await props.params;
  const projectId = decodeURIComponent(id);
  const detail = getProjectDetail(projectId);

  if (!detail) {
    return (
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-6">
        <BackLink />
        <Card>
          <CardContent className="flex h-40 flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
            <p>No usage records found for this project.</p>
            <p className="font-mono text-xs">{projectId}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const sp = (await props.searchParams) as Record<string, string | string[] | undefined>;
  const filter = { ...filtersFromSearchParams(sp), project: projectId };
  const cookieTz = (await cookies()).get("tz")?.value;
  const dayShift = resolveDayShift(null, cookieTz);

  const [series, byModel] = await Promise.all([
    getTimeseries(filter, dayShift),
    getByModel(filter),
  ]);
  const sessions = listProjectSessions(projectId);
  const label = projectLabel(detail);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-6">
      <BackLink />

      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-semibold tracking-tight">{label}</h1>
          <RenameControl
            endpoint={`/api/projects/${encodeURIComponent(projectId)}`}
            field="name"
            initialValue={detail.name}
          />
        </div>
        {detail.worktree && (
          <p className="font-mono text-sm break-all text-muted-foreground">{detail.worktree}</p>
        )}
        <div className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
          <FolderGit2 className="size-3.5" />
          {sessions.length} session{sessions.length === 1 ? "" : "s"} in this project
        </div>
      </div>

      <SummaryCards s={detail} series={series} />

      <Card>
        <CardHeader>
          <CardTitle>Tokens over time</CardTitle>
          <CardDescription>Daily totals for this project, stacked by category</CardDescription>
        </CardHeader>
        <CardContent>
          <TokensOverTimeChart data={series} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>By model</CardTitle>
          <CardDescription>Token composition per model within this project</CardDescription>
        </CardHeader>
        <CardContent>
          <CompositionChart data={byModel.map((m) => ({ name: m.model, ...m }))} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sessions</CardTitle>
          <CardDescription>Every session recorded under this project</CardDescription>
        </CardHeader>
        <CardContent>
          <SessionsTable rows={sessions} showProject={false} />
        </CardContent>
      </Card>
      <LiveRefresh />
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/projects"
      className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
    >
      <ArrowLeft className="size-4" /> Back to projects
    </Link>
  );
}
