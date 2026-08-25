# Security Policy

## Scope

opencode-usage is a **local-first, single-user** application:

- It binds only to your local machine by default (`localhost:3000`) and stores all data in a local SQLite file.
- It makes **no outbound network requests** — no LLM APIs, no telemetry, no update checks.
- There are no accounts, no authentication, and no multi-user features.

If you expose it beyond localhost (e.g., LAN hosting), understand there is no auth layer; anyone who can reach the port can read your usage data and trigger imports/resets.

## Supported versions

| Version | Supported |
| --- | --- |
| latest on `main` | ✅ |
| older tags | ❌ |

## Reporting a vulnerability

Please do **not** open a public issue for security problems.

Use GitHub's *Report a vulnerability* button under the repo's **Security** tab (private security advisory) at https://github.com/ull0sm/opencode-usage/security.

Include: affected area, reproduction steps, and impact. You'll get a response within a few days, and credit in the changelog if you'd like.
