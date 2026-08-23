import { NextRequest } from "next/server";
import { filtersFromSearchParams } from "@/lib/filters";
import { getByHourOfDay } from "@/lib/db/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/stats/by-hour?tz=-330 — buckets on the viewer's local clock. */
export async function GET(req: NextRequest) {
  const filter = filtersFromSearchParams(Object.fromEntries(req.nextUrl.searchParams.entries()));
  let shift = 0;
  const tzRaw = req.nextUrl.searchParams.get("tz");
  if (tzRaw !== null && tzRaw !== "") {
    const tz = Number.parseInt(tzRaw, 10);
    if (Number.isFinite(tz) && tz >= -840 && tz <= 840) shift = -tz;
  }
  return Response.json(getByHourOfDay(filter, shift));
}
