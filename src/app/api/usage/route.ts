import { NextRequest } from "next/server";
import { filtersFromSearchParams } from "@/lib/filters";
import { listUsage } from "@/lib/db/queries";
import { normalizeRecord } from "@/lib/validation";
import type { UsageRecord } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/usage — insert one usage record or an array of records.
 * Accepts canonical flat records or raw OpenCode assistant messages.
 */
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const items = Array.isArray(body) ? body : [body];
  if (!items.length) return Response.json({ error: "empty payload" }, { status: 400 });

  const records: UsageRecord[] = [];
  const errors: { index: number; error: string }[] = [];
  let ignored = 0;

  for (let i = 0; i < items.length; i++) {
    const res = normalizeRecord(items[i]);
    if (res.status === "record") records.push(res.record);
    else if (res.status === "ignored") ignored += 1;
    else errors.push({ index: i, error: res.error });
  }

  const { insertRecords } = await import("@/lib/db/queries");
  const { inserted, skipped } = insertRecords(records);

  return Response.json({
    inserted,
    skipped_duplicates: skipped,
    ignored,
    accepted: records.length,
    total: items.length,
    ...(errors.length ? { errors } : {}),
  });
}

const SORT_COLUMNS = new Set([
  "ts",
  "model",
  "provider",
  "session_id",
  "input_tokens",
  "cache_read_tokens",
  "cache_write_tokens",
  "output_tokens",
  "reasoning_tokens",
  "cost",
]);

/** GET /api/usage — paginated, sorted, filtered rows. */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const filter = filtersFromSearchParams(Object.fromEntries(sp.entries()));
  const sort = sp.get("sort") ?? "ts";
  const dir = sp.get("dir") ?? "desc";
  const page = Number.parseInt(sp.get("page") ?? "1", 10) || 1;
  const pageSize = Number.parseInt(sp.get("page_size") ?? "25", 10) || 25;

  const result = listUsage({
    filter,
    page,
    pageSize,
    sort: SORT_COLUMNS.has(sort) ? sort : "ts",
    dir: dir === "asc" ? "asc" : "desc",
  });

  return Response.json(result);
}
