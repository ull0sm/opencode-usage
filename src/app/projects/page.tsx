import { getByProject } from "@/lib/db/queries";
import { ProjectsTable } from "@/components/projects/projects-table";
import { LiveRefresh } from "@/components/live-refresh";

export const dynamic = "force-dynamic";

export default function ProjectsPage() {
  const rows = getByProject({}, 100);
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Projects</h1>
        <p className="text-sm text-muted-foreground">
          Token usage grouped by OpenCode project — many sessions, one folder.
        </p>
      </div>

      <ProjectsTable rows={rows} />
      <LiveRefresh />
    </div>
  );
}
