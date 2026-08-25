# Contributing to opencode-usage

Thanks for your interest! This is a small, local-first tool — contributions of all sizes are welcome: bug fixes, new charts, better importers, docs, you name it.

## Development setup

Requirements:

- **Node.js 20+**
- npm

```bash
git clone https://github.com/ull0sm/opencode-usage.git
cd opencode-usage
npm install       # compiles the better-sqlite3 native module
npm run seed      # optional demo data (~30 days)
npm run dev       # http://localhost:3000
```

Useful things to know:

- The SQLite DB lives at `data/usage.db` (gitignored). Point it elsewhere with `TOKEN_ANALYSE_DB=/tmp/test.db npm run dev` if you want a scratch instance.
- Pages under `src/app/*` are mostly server components querying SQLite directly; interactive tables/charts are client components hitting `/api/*`. All API routes need `runtime = "nodejs"` for better-sqlite3.
- All ingestion paths funnel through `normalizeRecord()` in `src/lib/validation.ts` — if you touch record shapes, keep canonical CSV/JSON and raw OpenCode messages working, and keep imports idempotent (`source_ref` / content-hash dedupe).

## Before opening a PR

```bash
npm run lint      # must pass
npm run build     # should pass
```

Please also:

- Keep PRs focused — one feature or fix per PR.
- Update the README if you change user-facing behavior (commands, env vars, formats).
- Don't commit real usage data, `.env*`, or anything from `data/` (already gitignored).
- No secrets in code, logs or screenshots.

## Reporting bugs

Open an issue with the bug report template: what you did, what happened, what you expected, plus your OS, Node version and browser. Console/network errors help a lot.

## Feature requests

Very welcome — open an issue describing the problem you're trying to solve (not just the solution), so we can pick the right shape for it.

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
