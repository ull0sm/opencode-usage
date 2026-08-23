import Papa from "papaparse";
import type { UsageRecord } from "./types";

/** Header aliases -> canonical field (case/separator insensitive). */
const FIELD_ALIASES: Record<string, string> = {
  timestamp: "timestamp",
  time: "timestamp",
  ts: "timestamp",
  date: "timestamp",
  model: "model",
  modelid: "model",
  provider: "provider",
  providerid: "provider",
  session_id: "session_id",
  sessionid: "session_id",
  session: "session_id",
  input_tokens: "input_tokens",
  inputtokens: "input_tokens",
  input: "input_tokens",
  cache_read_tokens: "cache_read_tokens",
  cachereadtokens: "cache_read_tokens",
  cache_read: "cache_read_tokens",
  cacheread: "cache_read_tokens",
  cache_write_tokens: "cache_write_tokens",
  cachewritetokens: "cache_write_tokens",
  cache_write: "cache_write_tokens",
  cachewrite: "cache_write_tokens",
  output_tokens: "output_tokens",
  outputtokens: "output_tokens",
  output: "output_tokens",
  reasoning_tokens: "reasoning_tokens",
  reasoningtokens: "reasoning_tokens",
  reasoning: "reasoning_tokens",
  cost: "cost",
  usd: "cost",
  source_ref: "source_ref",
  sourceref: "source_ref",
};

function canonicalKey(header: string): string {
  const norm = header.trim().toLowerCase().replace(/[\s-]+/g, "_");
  return FIELD_ALIASES[norm] ?? norm;
}

/** Parse CSV text into row objects keyed by canonical field names. */
export function parseCsvRows(text: string): Record<string, unknown>[] {
  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => canonicalKey(h),
  });
  if (result.errors.length && !result.data.length) {
    throw new Error(`CSV parse error: ${result.errors[0]?.message}`);
  }
  return result.data.map((row) => {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(row)) {
      if (v === undefined || v === null || v === "") continue;
      out[k] = k.endsWith("_tokens") ? Number(v) : k === "cost" ? Number(v) : v;
    }
    return out;
  });
}

export const CSV_COLUMNS = [
  "timestamp",
  "model",
  "provider",
  "session_id",
  "input_tokens",
  "cache_read_tokens",
  "cache_write_tokens",
  "output_tokens",
  "reasoning_tokens",
  "cost",
] as const;

export function recordsToCsv(
  rows: (UsageRecord | Record<string, unknown>)[],
  includeRaw = false
): string {
  const data = rows.map((r) => {
    const rec = r as Partial<UsageRecord>;
    const row: Record<string, unknown> = {
      timestamp: rec.ts ?? "",
      model: rec.model ?? "",
      provider: rec.provider ?? "",
      session_id: rec.session_id ?? "",
      input_tokens: rec.input_tokens ?? 0,
      cache_read_tokens: rec.cache_read_tokens ?? 0,
      cache_write_tokens: rec.cache_write_tokens ?? 0,
      output_tokens: rec.output_tokens ?? 0,
      reasoning_tokens: rec.reasoning_tokens ?? 0,
      cost: rec.cost ?? "",
    };
    if (includeRaw && rec.raw_usage != null) {
      row.raw_usage = rec.raw_usage;
    }
    return row;
  });
  const columns = includeRaw ? [...CSV_COLUMNS, "raw_usage"] : CSV_COLUMNS;
  return Papa.unparse(data, { columns: columns as unknown as string[] });
}
