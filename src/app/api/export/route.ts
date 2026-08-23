import { NextRequest } from "next/server";
import { filtersFromSearchParams } from "@/lib/filters";
import { exportRows } from "@/lib/db/queries";
import { recordsToCsv } from "@/lib/csv";
import type { UsageRecord } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/export?from&to&model&provider&session&include_raw=true → CSV download. */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const filter = filtersFromSearchParams(Object.fromEntries(sp.entries()));
  const includeRaw = sp.get("include_raw") === "true";

  const rows = (exportRows(filter) as Record<string, unknown>[]).map((r) => ({
    ...r,
    ts: r.ts,
  })) as unknown as UsageRecord[];

  const csv = recordsToCsv(rows, includeRaw);
  const stamp = new Date().toISOString().replace(/[:T]/g, "-").slice(0, 16);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="usage-export-${stamp}.csv"`,
    },
  });
}
