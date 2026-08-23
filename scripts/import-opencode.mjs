#!/usr/bin/env node
/**
 * Import real token usage straight from OpenCode's local storage
 * (~/.local/share/opencode/opencode.db) into this app's database.
 *
 *   node scripts/import-opencode.mjs [--db /path/to/opencode.db]
 *
 * Reads a temp snapshot of the source DB, so OpenCode can be running.
 * Safe to re-run: duplicates are skipped via source_ref.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const APP_DB = process.env.TOKEN_ANALYSE_DB ?? path.join(ROOT, "data", "usage.db");

const dbArgIdx = process.argv.indexOf("--db");
const cliPath = dbArgIdx !== -1 && process.argv[dbArgIdx + 1];
const SOURCE_DB = cliPath
  ? path.resolve(cliPath)
  : (process.env.OPENCODE_DB ??
    (process.env.XDG_DATA_HOME
      ? path.join(process.env.XDG_DATA_HOME, "opencode", "opencode.db")
      : path.join(os.homedir(), ".local", "share", "opencode", "opencode.db")));

if (!fs.existsSync(SOURCE_DB)) {
  console.error(`OpenCode DB not found at ${SOURCE_DB} (use --db <path>)`);
  process.exit(1);
}

// snapshot source incl. WAL (never the -shm index — see below)
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "opencode-import-"));
for (const ext of ["", "-wal"]) {
  const p = SOURCE_DB + ext;
  if (fs.existsSync(p)) fs.copyFileSync(p, path.join(tmpDir, "oc.db" + ext));
}
// open the private copy READ-WRITE (no readonly!) so SQLite recovers the WAL
// frames; opening readonly with a missing/stale shm can silently ignore them
const src = new Database(path.join(tmpDir, "oc.db"));
src.pragma("busy_timeout = 3000");

const rows = src.prepare("SELECT id, session_id, time_created, data FROM message ORDER BY time_created ASC").all();
src.close();

fs.mkdirSync(path.dirname(APP_DB), { recursive: true });
const app = new Database(APP_DB);
app.pragma("journal_mode = WAL");
app.exec(fs.readFileSync(path.join(ROOT, "src", "lib", "db", "schema.sql"), "utf8"));

const insert = app.prepare(`
  INSERT OR IGNORE INTO usage_events
    (ts, model, provider, session_id,
     input_tokens, cache_read_tokens, cache_write_tokens, output_tokens, reasoning_tokens,
     cost, content_hash, source_ref, raw_usage)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

let assistants = 0;
let inserted = 0;
let skippedDupes = 0;
let skippedEmpty = 0;
let errors = 0;
const perSession = new Map();

const run = app.transaction(() => {
  for (const row of rows) {
    let msg;
    try {
      msg = JSON.parse(row.data);
    } catch {
      errors++;
      continue;
    }
    if (msg.role !== "assistant") continue;
    assistants++;

    const t = msg.tokens ?? {};
    const c = t.cache ?? {};
    const sum = (t.input ?? 0) + (t.output ?? 0) + (t.reasoning ?? 0) + (c.read ?? 0) + (c.write ?? 0);
    if (sum === 0 && !msg.cost) {
      skippedEmpty++;
      continue;
    }

    // epoch ms → ISO; prefer the message's own time, fall back to table column
    const createdMs = typeof msg.time?.created === "number" ? msg.time.created : row.time_created;

    let ts;
    try {
      ts = new Date(createdMs).toISOString();
    } catch {
      errors++;
      continue;
    }

    const model = String(msg.modelID ?? "");
    if (!model) {
      errors++;
      continue;
    }
    const provider = typeof msg.providerID === "string" && msg.providerID ? msg.providerID : null;
    const sessionId = String(msg.session_id || row.session_id);
    const input = Number(t.input ?? 0);
    const cacheRead = Number(c.read ?? 0);
    const cacheWrite = Number(c.write ?? 0);
    const output = Number(t.output ?? 0);
    const reasoning = Number(t.reasoning ?? 0);
    const cost = typeof msg.cost === "number" && Number.isFinite(msg.cost) ? msg.cost : null;

    const hash = crypto.createHash("sha256").update([ts, model, provider ?? "", sessionId, input, cacheRead, cacheWrite, output, reasoning].join("|")).digest("hex");
    const info = insert.run(
      ts, model, provider, sessionId,
      input, cacheRead, cacheWrite, output, reasoning,
      cost, hash, `${sessionId}:${row.id}`, row.data
    );
    if (info.changes > 0) {
      inserted++;
      perSession.set(sessionId, (perSession.get(sessionId) ?? 0) + 1);
    } else {
      skippedDupes++;
    }
  }
});
run();

console.log(`source : ${SOURCE_DB}`);
console.log(`scanned: ${rows.length} messages (${assistants} assistant, ${skippedEmpty} empty, ${errors} errors)`);
console.log(`imported: ${inserted} records (${skippedDupes} duplicates already present)`);
for (const [id, n] of perSession) console.log(`  ${id}: ${n} message(s)`);

app.close();
fs.rmSync(tmpDir, { recursive: true, force: true });
