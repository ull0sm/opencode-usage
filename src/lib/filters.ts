export interface UsageFilters {
  from?: string; // YYYY-MM-DD or full ISO
  to?: string;
  model?: string | string[];
  provider?: string;
  session?: string;
  project?: string;
}

type SearchParamsLike = Record<string, string | string[] | undefined>;

function firstValue(sp: SearchParamsLike, key: string): string | undefined {
  const v = sp[key];
  return Array.isArray(v) ? v[0] : v || undefined;
}

function allValues(sp: SearchParamsLike, key: string): string[] {
  const v = sp[key];
  if (!v) return [];
  return (Array.isArray(v) ? v : [v])
    .flatMap((x) => x.split(","))
    .map((x) => x.trim())
    .filter(Boolean);
}

/** Normalize a model filter to a non-empty array, or undefined. */
export function modelList(model: UsageFilters["model"]): string[] | undefined {
  const list = model == null ? [] : Array.isArray(model) ? model : [model];
  const valid = list.filter((m) => m && m !== "all");
  return valid.length > 0 ? valid : undefined;
}

export function filtersFromSearchParams(sp: SearchParamsLike): UsageFilters {
  const f: UsageFilters = {};
  const from = firstValue(sp, "from");
  const to = firstValue(sp, "to");
  const models = allValues(sp, "model").filter((m) => m !== "all");
  const provider = firstValue(sp, "provider");
  const session = firstValue(sp, "session");
  const project = firstValue(sp, "project");
  if (from) f.from = from;
  if (to) f.to = to;
  if (models.length === 1) f.model = models[0];
  else if (models.length > 1) f.model = models;
  if (provider && provider !== "all") f.provider = provider;
  if (session) f.session = session;
  if (project) f.project = project;
  return f;
}

export function hasFilters(f: UsageFilters): boolean {
  return Boolean(
    f.from ||
      f.to ||
      f.provider ||
      f.session ||
      f.project ||
      modelList(f.model)
  );
}

function tsLowerBound(v: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? `${v}T00:00:00.000Z` : v;
}
function tsUpperBound(v: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? `${v}T23:59:59.999Z` : v;
}

/**
 * The immediately preceding period of equal length, or null when the filter
 * has no bounded date range (e.g. "All time") — used for trend comparisons.
 */
export function previousPeriod(f: UsageFilters): UsageFilters | null {
  if (!f.from || !f.to) return null;
  const from = new Date(tsLowerBound(f.from));
  const to = new Date(tsUpperBound(f.to));
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return null;
  const prevTo = new Date(from.getTime() - 1);
  const prevFrom = new Date(prevTo.getTime() - (to.getTime() - from.getTime()));
  return { ...f, from: prevFrom.toISOString(), to: prevTo.toISOString() };
}

export interface WhereClause {
  sql: string;
  params: unknown[];
}

export function buildWhere(f: UsageFilters): WhereClause {
  const conds: string[] = [];
  const params: unknown[] = [];

  if (f.from) {
    conds.push("usage_events.ts >= ?");
    params.push(tsLowerBound(f.from));
  }
  if (f.to) {
    conds.push("usage_events.ts <= ?");
    params.push(tsUpperBound(f.to));
  }

  const models = modelList(f.model);
  if (models?.length === 1) {
    conds.push("usage_events.model = ?");
    params.push(models[0]);
  } else if (models && models.length > 1) {
    conds.push(`usage_events.model IN (${models.map(() => "?").join(", ")})`);
    params.push(...models);
  }

  if (f.provider) {
    conds.push("usage_events.provider = ?");
    params.push(f.provider);
  }
  if (f.session) {
    conds.push("usage_events.session_id LIKE '%' || ? || '%'");
    params.push(f.session);
  }
  if (f.project) {
    conds.push(
      `usage_events.session_id IN (SELECT s0.session_id FROM sessions s0 WHERE s0.project_id = ?)`
    );
    params.push(f.project);
  }
  return { sql: conds.length ? `WHERE ${conds.join(" AND ")}` : "", params };
}

/**
 * Resolve the day-boundary shift (minutes to ADD to ts before extracting
 * day/hour) from, in order of precedence: an explicit ?tz= search param, a
 * `tz` cookie set by <TzSync />, or UTC. Inputs use the JS
 * Date#getTimezoneOffset() convention (IST +05:30 → -330), so they are negated.
 */
export function resolveDayShift(spTz?: string | null, cookieTz?: string | null): number {
  const parse = (v?: string | null): number => {
    if (v == null || v === "") return NaN;
    const n = Number.parseInt(v, 10);
    return Number.isFinite(n) && n >= -840 && n <= 840 ? -n : NaN;
  };
  const fromParam = parse(spTz);
  if (Number.isFinite(fromParam)) return fromParam;
  const fromCookie = parse(cookieTz);
  if (Number.isFinite(fromCookie)) return fromCookie;
  return 0;
}

/** Append filter params into a URL for API routes. */
export function filtersToQuery(f: UsageFilters): URLSearchParams {
  const q = new URLSearchParams();
  if (f.from) q.set("from", f.from);
  if (f.to) q.set("to", f.to);
  for (const m of modelList(f.model) ?? []) q.append("model", m);
  if (f.provider) q.set("provider", f.provider);
  if (f.session) q.set("session", f.session);
  if (f.project) q.set("project", f.project);
  return q;
}
