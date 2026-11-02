# AUDK v1.9 — Private Build Request Intake

A **quarantined, authenticated, rate-limited intake service** for static Studio handoff envelopes. It is not a browser-login system, public internet gateway, compiler, execution service, approval mechanism, or publication API.

## Design

- `src/intake-gateway.mjs` binds **only** to `127.0.0.1` or `::1`, with bearer-token authentication and constant-time digest comparison. No CORS; requests with an `Origin` header are denied.
- Each authenticated request is counted against a bounded in-memory fixed-window rate limit (default 12 per minute per server instance). Restarting resets the count. Before external use, add upstream persistent distributed throttling and managed end-user identity; do not expose this prototype directly.
- `POST /v1/intake` accepts exactly the existing `audk.build-handoff.v1` schema (created by the Studio), maximum request size 4,096 bytes. No scripts, URLs, override fields, automatic execution, or publication flags.
- Each request is stored as one immutable JSON file under `<AUDK_INTAKE_DATA_DIR>/inbox/<requestId>.json`. Identical replays return the same receipt; conflicting reuse of a request ID returns HTTP 409. Inbox maximum defaults to 1,000 records. Capacity checks assume a single writer process.
- `GET /v1/intake/<requestId>` returns authenticated non-secret status metadata. `GET /v1/intake/health` is authenticated.
- No import from `build-service.mjs`, no writing to the executable `jobs/` queue, and no process spawning. Quarantined records are not approvals. An operator must separately inspect the saved JSON using the existing `build:import-handoff` CLI with explicit approval flags.

## Private-only setup (not a VPS deployment)

1. Create a dedicated private intake directory with restrictive filesystem permissions, separate from the AUDK source and executable job storage.
2. Set `AUDK_INTAKE_DATA_DIR` to an absolute path and `AUDK_INTAKE_TOKEN` to a unique random string of at least 32 characters, delivered via protected secrets storage (not a public web page, GitHub, or logs).
3. Optionally set `AUDK_BUILD_DATA_DIR` to refuse overlapping roots and `AUDK_INTAKE_PORT` (default 4194). Run `npm run intake:serve-private` under a separate restricted identity.
4. From a trusted local operator client only, POST the downloaded JSON to `http://127.0.0.1:4194/v1/intake` with `Authorization: Bearer <token>` and `Content-Type: application/json`. The public GitHub Pages site does not connect directly.
5. Inspect the stored JSON using `npm run build:import-handoff -- <absolute-json-file>` (inspection only). Only separately authorized operator steps may enqueue or execute a reviewed build.
6. Shut down when not in use. Do not install a persistent service, scheduler, firewall rule, or public route as part of this prototype.

## Security limits

Bearer tokens are not end-user identity. In-memory rate limits are not distributed and provide no account quotas. File receipts are not independently signed attestations. OS permissions, isolated execution, secrets, TLS, abuse monitoring, review gates and deployment security must be assessed before any public-facing use. **No external user can build or publish applets through this gateway.**
