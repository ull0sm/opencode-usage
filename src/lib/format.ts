const intFmt = new Intl.NumberFormat("en-US");
const costFmt = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

export function fmtInt(n: number | null | undefined): string {
  return n == null ? "—" : intFmt.format(n);
}

export function fmtCompact(n: number): string {
  return Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

export function fmtPct(n: number | null | undefined, digits = 1): string {
  return n == null ? "—" : `${(n * 100).toFixed(digits)}%`;
}

export function fmtCost(n: number | null | undefined): string {
  return n == null ? "—" : costFmt.format(n);
}

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Timezone-independent formatter for deterministic SSR placeholders. */
export function fmtDateTimeUtc(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(
    d.getUTCHours()
  )}:${pad(d.getUTCMinutes())}`;
}

export function fmtDay(iso: string): string {
  // iso is YYYY-MM-DD (UTC bucket); render without timezone shifting
  return iso.slice(5).replace("-", "/");
}

export function truncate(s: string | null | undefined, max = 18): string {
  if (!s) return "—";
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

/** Human-friendly span between two ISO timestamps, e.g. "3 h 12 min". */
export function fmtDuration(
  from: string | null | undefined,
  to: string | null | undefined
): string {
  if (!from || !to) return "—";
  const ms = new Date(to).getTime() - new Date(from).getTime();
  if (Number.isNaN(ms) || ms < 0) return "—";
  const mins = Math.round(ms / 60000);
  if (mins < 1) return "< 1 min";
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  const rem = mins % 60;
  if (hours < 48) return rem ? `${hours} h ${rem} min` : `${hours} h`;
  const days = Math.floor(hours / 24);
  return `${days} d ${hours % 24} h`;
}

/** Last path segment of a worktree/directory, e.g. "/a/b/repo" → "repo". */
export function baseName(p: string | null | undefined): string {
  if (!p || p === "/") return "";
  return p.replace(/\/+$/, "").split("/").pop() || p;
}

/** Best display label for a project row coming out of getByProject/listProjects. */
export function projectLabel(
  row: { name?: string | null; worktree?: string | null; project_id?: string | null }
): string {
  if (row.name) return baseName(row.name) || row.name;
  if (row.project_id === "global") return "Ad-hoc";
  if (row.project_id) return truncate(row.project_id, 14);
  return "(no project)";
}

/**
 * OpenCode's placeholder title for never-titled sessions,
 * e.g. "New session - 2026-08-24T08:41:06.246Z" — the slug reads better.
 */
const PLACEHOLDER_TITLE = /^New session - \d{4}-\d{2}-\d{2}T[\d:.]+Z$/;

/** Best display title for a session: real title → slug → raw id. */
export function sessionTitle(
  s: { title?: string | null; slug?: string | null; session_id?: string | null }
): string {
  const title = s.title && !PLACEHOLDER_TITLE.test(s.title.trim()) ? s.title : null;
  return title || s.slug || s.session_id || "(no session)";
}
