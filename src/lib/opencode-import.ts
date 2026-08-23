import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { normalizeRecord } from "./validation";
import { insertRecords } from "./db/queries";
import type { UsageRecord } from "./types";

/** Locate OpenCode's local SQLite database (v2 storage). */
export function findOpencodeDb(): string | null {
  const candidates = [
    process.env.OPENCODE_DB,
    process.env.XDG_DATA_HOME
      ? path.join(process.env.XDG_DATA_HOME, "opencode", "opencode.db")
      : undefined,
    path.join(os.homedir(), ".local", "share", "opencode", "opencode.db"),
    path.join(os.homedir(), ".opencode", "opencode.db"),
  ].filter((p): p is string => Boolean(p));
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

interface RawMessageRow {
  id: string;
  session_id: string;
  time_created: number;
  data: string;
}

export interface OpencodeSessionInfo {
  id: string;
  title: string | null;
  directory: string | null;
  messages_imported: number;
}

export interface OpencodeImportStats {
  db_path: string;
  total_messages: number;
  assistant_messages: number;
  usable: number;
  inserted: number;
  skipped_duplicates: number;
  skipped_empty: number;
  errors: number;
  error_samples: string[];
  sessions: OpencodeSessionInfo[];
}

/**
 * Extract per-message token usage from OpenCode's own database and import it.
 * Opens a temp snapshot of the source DB (incl. WAL) so OpenCode can keep
 * running while we read. Dedupe relies on source_ref = "<sessionID>:<msgID>".
 */
export function importFromOpencode(dbPath?: string): OpencodeImportStats {
  const src = dbPath ?? findOpencodeDb();
  if (!src) {
    throw new Error(
      "OpenCode database not found (looked in ~/.local/share/opencode/opencode.db; set OPENCODE_DB to override)"
    );
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "opencode-import-"));
  try {
    // Snapshot the live DB. The -shm index must NOT be copied: a stale index
    // makes a readonly reader skip the -wal frames holding the newest writes.
    // We open the private copy read-write so SQLite can recover the WAL fully.
    for (const ext of ["", "-wal"]) {
      const p = src + ext;
      if (fs.existsSync(p)) fs.copyFileSync(p, path.join(tmpDir, "oc.db" + ext));
    }
    const odb = new Database(path.join(tmpDir, "oc.db"));

    const titles = new Map<string, { title: string | null; directory: string | null }>();
    try {
      const sessRows = odb.prepare("SELECT id, title, directory FROM session").all() as {
        id: string;
        title: string | null;
        directory: string | null;
      }[];
      for (const s of sessRows) titles.set(s.id, { title: s.title, directory: s.directory });
    } catch {
      // session table optional — titles are cosmetic
    }

    const rows = odb
      .prepare("SELECT id, session_id, time_created, data FROM message ORDER BY time_created ASC")
      .all() as RawMessageRow[];
    odb.close();

    const records: UsageRecord[] = [];
    let assistants = 0;
    let skippedEmpty = 0;
    let errors = 0;
    const errorSamples: string[] = [];

    for (const row of rows) {
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(row.data);
      } catch {
        errors += 1;
        errorSamples.push(`row ${row.id}: unparseable JSON`);
        continue;
      }
      if ((msg as { role?: string }).role !== "assistant") continue;
      assistants += 1;

      // Newer OpenCode builds keep id/sessionID only in table columns, not in
      // the JSON payload — backfill them so normalization can proceed.
      if (typeof msg.id !== "string" || !msg.id) msg.id = row.id;
      if (typeof msg.sessionID !== "string" || !msg.sessionID) msg.sessionID = row.session_id;

      const tokens = (msg.tokens ?? {}) as Record<string, unknown>;
      const cache = (tokens.cache ?? {}) as Record<string, unknown>;
      const sum =
        Number(tokens.input ?? 0) +
        Number(tokens.output ?? 0) +
        Number(tokens.reasoning ?? 0) +
        Number(cache.read ?? 0) +
        Number(cache.write ?? 0);
      if (sum === 0 && !msg.cost) {
        skippedEmpty += 1;
        continue;
      }

      // prefer the message's own timestamp; fall back to the table column (epoch ms)
      const withTime =
        typeof (msg.time as { created?: unknown } | undefined)?.created === "number"
          ? msg
          : { ...msg, time: { created: row.time_created } };

      const res = normalizeRecord(withTime);
      if (res.status === "record") records.push(res.record);
      else {
        errors += 1;
        const reason = res.status === "error" ? res.error : res.reason;
        if (errorSamples.length < 5) errorSamples.push(`row ${row.id}: ${reason}`);
      }
    }

    const { inserted, skipped } = insertRecords(records);

    const perSession = new Map<string, number>();
    for (const r of records) {
      if (!r.session_id) continue;
      perSession.set(r.session_id, (perSession.get(r.session_id) ?? 0) + 1);
    }

    return {
      db_path: src,
      total_messages: rows.length,
      assistant_messages: assistants,
      usable: records.length,
      inserted,
      skipped_duplicates: skipped,
      skipped_empty: skippedEmpty,
      errors,
      error_samples: errorSamples,
      sessions: [...perSession.entries()].map(([id, messages]) => ({
        id,
        title: titles.get(id)?.title ?? null,
        directory: titles.get(id)?.directory ?? null,
        messages_imported: messages,
      })),
    };
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}
