import { importFromOpencode } from "@/lib/opencode-import";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/import/opencode
 * Reads OpenCode's local storage (~/.local/share/opencode/opencode.db) and
 * imports every assistant message's token usage. Safe to run repeatedly —
 * duplicates are skipped via source_ref.
 */
export async function POST() {
  try {
    const stats = importFromOpencode();
    return Response.json(stats);
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
