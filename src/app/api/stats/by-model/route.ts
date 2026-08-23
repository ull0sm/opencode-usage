import { NextRequest } from "next/server";
import { filtersFromSearchParams } from "@/lib/filters";
import { getByModel } from "@/lib/db/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/stats/by-model?limit=12 — token composition per model. */
export async function GET(req: NextRequest) {
  const filter = filtersFromSearchParams(Object.fromEntries(req.nextUrl.searchParams.entries()));
  const limit = Number.parseInt(req.nextUrl.searchParams.get("limit") ?? "12", 10) || 12;
  return Response.json(getByModel(filter, Math.min(limit, 100)));
}
