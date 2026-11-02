# AUDK Private Build Service — v1.3 design and operator procedures

## Trust boundary

- Public GitHub Pages Studio: **static, read-only** inventory and proposal downloads. It does not have credentials, remote execution or a write API.
- Private loopback API: `127.0.0.1:4193`, bearer token only from environment. Strict request schema, duplicate request keys, no CORS/browser-origin calls, no uploads or arbitrary source parameters.
- Separate worker: handles queued jobs in a private data directory, never under the public repository. It executes only code generated from vetted, bounded first-party recipes; it **does not sandbox untrusted code**. The recipe whitelist is code, not user-provided configuration.
- Proposed function: generates an **inert candidate specification** for manual implementation and review; no unreviewed function is dynamically imported, compiled, tested or published.
- Publication: requires human source review, independent CI, and a GitHub PR. Successful builds never update the live registry.

## Queue lifecycle

`POST /v1/jobs`: `{ "functionId": "math.sqrt", "mode": "reviewed-build", "idempotencyKey": "unique-key-at-least-12" }`. Returns HTTP 202 and a job in `queued` state. Idempotency means an identical key cannot switch function or mode. Separate `npm run build:work-once` claims up to three jobs with a filesystem lock, runs checks, records SHA-256 checksums and marks `completed` or `failed`. A failed job does not retry silently. Jobs interrupted while running remain marked running and require operator intervention; no automatic lock bypass. `GET /v1/jobs/<id>` returns metadata, not source files. Restrict local folder access to the service account/administrators.

## Windows VPS experimentation (not production)

Suggested root: `C:\HDP\AUDK`. Use a separate private subfolder for code, builds, and logs, and check free disk and existing path ownership first. Stage packaged, SHA-pinned source via established VPSBridge only after a reviewed package and preflight. Verify all work through VPSBridge `DONE` + exit `0` receipts. Start with **directory creation only**, no IIS site, Windows service, scheduled task, firewall changes or public API exposure. Do not hard-code API tokens into GitHub, Google Sheets or build logs. Use a dedicated identity, protected ACLs and an ephemeral isolated worker before considering external authored code.

## Future authenticated web requests

A public UI cannot safely call localhost on the server or contain an operator secret. The future flow needs a separate authenticated gateway, rate limits, per-user quotas, narrow request schemas, durable audit and an inbound job-request staging service. The gateway must never accept arbitrary Python, shell, PowerShell, HTA, remote URLs or package installation requests. It can create proposal jobs, and after authorization, queue reviewed build recipes through a private controlled transport. Build output must be scanned, human-reviewed and published via PR.

## Test/operating checks

- `npm test` and `npm run check` run local regression and library checks.
- No public build or compile route appears in the existing Studio/Express API.
- Build operator token required for health and job routes; browser origins rejected.
- `AUDK_BUILD_DATA_DIR` must be absolute and outside the repository.
- `npm run build:work-once` processes only queued jobs, never runs automatically from HTTP requests.
