import { NextRequest } from "next/server";
import { filtersFromSearchParams } from "@/lib/filters";
import { getTimeseries } from "@/lib/db/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/stats/timeseries — daily UTC token buckets. */
export async function GET(req: NextRequest) {
  const filter = filtersFromSearchParams(Object.fromEntries(req.nextUrl.searchParams.entries()));
  return Response.json(getTimeseries(filter));
}
