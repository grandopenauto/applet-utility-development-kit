# AUDK v1.0 — Metadata-Only Applet Expansion Engine

AUDK ranks discovered Python standard-library functions for **future** implementation. Candidate scoring and automatically suggested wizard fields are unverified estimates, not evidence of security, correctness or execution readiness.

## Current architecture

- `tools/python_discover.py`: introspects a fixed allowlist of standard-library modules, collecting only names, doc summaries and signatures. It never invokes discovered functions or installs packages.
- `src/expansion.mjs`: deterministic heuristics classify callables by review needs and produce provisional parameter suggestions. Every candidate has `runtimeEnabled:false` and `autoPublish:false`.
- `catalog/expansion-queue.json`: pinned candidate snapshot built from the repo's pinned Python discovery JSON; the public Studio displays it as **read-only**.
- `expansion-ui.js`: searchable expansion queue. The export button creates a metadata-only intake, not a runnable applet, wizard, approval, or pull request.
- `GET /api/expansion/queue?search=math.cos&limit=25`: local-only, bounded inspection endpoint. GitHub Pages does not host this API.

## Weekly scheduled scan: GitHub Actions, no VPS yet

`.github/workflows/expansion-scan.yml` runs Mondays at 16:17 UTC and by manual `workflow_dispatch`. It sets up Python 3.12 and Node.js 22, scans only the seven allowlisted modules, creates a fresh expansion queue, compares the fresh metadata to the pinned catalog, and runs tests/registry validation. The job uploads three **inspection artifacts** with 30-day retention.

It does **not** commit, open a PR, merge, execute discovered functions, update GitHub Pages, or distribute executable code. It uses `contents: read` only. GitHub schedules may run late, and public-repository schedules can be disabled after 60 days of inactivity. Verify run results in the repository Actions tab.

To update the pinned public queue after inspection, review the artifacts and changes, then commit a reviewed `catalog/python-standard-library.json` / `catalog/expansion-queue.json` change through normal GitHub review. Treat generated metadata as untrusted text and limit published data size.

## Manual development / testing

```bash
npm test
npm run check
npm run expansion:scan
npm run expansion:diff
python tools/python_discover.py --output /tmp/audk-python-fresh.json
node scripts/build-expansion-queue.mjs --catalog /tmp/audk-python-fresh.json --output /tmp/audk-queue-fresh.json
node scripts/diff-python-catalog.mjs --baseline catalog/python-standard-library.json --current /tmp/audk-python-fresh.json --output /tmp/audk-diff.json
```

## Safety / promotion

An applet proposal must go through semantic review, bounded schema implementation, edge-case testing, Python-to-JavaScript parity where applicable, and GitHub PR review. Never treat a heuristic score or discovered signature as a safe executable recipe. Risk classification may be wrong; candidate inputs are not permission grants. Published library applets remain at 12 until separately reviewed.

## When to use VPS workers

Use a dedicated, authenticated Windows worker only if AUDK gains real system tasks (Windows Services, registry inspection, HTA/desktop packaging, long-lived file watchers), CI workloads exceed GitHub limits, or private-source discovery is needed. That worker should process explicit jobs from a durable queue, run as least privilege, isolate generated code, enforce timeouts and concurrency limits, log results, and leave approval/publication outside the worker. Avoid continuously polling unchanged public standard-library metadata.
