import { z } from "zod";
import crypto from "node:crypto";
import type { UsageRecord } from "./types";

const nonNegInt = z.number().int().nonnegative();

/**
 * Canonical flat record:
 * { timestamp, model, provider?, session_id?, input_tokens?, cache_read_tokens?,
 *   cache_write_tokens?, output_tokens?, reasoning_tokens?, cost?, source_ref? }
 */
const canonicalSchema = z
  .object({
    timestamp: z.union([z.string(), z.number()]),
    model: z.string().min(1),
    provider: z.string().nullish(),
    session_id: z.string().nullish(),
    input_tokens: nonNegInt.nullish(),
    cache_read_tokens: nonNegInt.nullish(),
    cache_write_tokens: nonNegInt.nullish(),
    output_tokens: nonNegInt.nullish(),
    reasoning_tokens: nonNegInt.nullish(),
    cost: z.number().nullish(),
    source_ref: z.string().nullish(),
    id: z.string().nullish(),
  })
  .loose();

/**
 * Native OpenCode assistant message:
 * { id, sessionID, modelID, providerID?, time: { created }, cost?,
 *   tokens: { input?, output?, reasoning?, cache?: { read?, write? } }, role? }
 */
const opencodeSchema = z
  .object({
    id: z.string().min(1),
    sessionID: z.string().min(1),
    modelID: z.string().min(1),
    providerID: z.string().nullish(),
    role: z.string().optional(),
    cost: z.number().nullish(),
    time: z.object({ created: z.number() }).loose(),
    tokens: z
      .object({
        input: nonNegInt.nullish(),
        output: nonNegInt.nullish(),
        reasoning: nonNegInt.nullish(),
        cache: z
          .object({ read: nonNegInt.nullish(), write: nonNegInt.nullish() })
          .loose()
          .nullish(),
      })
      .loose()
      .nullish(),
  })
  .loose();

export type NormalizeResult =
  | { status: "record"; record: UsageRecord }
  | { status: "ignored"; reason: string }
  | { status: "error"; error: string };

/** Parse a timestamp from ISO strings, epoch seconds or epoch milliseconds. */
function parseTimestamp(v: string | number): string | null {
  if (typeof v === "number") {
    if (!Number.isFinite(v)) return null;
    const ms = Math.abs(v) > 1e11 ? v : v * 1000;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  const raw = v.trim();
  if (!raw) return null;
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T00:00:00.000Z` : raw;
  const d = new Date(normalized);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function isOpencodeShape(o: object): boolean {
  return "modelID" in o || ("tokens" in o && "sessionID" in o);
}

/** Normalize one unknown payload (canonical flat, CSV row, or raw OpenCode message). */
export function normalizeRecord(input: unknown): NormalizeResult {
  if (typeof input !== "object" || input === null) {
    return { status: "error", error: "not an object" };
  }
  const obj = input as Record<string, unknown>;

  try {
    if (isOpencodeShape(obj)) {
      const parsed = opencodeSchema.safeParse(obj);
      if (!parsed.success) {
        return { status: "error", error: `invalid OpenCode message: ${parsed.error.issues[0]?.message}` };
      }
      const m = parsed.data;
      if (m.role && m.role !== "assistant") {
        return { status: "ignored", reason: `role "${m.role}" carries no usage` };
      }
      const t = m.tokens ?? {};
      const c = t.cache ?? {};
      const ts = parseTimestamp(m.time.created);
      if (!ts) return { status: "error", error: "invalid time.created" };
      return {
        status: "record",
        record: {
          ts,
          model: m.modelID,
          provider: m.providerID ?? null,
          session_id: m.sessionID,
          input_tokens: t.input ?? 0,
          cache_read_tokens: c.read ?? 0,
          cache_write_tokens: c.write ?? 0,
          output_tokens: t.output ?? 0,
          reasoning_tokens: t.reasoning ?? 0,
          cost: m.cost ?? null,
          source_ref: `${m.sessionID}:${m.id}`,
          raw_usage: JSON.stringify(obj),
        },
      };
    }

    // canonical / CSV row
    const parsed = canonicalSchema.safeParse(obj);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const where = issue?.path?.length ? ` (${issue.path.join(".")})` : "";
      return { status: "error", error: `${issue?.message ?? "validation failed"}${where}` };
    }
    const r = parsed.data;
    const ts = parseTimestamp(r.timestamp);
    if (!ts) return { status: "error", error: `invalid timestamp: ${String(r.timestamp)}` };
    return {
      status: "record",
      record: {
        ts,
        model: r.model,
        provider: r.provider ?? null,
        session_id: r.session_id ?? null,
        input_tokens: r.input_tokens ?? 0,
        cache_read_tokens: r.cache_read_tokens ?? 0,
        cache_write_tokens: r.cache_write_tokens ?? 0,
        output_tokens: r.output_tokens ?? 0,
        reasoning_tokens: r.reasoning_tokens ?? 0,
        cost: r.cost ?? null,
        source_ref: r.source_ref ?? r.id ?? null,
        raw_usage: null,
      },
    };
  } catch (e) {
    return { status: "error", error: e instanceof Error ? e.message : String(e) };
  }
}

/** Stable fingerprint for dedupe when no source_ref exists. */
export function contentHash(r: UsageRecord): string {
  const parts = [
    r.ts,
    r.model,
    r.provider ?? "",
    r.session_id ?? "",
    r.input_tokens,
    r.cache_read_tokens,
    r.cache_write_tokens,
    r.output_tokens,
    r.reasoning_tokens,
  ];
  return crypto.createHash("sha256").update(parts.join("|")).digest("hex");
}
