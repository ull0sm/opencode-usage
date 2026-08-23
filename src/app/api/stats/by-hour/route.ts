import { NextRequest } from "next/server";
import { filtersFromSearchParams } from "@/lib/filters";
import { getByHourOfDay } from "@/lib/db/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/stats/by-hour — request counts and token volume by hour of day (UTC). */
export async function GET(req: NextRequest) {
  const filter = filtersFromSearchParams(Object.fromEntries(req.nextUrl.searchParams.entries()));
  return Response.json(getByHourOfDay(filter));
}
