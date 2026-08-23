#!/usr/bin/env node
/**
 * Tail a JSONL usage log and POST each line to /api/usage in near real-time.
 *
 *   node scripts/watch-opencode.mjs --file /path/to/usage.jsonl [--url http://localhost:3000] [--from-start]
 *
 * Env equivalents: OPENCODE_USAGE_LOG, TOKEN_ANALYSE_URL
 *
 * Each line must be a JSON object: either the canonical flat record or a raw
 * OpenCode assistant message — the API accepts both. Only complete lines are
 * sent; partial writes and log rotation/truncation are handled.
 */
import fs from "node:fs";
import path from "node:path";

function argValue(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : undefined;
}

const FILE = argValue("file") ?? process.env.OPENCODE_USAGE_LOG;
const BASE_URL = argValue("url") ?? process.env.TOKEN_ANALYSE_URL ?? "http://localhost:3000";
const FROM_START = process.argv.includes("--from-start");
const POLL_MS = 700;

if (!FILE) {
  console.error("usage: node scripts/watch-opencode.mjs --file <path-to-jsonl> [--url http://localhost:3000]");
  process.exit(1);
}
if (!fs.existsSync(FILE)) {
  console.error(`[watcher] file not found: ${FILE}`);
  process.exit(1);
}

const endpoint = `${BASE_URL.replace(/\/$/, "")}/api/usage`;
let offset = FROM_START ? 0 : fs.statSync(FILE).size;
let pending = ""; // partial-line buffer
let queue = Promise.resolve();
let stopping = false;

console.log(`[watcher] tailing ${path.resolve(FILE)} → POST ${endpoint}`);

async function postRecord(obj, lineNo) {
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(obj),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        console.warn(`[watcher] line ${lineNo} rejected (${res.status}): ${JSON.stringify(data).slice(0, 200)}`);
        return;
      }
      if (data.inserted > 0 || data.skipped_duplicates > 0) {
        console.log(
          `[watcher] line ${lineNo}: +${data.inserted} inserted` +
            (data.skipped_duplicates ? `, ${data.skipped_duplicates} duplicate(s)` : "")
        );
      }
      return;
    } catch (err) {
      // server probably restarting — retry with backoff
      console.warn(`[watcher] POST failed (attempt ${attempt}/5): ${err.message}`);
      await new Promise((r) => setTimeout(r, attempt * 1000));
    }
  }
  console.error(`[watcher] giving up on line ${lineNo}: ${JSON.stringify(obj).slice(0, 120)}…`);
}

function processChunk(chunk) {
  pending += chunk;
  const lines = pending.split(/\r?\n/);
  pending = lines.pop() ?? ""; // keep trailing partial line
  let lineNo = 0;
  for (const line of lines) {
    lineNo++;
    const t = line.trim();
    if (!t) continue;
    let obj;
    try {
      obj = JSON.parse(t);
    } catch {
      console.warn(`[watcher] line ${lineNo}: not JSON, skipped`);
      continue;
    }
    // serialize posts so records land in order even during retries
    queue = queue.then(() => postRecord(obj, lineNo));
  }
}

function poll() {
  if (stopping) return;
  try {
    const size = fs.statSync(FILE).size;
    if (size < offset) {
      // truncated / rotated — start over from the beginning
      console.log("[watcher] file truncated or rotated; re-reading from start");
      offset = 0;
      pending = "";
    }
    if (size > offset) {
      const stream = fs.createReadStream(FILE, { encoding: "utf8", start: offset });
      stream.on("data", (chunk) => {
        offset += Buffer.byteLength(chunk, "utf8");
        processChunk(chunk);
      });
    }
  } catch (err) {
    // file may be temporarily missing (rotation)
    console.warn(`[watcher] stat failed: ${err.message}`);
  }
  setTimeout(poll, POLL_MS);
}
poll();

process.on("SIGINT", () => {
  stopping = true;
  console.log("\n[watcher] stopped");
  process.exit(0);
});
