import { NextRequest } from "next/server";
import { filtersFromSearchParams } from "@/lib/filters";
import { getBySession } from "@/lib/db/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/stats/by-session?limit=10 — top sessions by total tokens. */
export async function GET(req: NextRequest) {
  const filter = filtersFromSearchParams(Object.fromEntries(req.nextUrl.searchParams.entries()));
  const limit = Number.parseInt(req.nextUrl.searchParams.get("limit") ?? "10", 10) || 10;
  return Response.json(getBySession(filter, Math.min(limit, 100)));
}
