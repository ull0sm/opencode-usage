import { getMeta } from "@/lib/db/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/usage/meta — row count, date range, distinct models/providers/sessions. */
export async function GET() {
  return Response.json(getMeta());
}
