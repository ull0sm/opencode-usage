export interface UsageRecord {
  ts: string; // ISO-8601 UTC
  model: string;
  provider: string | null;
  session_id: string | null;
  input_tokens: number;
  cache_read_tokens: number;
  cache_write_tokens: number;
  output_tokens: number;
  reasoning_tokens: number;
  cost: number | null;
  source_ref: string | null;
  raw_usage: string | null;
}

export interface SummaryRow {
  requests: number;
  input_tokens: number;
  cache_read_tokens: number;
  cache_write_tokens: number;
  output_tokens: number;
  reasoning_tokens: number;
  cost: number;
}

export interface TimeseriesPoint extends Omit<SummaryRow, "requests" | "cache_write_tokens"> {
  requests: number;
  date: string; // YYYY-MM-DD (UTC)
}

export interface HourBucket {
  hour: string; // "00"–"23" (UTC)
  requests: number;
  tokens: number;
  input_tokens: number;
  cache_read_tokens: number;
  output_tokens: number;
  reasoning_tokens: number;
}

export interface ModelBreakdown {
  model: string;
  requests: number;
  input_tokens: number;
  cache_read_tokens: number;
  output_tokens: number;
  reasoning_tokens: number;
  cost: number;
}

export interface SessionBreakdown {
  session_id: string | null;
  requests: number;
  input_tokens: number;
  cache_read_tokens: number;
  output_tokens: number;
  reasoning_tokens: number;
  cost: number;
  last_ts: string | null;
}

export interface EfficiencyStats {
  requests: number;
  sessions: number;
  total_tokens: number;
  cache_hit_rate: number | null;
  blended_cost_per_1m: number | null;
  avg_tokens_per_request: number | null;
  avg_cost_per_request: number | null;
  avg_requests_per_session: number | null;
  avg_tokens_per_session: number | null;
}

export interface ModelEfficiencyRow {
  model: string;
  requests: number;
  total_tokens: number;
  cost: number;
  cost_per_1m: number | null;
}

export interface UsageListResponse {
  rows: Record<string, unknown>[];
  total: number;
  page: number;
  page_size: number;
}

export interface MetaInfo {
  row_count: number;
  first_ts: string | null;
  last_ts: string | null;
  models: string[];
  providers: string[];
  sessions: string[];
}

export type UsageEvent = Record<string, unknown> & { id: number };

export interface ImportResult {
  dry_run: boolean;
  format?: string;
  total: number;
  accepted: number;
  ignored: number;
  errors: { index: number; error: string }[];
  inserted?: number;
  skipped_duplicates?: number;
  preview?: Record<string, unknown>[];
}
