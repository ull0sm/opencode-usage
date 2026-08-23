import { NextRequest } from "next/server";
import { getUsageById } from "@/lib/db/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/usage/[id] — a single usage event, including raw_usage. */
export async function GET(_req: NextRequest, ctx: RouteContext<'/api/usage/[id]'>) {
  const { id } = await ctx.params;
  const numericId = Number.parseInt(id, 10);
  if (!Number.isFinite(numericId)) {
    return Response.json({ error: "Invalid id" }, { status: 400 });
  }
  const row = getUsageById(numericId);
  if (!row) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  return Response.json(row);
}
