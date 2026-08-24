CREATE TABLE IF NOT EXISTS usage_events (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  ts                 TEXT NOT NULL,              -- ISO-8601 UTC
  model              TEXT NOT NULL,
  provider           TEXT,
  session_id         TEXT,
  input_tokens       INTEGER NOT NULL DEFAULT 0, -- non-cached prompt/context tokens
  cache_read_tokens  INTEGER NOT NULL DEFAULT 0, -- served from provider cache
  cache_write_tokens INTEGER NOT NULL DEFAULT 0, -- written to provider cache
  output_tokens      INTEGER NOT NULL DEFAULT 0, -- normal response content
  reasoning_tokens   INTEGER NOT NULL DEFAULT 0, -- reasoning/thinking tokens
  cost               REAL,                       -- USD; NULL = unknown
  content_hash       TEXT NOT NULL UNIQUE,       -- sha256 over ts|model|provider|session|token buckets
  source_ref         TEXT UNIQUE,                -- e.g. "ses_x:msg_y" from OpenCode
  raw_usage          TEXT,                       -- original OpenCode usage JSON (verbatim)
  created_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_usage_ts        ON usage_events(ts);
CREATE INDEX IF NOT EXISTS idx_usage_model     ON usage_events(model);
CREATE INDEX IF NOT EXISTS idx_usage_session   ON usage_events(session_id);
CREATE INDEX IF NOT EXISTS idx_usage_provider  ON usage_events(provider);
CREATE INDEX IF NOT EXISTS idx_usage_session_ts ON usage_events(session_id, ts);

CREATE TABLE IF NOT EXISTS sessions (
  session_id     TEXT PRIMARY KEY,
  title          TEXT,                      -- from OpenCode
  slug           TEXT,                      -- short OpenCode name, e.g. "misty-garden"
  title_override TEXT,                      -- manual rename; wins over everything
  directory      TEXT,
  project_id     TEXT,
  time_updated   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS projects (
  project_id     TEXT PRIMARY KEY,
  name           TEXT,                      -- from OpenCode (often NULL)
  name_override  TEXT,                      -- manual rename; wins over everything
  worktree       TEXT,
  time_updated   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_sessions_project ON sessions(project_id);
