#!/usr/bin/env node
/**
 * Seed the local SQLite DB with realistic random OpenCode-style usage data.
 *
 *   node scripts/seed.mjs [--days 30] [--min 4] [--max 14] [--reset]
 *
 * Inserts directly into data/usage.db (no dev server needed).
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const DB_PATH = process.env.TOKEN_ANALYSE_DB ?? path.join(ROOT, "data", "usage.db");

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? Number(process.argv[i + 1]) : fallback;
}
const flag = (name) => process.argv.includes(`--${name}`);

const DAYS = arg("days", 30);
const MIN_PER_DAY = arg("min", 4);
const MAX_PER_DAY = arg("max", 14);
const RESET = flag("reset");

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.exec(fs.readFileSync(path.join(ROOT, "src", "lib", "db", "schema.sql"), "utf8"));

if (RESET) {
  const n = db.prepare("DELETE FROM usage_events").run().changes;
  console.log(`reset: deleted ${n} existing rows`);
}

// model pool: [modelID, providerID, reasoning-capable?, cache-heavy?]
const MODELS = [
  ["claude-sonnet-4-5", "anthropic", true, true],
  ["claude-opus-4-1", "anthropic", true, true],
  ["claude-haiku-4-5", "anthropic", false, false],
  ["gpt-5", "openai", true, false],
  ["o4-mini", "openai", true, false],
];

const rnd = (min, max) => min + Math.floor(Math.random() * (max - min + 1));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// generate a handful of sessions spanning contiguous day ranges
const SESSIONS = [];
for (let i = 0; i < 8; i++) {
  const startDay = Math.floor(Math.random() * DAYS);
  const lengthDays = rnd(0, Math.min(4, DAYS - startDay));
  SESSIONS.push({
    id: `ses_${crypto.randomBytes(6).toString("hex")}`,
    startDay,
    endDay: startDay + lengthDays,
    modelBias: Math.random(),
  });
}

const insert = db.prepare(`
  INSERT OR IGNORE INTO usage_events
    (ts, model, provider, session_id,
     input_tokens, cache_read_tokens, cache_write_tokens, output_tokens, reasoning_tokens,
     cost, content_hash, source_ref, raw_usage)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

let count = 0;
const tx = db.transaction(() => {
  for (let d = DAYS - 1; d >= 0; d--) {
    const n = rnd(MIN_PER_DAY, MAX_PER_DAY);
    for ( let j = 0; j < n; j++) {
      const [model, provider, reasons, caches] = pick(MODELS);
      // session continuity: bias towards a session active today
      const candidates = SESSIONS.filter((s) => d >= DAYS - 1 - s.endDay && d <= DAYS - 1 - s.startDay);
      const session = Math.random() < 0.75 && candidates.length ? pick(candidates).id : null;

      const dayStart = new Date();
      dayStart.setUTCDate(dayStart.getUTCDate() - d);
      // never generate timestamps in the future: cap "today" at the current UTC hour
      const maxHour = d === 0 ? new Date().getUTCHours() : 22;
      dayStart.setUTCHours(rnd(7, Math.max(maxHour, 7)), rnd(0, 59), rnd(0, 59), rnd(0, 999));
      const ts = dayStart.toISOString();

      const input = rnd(600, 6000);
      const cacheRead = caches ? (Math.random() < 0.8 ? rnd(4000, 90000) : 0) : rnd(0, 12000);
      const cacheWrite = caches ? (Math.random() < 0.5 ? rnd(500, 15000) : 0) : 0;
      const output = rnd(150, 2600);
      const reasoning = reasons ? (Math.random() < 0.65 ? rnd(100, 3200) : 0) : 0;

      // plausible cost in USD
      const rate = provider === "anthropic" ? 3 : 2; // $/M input-ish blend
      const cost =
        Math.round(
          ((input + cacheWrite / 2) * rate +
            cacheRead * rate * 0.1 +
            (output + reasoning) * rate * 4) /
            1e6 *
            1e4
        ) / 1e4;

      const msgId = `msg_${crypto.randomBytes(8).toString("hex")}`;
      const sessionId = session ?? `ses_${crypto.randomBytes(6).toString("hex")}`;
      const sourceRef = `${sessionId}:${msgId}`;

      const raw = JSON.stringify({
        id: msgId,
        role: "assistant",
        sessionID: sessionId,
        modelID: model,
        providerID: provider,
        time: { created: Date.parse(ts) },
        cost,
        tokens: {
          input,
          output,
          reasoning,
          cache: { read: cacheRead, write: cacheWrite },
        },
      });

      const hash = crypto
        .createHash("sha256")
        .update([ts, model, provider, sessionId, input, cacheRead, cacheWrite, output, reasoning].join("|"))
        .digest("hex");

      insert.run(ts, model, provider, sessionId, input, cacheRead, cacheWrite, output, reasoning, cost, hash, sourceRef, raw);
      count++;
    }
  }
});
tx();

console.log(`seeded ${count} usage records into ${DB_PATH}`);
db.close();
