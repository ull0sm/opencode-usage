import { NextRequest } from "next/server";
import { filtersFromSearchParams } from "@/lib/filters";
import { getTimeseries } from "@/lib/db/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/stats/timeseries?tz=-330 — daily buckets in the viewer's calendar days. */
export async function GET(req: NextRequest) {
  const filter = filtersFromSearchParams(Object.fromEntries(req.nextUrl.searchParams.entries()));
  // JS getTimezoneOffset() convention: IST (+05:30) reports -330; shift by its negation
  const tzRaw = req.nextUrl.searchParams.get("tz");
  let shift = 0;
  if (tzRaw !== null && tzRaw !== "") {
    const tz = Number.parseInt(tzRaw, 10);
    if (Number.isFinite(tz) && tz >= -840 && tz <= 840) shift = -tz;
  }
  return Response.json(getTimeseries(filter, shift));
}
