import { NextRequest } from "next/server";
import { getSessionDetail, renameSession } from "@/lib/db/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/sessions/[id] — aggregate detail for one session. */
export async function GET(_req: NextRequest, ctx: RouteContext<'/api/sessions/[id]'>) {
  const { id } = await ctx.params;
  const sessionId = decodeURIComponent(id);
  const detail = getSessionDetail(sessionId);
  if (!detail) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  return Response.json(detail);
}

/** PATCH /api/sessions/[id] { title } — set (or null to clear) a manual name. */
export async function PATCH(req: NextRequest, ctx: RouteContext<'/api/sessions/[id]'>) {
  const { id } = await ctx.params;
  const sessionId = decodeURIComponent(id);
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { title } = (body ?? {}) as { title?: unknown };
  if (title !== null && (typeof title !== "string" || title.trim().length === 0 || title.length > 200)) {
    return Response.json({ error: "title must be a non-empty string (max 200 chars) or null" }, { status: 400 });
  }
  const ok = renameSession(sessionId, typeof title === "string" ? title.trim() : null);
  if (!ok) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  return Response.json({ session_id: sessionId, title: typeof title === "string" ? title.trim() : null });
}
