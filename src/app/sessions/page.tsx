import { listSessions } from "@/lib/db/queries";
import { SessionsTable } from "@/components/sessions/sessions-table";
import { LiveRefresh } from "@/components/live-refresh";

export const dynamic = "force-dynamic";

export default function SessionsPage() {
  const rows = listSessions();
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Sessions</h1>
        <p className="text-sm text-muted-foreground">
          Every OpenCode session with recorded usage, most recently active first.
        </p>
      </div>

      <SessionsTable rows={rows} />
      <LiveRefresh />
    </div>
  );
}
