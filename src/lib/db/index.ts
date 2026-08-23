import path from "node:path";
import fs from "node:fs";
import Database from "better-sqlite3";

const DB_DIR = process.env.TOKEN_ANALYSE_DATA_DIR ?? path.join(process.cwd(), "data");
export const DB_PATH =
  process.env.TOKEN_ANALYSE_DB ?? path.join(DB_DIR, "usage.db");

declare global {
  var __tokenAnalyseDb: Database.Database | undefined;
}

function create(): Database.Database {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.exec(loadSchema());
  return db;
}

function loadSchema(): string {
  const candidates = [
    path.join(process.cwd(), "src", "lib", "db", "schema.sql"),
    path.join(__dirname, "schema.sql"),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return fs.readFileSync(/* turbopackIgnore: true */ p, "utf8");
  }
  throw new Error(`schema.sql not found (tried: ${candidates.join(", ")})`);
}

/** Singleton connection that survives dev-server HMR. */
export function getDb(): Database.Database {
  if (!globalThis.__tokenAnalyseDb) globalThis.__tokenAnalyseDb = create();
  return globalThis.__tokenAnalyseDb;
}
