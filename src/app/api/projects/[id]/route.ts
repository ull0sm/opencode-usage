import { NextRequest } from "next/server";
import { getProjectDetail, renameProject } from "@/lib/db/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/projects/[id] — aggregate detail for one project. */
export async function GET(_req: NextRequest, ctx: RouteContext<'/api/projects/[id]'>) {
  const { id } = await ctx.params;
  const projectId = decodeURIComponent(id);
  const detail = getProjectDetail(projectId);
  if (!detail) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  return Response.json(detail);
}

/** PATCH /api/projects/[id] { name } — set (or null to clear) a manual name. */
export async function PATCH(req: NextRequest, ctx: RouteContext<'/api/projects/[id]'>) {
  const { id } = await ctx.params;
  const projectId = decodeURIComponent(id);
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { name } = (body ?? {}) as { name?: unknown };
  if (name !== null && (typeof name !== "string" || name.trim().length === 0 || name.length > 200)) {
    return Response.json({ error: "name must be a non-empty string (max 200 chars) or null" }, { status: 400 });
  }
  const ok = renameProject(projectId, typeof name === "string" ? name.trim() : null);
  if (!ok) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  return Response.json({ project_id: projectId, name: typeof name === "string" ? name.trim() : null });
}
