import { NextRequest } from "next/server";
import { filtersFromSearchParams } from "@/lib/filters";
import { getSummary } from "@/lib/db/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/stats/summary — totals for the current filter set. */
export async function GET(req: NextRequest) {
  const filter = filtersFromSearchParams(Object.fromEntries(req.nextUrl.searchParams.entries()));
  return Response.json(getSummary(filter));
}
