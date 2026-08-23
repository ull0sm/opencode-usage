import { ImportClient } from "@/components/import/import-client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function ImportPage() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Import usage data</h1>
        <p className="text-sm text-muted-foreground">
          Bulk-load history. Duplicates are detected automatically and skipped, so re-importing
          overlapping files is safe.
        </p>
      </div>

      <ImportClient />

      <Card>
        <CardHeader>
          <CardTitle>Accepted formats</CardTitle>
          <CardDescription>Format is auto-detected — no configuration needed.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5 text-sm">
          <div>
            <p className="mb-1 font-medium">1 · Canonical CSV</p>
            <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs leading-relaxed">
{`timestamp,model,provider,input_tokens,cache_read_tokens,cache_write_tokens,output_tokens,reasoning_tokens,cost,session_id
2026-08-20T10:15:00Z,claude-sonnet-4-5,anthropic,1204,8800,1400,356,210,0.0312,ses_demo01`}
            </pre>
            <p className="mt-1 text-xs text-muted-foreground">
              Only <code>timestamp</code> (ISO-8601 / epoch) and <code>model</code> are required;
              other columns are optional and default to 0/empty.
            </p>
          </div>

          <div>
            <p className="mb-1 font-medium">2 · Canonical JSON / NDJSON</p>
            <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs leading-relaxed">
{`[{ "timestamp": "2026-08-20T10:15:00Z", "model": "claude-sonnet-4-5",
   "provider": "anthropic", "session_id": "ses_demo01",
   "input_tokens": 1204, "output_tokens": 356, "cost": 0.0312 }]`}
            </pre>
          </div>

          <div>
            <p className="mb-1 font-medium">3 · Raw OpenCode assistant messages</p>
            <p className="text-xs text-muted-foreground mb-1">
              Messages exactly as OpenCode stores them (e.g. from its session storage or API). The
              full object is preserved in the database as raw usage data.
            </p>
            <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs leading-relaxed">
{`{ "id": "msg_01", "role": "assistant", "sessionID": "ses_abc",
  "modelID": "claude-sonnet-4-5", "providerID": "anthropic",
  "time": { "created": 1755682500000 },
  "cost": 0.0312,
  "tokens": { "input": 1204, "output": 356, "reasoning": 210,
              "cache": { "read": 8800, "write": 1400 } } }`}
            </pre>
            <p className="mt-1 text-xs text-muted-foreground">
              Arrays of messages and <code>{"{ info, parts }"}</code> wrappers are also accepted;
              user/system messages are ignored automatically.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
