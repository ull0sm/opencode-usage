import { NextRequest } from "next/server";
import { filtersFromSearchParams } from "@/lib/filters";
import { getByProject } from "@/lib/db/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/stats/by-project?limit=10 — token usage grouped by project. */
export async function GET(req: NextRequest) {
  const filter = filtersFromSearchParams(Object.fromEntries(req.nextUrl.searchParams.entries()));
  const limit = Number.parseInt(req.nextUrl.searchParams.get("limit") ?? "10", 10) || 10;
  return Response.json(getByProject(filter, Math.min(limit, 100)));
}
