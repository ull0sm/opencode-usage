import { getMeta } from "@/lib/db/queries";
import { UsageTable } from "@/components/usage/usage-table";
import { TokenLegend } from "@/components/dashboard/token-legend";

export const dynamic = "force-dynamic";

export default function UsagePage() {
  const meta = getMeta();
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Usage history</h1>
        <p className="text-sm text-muted-foreground">
          Every logged usage event. Click a column header to sort, a row for full
          detail.
        </p>
        <TokenLegend className="mt-2" />
      </div>
      <UsageTable models={meta.models} />
    </div>
  );
}
