import { getDb } from "./index";
import { contentHash } from "../validation";
import type {
  EfficiencyStats,
  HourBucket,
  ModelBreakdown,
  ModelEfficiencyRow,
  ProjectBreakdown,
  ProjectDetail,
  SessionBreakdown,
  SessionListItem,
  SummaryRow,
  TimeseriesPoint,
  UsageRecord,
} from "../types";
import { buildWhere, type UsageFilters } from "../filters";

export interface InsertOutcome {
  inserted: number;
  skipped: number;
}

const INSERT_SQL = `
  INSERT OR IGNORE INTO usage_events
    (ts, model, provider, session_id,
     input_tokens, cache_read_tokens, cache_write_tokens, output_tokens, reasoning_tokens,
     cost, content_hash, source_ref, raw_usage)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`;

export function insertRecords(records: UsageRecord[]): InsertOutcome {
  const db = getDb();
  const stmt = db.prepare(INSERT_SQL);
  let inserted = 0;
  let skipped = 0;
  const insertAll = db.transaction((recs: UsageRecord[]) => {
    for (const r of recs) {
      const hash = r.source_ref ?? contentHash(r);
      const info = stmt.run(
        r.ts,
        r.model,
        r.provider,
        r.session_id,
        r.input_tokens,
        r.cache_read_tokens,
        r.cache_write_tokens,
        r.output_tokens,
        r.reasoning_tokens,
        r.cost,
        hash,
        r.source_ref,
        r.raw_usage
      );
      if (info.changes > 0) inserted += 1;
      else skipped += 1;
    }
  });
  insertAll(records);
  return { inserted, skipped };
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

export interface ListOptions {
  filter: UsageFilters;
  page?: number;
  pageSize?: number;
  sort?: string;
  dir?: string;
}

export function listUsage(opts: ListOptions) {
  const db = getDb();
  const { sql: where, params } = buildWhere(opts.filter);
  const sortCol = SORT_COLUMNS.has(opts.sort ?? "") ? opts.sort! : "ts";
  const dir = opts.dir?.toLowerCase() === "asc" ? "ASC" : "DESC";
  const pageSize = Math.min(Math.max(opts.pageSize ?? 25, 1), 500);
  const page = Math.max(opts.page ?? 1, 1);
  const offset = (page - 1) * pageSize;

  const total = (
    db.prepare(`SELECT COUNT(*) AS n FROM usage_events ${where}`).get(...params) as { n: number }
  ).n;
  const rows = db
    .prepare(
      `SELECT *,
              (SELECT COALESCE(s.title_override, s.title, s.slug)
               FROM sessions s WHERE s.session_id = usage_events.session_id) AS session_title,
              (SELECT COALESCE(p.name_override, p.name, NULLIF(p.worktree, '/'))
               FROM sessions s2 JOIN projects p ON p.project_id = s2.project_id
               WHERE s2.session_id = usage_events.session_id) AS project_name
       FROM usage_events ${where}
       ORDER BY ${sortCol} ${dir}, id DESC LIMIT ? OFFSET ?`
    )
    .all(...params, pageSize, offset);

  return { rows, total, page, page_size: pageSize };
}

const SUM_SELECT = `
  COUNT(*) AS requests,
  COALESCE(SUM(input_tokens), 0) AS input_tokens,
  COALESCE(SUM(cache_read_tokens), 0) AS cache_read_tokens,
  COALESCE(SUM(cache_write_tokens), 0) AS cache_write_tokens,
  COALESCE(SUM(output_tokens), 0) AS output_tokens,
  COALESCE(SUM(reasoning_tokens), 0) AS reasoning_tokens,
  COALESCE(SUM(cost), 0) AS cost
`;

export function getSummary(filter: UsageFilters): SummaryRow {
  const db = getDb();
  const { sql: where, params } = buildWhere(filter);
  return db.prepare(`SELECT ${SUM_SELECT} FROM usage_events ${where}`).get(...params) as SummaryRow;
}

/**
 * Daily token buckets. `dayShiftMinutes` shifts the day boundary so days are
 * grouped by the viewer's calendar (pass +330 for IST / UTC+05:30).
 */
export function getTimeseries(filter: UsageFilters, dayShiftMinutes = 0): TimeseriesPoint[] {
  const db = getDb();
  const { sql: where, params } = buildWhere(filter);
  const shiftParams: string[] = [];
  let dateExpr = `strftime('%Y-%m-%d', ts)`;
  if (dayShiftMinutes !== 0 && Number.isFinite(dayShiftMinutes)) {
    dateExpr = `strftime('%Y-%m-%d', ts, ?)`;
    shiftParams.push(`${Math.trunc(dayShiftMinutes)} minutes`);
  }
  return db
    .prepare(
      `SELECT ${dateExpr} AS date, ${SUM_SELECT}
       FROM usage_events ${where}
       GROUP BY date ORDER BY date ASC`
    )
    .all(...shiftParams, ...params) as TimeseriesPoint[];
}

export function getByModel(filter: UsageFilters, limit = 12): ModelBreakdown[] {
  const db = getDb();
  const { sql: where, params } = buildWhere(filter);
  return db
    .prepare(
      `SELECT model,
              COUNT(*) AS requests,
              COALESCE(SUM(input_tokens), 0) AS input_tokens,
              COALESCE(SUM(cache_read_tokens), 0) AS cache_read_tokens,
              COALESCE(SUM(output_tokens), 0) AS output_tokens,
              COALESCE(SUM(reasoning_tokens), 0) AS reasoning_tokens,
              COALESCE(SUM(cost), 0) AS cost
       FROM usage_events ${where}
       GROUP BY model
       ORDER BY SUM(output_tokens + reasoning_tokens + input_tokens + cache_read_tokens + cache_write_tokens) DESC
       LIMIT ?`
    )
    .all(...params, limit) as ModelBreakdown[];
}

export function getBySession(filter: UsageFilters, limit = 10): SessionBreakdown[] {
  const db = getDb();
  const { sql: where, params } = buildWhere(filter);
  return db
    .prepare(
      `SELECT usage_events.session_id,
              COALESCE(s.title_override, s.title) AS title,
              s.slug AS slug,
              s.project_id AS project_id,
              COALESCE(p.name_override, p.name, NULLIF(p.worktree, '/')) AS project_name,
              COUNT(*) AS requests,
              COALESCE(SUM(input_tokens), 0) AS input_tokens,
              COALESCE(SUM(cache_read_tokens), 0) AS cache_read_tokens,
              COALESCE(SUM(output_tokens), 0) AS output_tokens,
              COALESCE(SUM(reasoning_tokens), 0) AS reasoning_tokens,
              COALESCE(SUM(cost), 0) AS cost,
              MAX(ts) AS last_ts
       FROM usage_events
       LEFT JOIN sessions s ON s.session_id = usage_events.session_id
       LEFT JOIN projects p ON p.project_id = s.project_id
       ${where}
       GROUP BY usage_events.session_id
       ORDER BY SUM(output_tokens + reasoning_tokens + input_tokens + cache_read_tokens + cache_write_tokens) DESC
       LIMIT ?`
    )
    .all(...params, limit) as SessionBreakdown[];
}

export function getByProject(filter: UsageFilters, limit = 10): ProjectBreakdown[] {
  const db = getDb();
  const { sql: where, params } = buildWhere(filter);
  return db
    .prepare(
      `SELECT s.project_id AS project_id,
              COALESCE(p.name_override, p.name, NULLIF(p.worktree, '/')) AS name,
              p.worktree AS worktree,
              COUNT(DISTINCT usage_events.session_id) AS sessions,
              COUNT(*) AS requests,
              COALESCE(SUM(input_tokens), 0) AS input_tokens,
              COALESCE(SUM(cache_read_tokens), 0) AS cache_read_tokens,
              COALESCE(SUM(output_tokens), 0) AS output_tokens,
              COALESCE(SUM(reasoning_tokens), 0) AS reasoning_tokens,
              COALESCE(SUM(cost), 0) AS cost,
              MAX(ts) AS last_ts
       FROM usage_events
       LEFT JOIN sessions s ON s.session_id = usage_events.session_id
       LEFT JOIN projects p ON p.project_id = s.project_id
       ${where}
       GROUP BY s.project_id
       ORDER BY SUM(output_tokens + reasoning_tokens + input_tokens + cache_read_tokens + cache_write_tokens) DESC
       LIMIT ?`
    )
    .all(...params, limit) as ProjectBreakdown[];
}

/** Hour-of-day buckets; `dayShiftMinutes` shifts to the viewer's local clock. */
export function getByHourOfDay(filter: UsageFilters, dayShiftMinutes = 0): HourBucket[] {
  const db = getDb();
  const { sql: where, params } = buildWhere(filter);
  const shiftParams: string[] = [];
  let hourExpr = `strftime('%H', ts)`;
  if (dayShiftMinutes !== 0 && Number.isFinite(dayShiftMinutes)) {
    hourExpr = `strftime('%H', ts, ?)`;
    shiftParams.push(`${Math.trunc(dayShiftMinutes)} minutes`);
  }
  return db
    .prepare(
      `SELECT ${hourExpr} AS hour,
              COUNT(*) AS requests,
              COALESCE(SUM(input_tokens), 0) AS input_tokens,
              COALESCE(SUM(cache_read_tokens), 0) AS cache_read_tokens,
              COALESCE(SUM(output_tokens), 0) AS output_tokens,
              COALESCE(SUM(reasoning_tokens), 0) AS reasoning_tokens,
              COALESCE(SUM(input_tokens + cache_read_tokens + output_tokens + reasoning_tokens), 0) AS tokens
       FROM usage_events ${where}
       GROUP BY hour ORDER BY hour ASC`
    )
    .all(...shiftParams, ...params) as HourBucket[];
}

export function getMeta() {
  const db = getDb();
  const stats = db
    .prepare(`SELECT COUNT(*) AS row_count, MIN(ts) AS first_ts, MAX(ts) AS last_ts FROM usage_events`)
    .get() as { row_count: number; first_ts: string | null; last_ts: string | null };
  const models = db
    .prepare(`SELECT DISTINCT model FROM usage_events ORDER BY model LIMIT 1000`)
    .all()
    .map((r) => (r as { model: string }).model);
  const providers = db
    .prepare(`SELECT DISTINCT provider FROM usage_events WHERE provider IS NOT NULL ORDER BY provider LIMIT 100`)
    .all()
    .map((r) => (r as { provider: string }).provider);
  const sessions = db
    .prepare(`SELECT DISTINCT session_id FROM usage_events WHERE session_id IS NOT NULL ORDER BY session_id DESC LIMIT 1000`)
    .all()
    .map((r) => (r as { session_id: string }).session_id);
  return { ...stats, models, providers, sessions };
}

export function resetDb(): number {
  const db = getDb();
  const info = db.prepare("DELETE FROM usage_events").run();
  return info.changes;
}

export function exportRows(filter: UsageFilters): Record<string, unknown>[] {
  const db = getDb();
  const { sql: where, params } = buildWhere(filter);
  return db
    .prepare(`SELECT * FROM usage_events ${where} ORDER BY ts ASC LIMIT 1000000`)
    .all(...params) as Record<string, unknown>[];
}

export function getUsageById(id: number): Record<string, unknown> | undefined {
  const db = getDb();
  return db
    .prepare(
      `SELECT *,
              (SELECT COALESCE(s.title_override, s.title, s.slug)
               FROM sessions s WHERE s.session_id = usage_events.session_id) AS session_title,
              (SELECT COALESCE(p.name_override, p.name, NULLIF(p.worktree, '/'))
               FROM sessions s2 JOIN projects p ON p.project_id = s2.project_id
               WHERE s2.session_id = usage_events.session_id) AS project_name
       FROM usage_events WHERE id = ?`
    )
    .get(id) as Record<string, unknown> | undefined;
}

export interface SessionDetail extends SummaryRow {
  session_id: string;
  title: string | null;
  slug: string | null;
  directory: string | null;
  project_id: string | null;
  project_name: string | null;
  first_ts: string | null;
  last_ts: string | null;
}

/** Full aggregate for one session — ignores dashboard filters by design. */
export function getSessionDetail(sessionId: string): SessionDetail | undefined {
  const db = getDb();
  return db
    .prepare(
      `SELECT usage_events.session_id,
              COALESCE(s.title_override, s.title) AS title,
              s.slug AS slug,
              s.directory AS directory,
              s.project_id AS project_id,
              COALESCE(p.name_override, p.name, NULLIF(p.worktree, '/')) AS project_name,
              ${SUM_SELECT},
              MIN(ts) AS first_ts,
              MAX(ts) AS last_ts
       FROM usage_events
       LEFT JOIN sessions s ON s.session_id = usage_events.session_id
       LEFT JOIN projects p ON p.project_id = s.project_id
       WHERE usage_events.session_id = ?
       GROUP BY usage_events.session_id`
    )
    .get(sessionId) as SessionDetail | undefined;
}

export interface ProjectDetailRow {
  project_id: string;
  name: string | null;
  worktree: string | null;
}

/** Full aggregate for one project — ignores dashboard filters by design. */
export function getProjectDetail(projectId: string): (ProjectDetail & { sessions: number }) | undefined {
  const db = getDb();
  const meta = db
    .prepare(
      `SELECT project_id,
              COALESCE(name_override, name, NULLIF(worktree, '/')) AS name,
              worktree
       FROM projects WHERE project_id = ?`
    )
    .get(projectId) as ProjectDetailRow | undefined;
  if (!meta && projectId !== "global") return undefined;

  const agg = db
    .prepare(
      `SELECT COUNT(DISTINCT session_id) AS sessions,
              ${SUM_SELECT},
              MIN(ts) AS first_ts,
              MAX(ts) AS last_ts
       FROM usage_events
       WHERE session_id IN (SELECT session_id FROM sessions WHERE project_id = ?)`
    )
    .get(projectId) as (SummaryRow & { sessions: number; first_ts: string | null; last_ts: string | null }) | undefined;

  if (!agg || agg.requests === 0) return undefined;
  return {
    project_id: projectId,
    name: meta?.name ?? null,
    worktree: meta?.worktree ?? null,
    ...agg,
  };
}

const SESSION_LIST_LIMIT = 500;

/** Every session with usage, most recently active first. */
export function listSessions(filter?: UsageFilters): SessionListItem[] {
  const db = getDb();
  const { sql: where, params } = buildWhere(filter ?? {});
  const cond = where
    ? `${where} AND usage_events.session_id IS NOT NULL`
    : `WHERE usage_events.session_id IS NOT NULL`;
  return db
    .prepare(
      `SELECT usage_events.session_id,
              COALESCE(s.title_override, s.title) AS title,
              s.slug AS slug,
              s.directory AS directory,
              s.project_id AS project_id,
              COALESCE(p.name_override, p.name, NULLIF(p.worktree, '/')) AS project_name,
              COUNT(*) AS requests,
              SUM(input_tokens + cache_read_tokens + cache_write_tokens + output_tokens + reasoning_tokens) AS total_tokens,
              COALESCE(SUM(cost), 0) AS cost,
              MIN(ts) AS first_ts,
              MAX(ts) AS last_ts
       FROM usage_events
       LEFT JOIN sessions s ON s.session_id = usage_events.session_id
       LEFT JOIN projects p ON p.project_id = s.project_id
       ${cond}
       GROUP BY usage_events.session_id
       ORDER BY MAX(ts) DESC
       LIMIT ${SESSION_LIST_LIMIT}`
    )
    .all(...params) as SessionListItem[];
}

/** Sessions belonging to one project, most recently active first. */
export function listProjectSessions(projectId: string): SessionListItem[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT ue.session_id,
              COALESCE(s.title_override, s.title) AS title,
              s.slug AS slug,
              s.directory AS directory,
              s.project_id AS project_id,
              NULL AS project_name,
              COUNT(*) AS requests,
              SUM(ue.input_tokens + ue.cache_read_tokens + ue.cache_write_tokens + ue.output_tokens + ue.reasoning_tokens) AS total_tokens,
              COALESCE(SUM(ue.cost), 0) AS cost,
              MIN(ue.ts) AS first_ts,
              MAX(ue.ts) AS last_ts
       FROM usage_events ue
       JOIN sessions s ON s.session_id = ue.session_id
       WHERE s.project_id = ?
       GROUP BY ue.session_id
       ORDER BY MAX(ue.ts) DESC
       LIMIT ${SESSION_LIST_LIMIT}`
    )
    .all(projectId) as SessionListItem[];
}

export interface SessionMetaInput {
  session_id: string;
  title?: string | null;
  slug?: string | null;
  directory?: string | null;
  project_id?: string | null;
}

/** Upsert OpenCode session metadata; never touches manual overrides. */
export function upsertSessions(rows: SessionMetaInput[]): void {
  if (rows.length === 0) return;
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO sessions (session_id, title, slug, directory, project_id)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(session_id) DO UPDATE SET
      title = COALESCE(excluded.title, sessions.title),
      slug = COALESCE(excluded.slug, sessions.slug),
      directory = COALESCE(excluded.directory, sessions.directory),
      project_id = COALESCE(excluded.project_id, sessions.project_id),
      time_updated = strftime('%Y-%m-%dT%H:%M:%fZ','now')
  `);
  const tx = db.transaction((all: SessionMetaInput[]) => {
    for (const r of all) stmt.run(r.session_id, r.title ?? null, r.slug ?? null, r.directory ?? null, r.project_id ?? null);
  });
  tx(rows);
}

export interface ProjectMetaInput {
  project_id: string;
  name?: string | null;
  worktree?: string | null;
}

/** Upsert OpenCode project metadata; never touches manual overrides. */
export function upsertProjects(rows: ProjectMetaInput[]): void {
  if (rows.length === 0) return;
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO projects (project_id, name, worktree)
    VALUES (?, ?, ?)
    ON CONFLICT(project_id) DO UPDATE SET
      name = COALESCE(excluded.name, projects.name),
      worktree = COALESCE(excluded.worktree, projects.worktree),
      time_updated = strftime('%Y-%m-%dT%H:%M:%fZ','now')
  `);
  const tx = db.transaction((all: ProjectMetaInput[]) => {
    for (const r of all) stmt.run(r.project_id, r.name ?? null, r.worktree ?? null);
  });
  tx(rows);
}

export function renameSession(sessionId: string, title: string | null): boolean {
  const db = getDb();
  db.prepare(`INSERT OR IGNORE INTO sessions (session_id) VALUES (?)`).run(sessionId);
  const info = db
    .prepare(`UPDATE sessions SET title_override = ?, time_updated = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE session_id = ?`)
    .run(title, sessionId);
  return info.changes > 0;
}

export function renameProject(projectId: string, name: string | null): boolean {
  const db = getDb();
  db.prepare(`INSERT OR IGNORE INTO projects (project_id) VALUES (?)`).run(projectId);
  const info = db
    .prepare(`UPDATE projects SET name_override = ?, time_updated = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE project_id = ?`)
    .run(name, projectId);
  return info.changes > 0;
}

/**
 * Cheap change signature for the SSE live-refresh endpoint: row counts plus
 * high-water marks across events, sessions and projects.
 */
export function getDataSignature(): string {
  const db = getDb();
  const u = db
    .prepare(`SELECT COUNT(*) AS n, COALESCE(MAX(id), 0) AS m FROM usage_events`)
    .get() as { n: number; m: number };
  const s = db
    .prepare(`SELECT COUNT(*) AS n, COALESCE(MAX(time_updated), '') AS t FROM sessions`)
    .get() as { n: number; t: string };
  const p = db
    .prepare(`SELECT COUNT(*) AS n, COALESCE(MAX(time_updated), '') AS t FROM projects`)
    .get() as { n: number; t: string };
  return `${u.n}:${u.m}|${s.n}:${s.t}|${p.n}:${p.t}`;
}

const SESSION_EVENTS_LIMIT = 5000;

/** Every request in one session, chronological. */
export function listSessionEvents(sessionId: string): Record<string, unknown>[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT * FROM usage_events
       WHERE session_id = ?
       ORDER BY ts ASC, id ASC
       LIMIT ${SESSION_EVENTS_LIMIT}`
    )
    .all(sessionId) as Record<string, unknown>[];
}

/**
 * Derived efficiency metrics for the current filter. Sessions without a
 * session_id are excluded from per-session averages (SQLite DISTINCT skips NULLs).
 */
export function getEfficiency(filter: UsageFilters): EfficiencyStats {
  const db = getDb();
  const { sql: where, params } = buildWhere(filter);
  const s = getSummary(filter);
  const sessions = (
    db
      .prepare(
        `SELECT COUNT(DISTINCT session_id) AS n FROM usage_events ${where}`
      )
      .get(...params) as { n: number }
  ).n;

  const totalTokens =
    s.input_tokens +
    s.cache_read_tokens +
    s.cache_write_tokens +
    s.output_tokens +
    s.reasoning_tokens;
  const contextTokens = s.input_tokens + s.cache_read_tokens;

  return {
    requests: s.requests,
    sessions,
    total_tokens: totalTokens,
    cache_hit_rate: contextTokens > 0 ? s.cache_read_tokens / contextTokens : null,
    blended_cost_per_1m:
      totalTokens > 0 && s.cost > 0 ? (s.cost / totalTokens) * 1_000_000 : null,
    avg_tokens_per_request: s.requests > 0 ? totalTokens / s.requests : null,
    avg_cost_per_request: s.requests > 0 && s.cost > 0 ? s.cost / s.requests : null,
    avg_requests_per_session: sessions > 0 ? s.requests / sessions : null,
    avg_tokens_per_session: sessions > 0 ? totalTokens / sessions : null,
  };
}

const MODEL_EFFICIENCY_LIMIT = 50;

/** Per-model cost-per-1M-tokens, most expensive first. Zero-cost models last. */
export function getModelEfficiency(filter: UsageFilters): ModelEfficiencyRow[] {
  const db = getDb();
  const { sql: where, params } = buildWhere(filter);
  const rows = db
    .prepare(
      `SELECT model,
              COUNT(*) AS requests,
              COALESCE(SUM(input_tokens), 0) AS input_tokens,
              COALESCE(SUM(cache_read_tokens), 0) AS cache_read_tokens,
              COALESCE(SUM(cache_write_tokens), 0) AS cache_write_tokens,
              COALESCE(SUM(output_tokens), 0) AS output_tokens,
              COALESCE(SUM(reasoning_tokens), 0) AS reasoning_tokens,
              COALESCE(SUM(cost), 0) AS cost
       FROM usage_events ${where}
       GROUP BY model`
    )
    .all(...params) as (ModelBreakdown & { cache_write_tokens: number })[];

  return rows
    .map((r) => {
      const total =
        r.input_tokens +
        r.cache_read_tokens +
        r.cache_write_tokens +
        r.output_tokens +
        r.reasoning_tokens;
      return {
        model: r.model,
        requests: r.requests,
        total_tokens: total,
        cost: r.cost,
        cost_per_1m: total > 0 && r.cost > 0 ? (r.cost / total) * 1_000_000 : null,
      };
    })
    .sort((a, b) => {
      if (a.cost_per_1m == null && b.cost_per_1m == null) return b.total_tokens - a.total_tokens;
      if (a.cost_per_1m == null) return 1;
      if (b.cost_per_1m == null) return -1;
      return b.cost_per_1m - a.cost_per_1m;
    })
    .slice(0, MODEL_EFFICIENCY_LIMIT);
}

export function computeHash(r: UsageRecord): string {
  return r.source_ref ?? contentHash(r);
}
