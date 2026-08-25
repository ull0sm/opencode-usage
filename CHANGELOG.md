# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-08-25

### Added

- Local dashboard for OpenCode LLM token usage & cost: summary cards with period deltas, groupable time-series chart (day/hour/model/session/project), calendar heatmap, hour-of-day histogram, model cost-efficiency table with outlier flagging.
- Sessions & Projects pages with rename support and per-entity timelines.
- Usage history table with request-detail inspection.
- Three ingestion paths into one deduplicated SQLite store: one-click pull from OpenCode storage, CLI import (`npm run import-opencode`), live JSONL tailer (`npm run watch`), plus manual CSV/JSON/NDJSON import with dry-run preview.
- Live updates via SSE; timezone-aware day boundaries; saved filter presets.
- CSV export and guarded full-database reset from Settings.
- Demo data seeder (`npm run seed`) and sample import files.

[0.1.0]: https://github.com/ull0sm/opencode-usage/releases/tag/v0.1.0
