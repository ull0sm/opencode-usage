import { resetDb } from "@/lib/db/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/db/reset — delete ALL usage rows. */
export async function POST() {
  const deleted = resetDb();
  return Response.json({ ok: true, deleted });
}
