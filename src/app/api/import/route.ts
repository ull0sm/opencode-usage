import { NextRequest } from "next/server";
import { parseCsvRows } from "@/lib/csv";
import { normalizeRecord } from "@/lib/validation";
import { insertRecords } from "@/lib/db/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 50 * 1024 * 1024;

function looksLikeJson(text: string): boolean {
  const t = text.trimStart();
  return t.startsWith("[") || t.startsWith("{");
}

function parseNdjson(text: string): unknown[] {
  const out: unknown[] = [];
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (!t) continue;
    try {
      out.push(JSON.parse(t));
    } catch {
      out.push({ __invalid: t.slice(0, 100) });
    }
  }
  return out;
}

function unwrapItems(parsed: unknown): unknown[] {
  if (Array.isArray(parsed)) return parsed;
  if (typeof parsed === "object" && parsed !== null) {
    const o = parsed as Record<string, unknown>;
    // common OpenCode export wrappers
    if ("messages" in o && Array.isArray(o.messages)) return o.messages;
    if ("info" in o && typeof o.info === "object") return [o]; // single WithParts message
  }
  return [parsed];
}

async function readPayload(
  req: NextRequest
): Promise<{ text: string; dryRun: boolean } | { error: string; status: number }> {
  const contentType = req.headers.get("content-type") ?? "";
  const dryRun = req.nextUrl.searchParams.get("dry_run") === "true";

  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return { error: "missing 'file' field", status: 400 };
    if (file.size > MAX_BODY_BYTES) return { error: "file exceeds 50MB limit", status: 413 };
    const dry = form.get("dry_run");
    return { text: await file.text(), dryRun: dryRun || dry === "true" };
  }

  const text = await req.text();
  if (!text.trim()) return { error: "empty body", status: 400 };
  if (Buffer.byteLength(text) > MAX_BODY_BYTES) return { error: "body exceeds 50MB limit", status: 413 };
  return { text, dryRun };
}

/**
 * POST /api/import[?dry_run=true]
 * Accepts multipart form-data with a `file` field, or a raw text body.
 * Auto-detects: JSON array/object (canonical or OpenCode native), NDJSON, CSV.
 */
export async function POST(req: NextRequest) {
  const payload = await readPayload(req);
  if ("error" in payload) return Response.json({ error: payload.error }, { status: payload.status });

  let items: unknown[];
  let format: string;
  const text = payload.text.trimStart();

  if (looksLikeJson(text)) {
    try {
      items = unwrapItems(JSON.parse(payload.text));
      format = "json";
    } catch {
      items = parseNdjson(payload.text);
      format = "ndjson";
    }
  } else {
    try {
      items = parseCsvRows(payload.text);
      format = "csv";
    } catch (e) {
      return Response.json(
        { error: `unable to parse input as JSON, NDJSON or CSV: ${e instanceof Error ? e.message : e}` },
        { status: 400 }
      );
    }
  }

  const records = [];
  const errors: { index: number; error: string }[] = [];
  let ignored = 0;
  for (let i = 0; i < items.length; i++) {
    const res = normalizeRecord(items[i]);
    if (res.status === "record") records.push(res.record);
    else if (res.status === "ignored") ignored += 1;
    else errors.push({ index: i, error: res.error });
  }

  if (payload.dryRun) {
    return Response.json({
      dry_run: true,
      format,
      total: items.length,
      accepted: records.length,
      ignored,
      errors: errors.slice(0, 20),
      preview: records.slice(0, 20),
    });
  }

  const { inserted, skipped } = insertRecords(records);
  return Response.json({
    dry_run: false,
    format,
    total: items.length,
    accepted: records.length,
    ignored,
    inserted,
    skipped_duplicates: skipped,
    errors: errors.slice(0, 50),
  });
}

