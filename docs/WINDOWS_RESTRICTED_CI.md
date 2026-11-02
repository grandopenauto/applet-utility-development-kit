# AUDK v1.6 — Disposable restricted Windows worker CI

## What this validates

The GitHub Actions `restricted-worker-smoke` job runs on an ephemeral `windows-latest` machine after the Windows/Linux unit-test matrix succeeds. It creates a randomly named local Windows **non-admin** account and runs the unmodified, source-locked `scripts/run-restricted-worker.mjs` under that account using `Start-Process -Credential`. This is materially stronger evidence than injecting mock `whoami` output into unit tests.

The test builds only the first-party reviewed `math.sqrt` recipe and confirms:

1. The account's actual SID, local group memberships and token privilege report are accepted by the worker's fail-closed identity check.
2. Its source directory is read-only, its private job root permits writes, and an unrelated protected synthetic file cannot be read.
3. The restricted worker passes the seven/eight-file reviewed source lock, handles at most one queued build, and does not publish anything.
4. The CI administrator independently checks completed state, four generated artifacts, and the byte-for-byte regenerated evidence.
5. The temporary account is deleted and the runner is discarded. No real VPS, private credentials, GitHub write token, public endpoint, or persistent service is involved.

## Critical limits

This experiment **does not** sandbox arbitrary generated Python/JavaScript, guarantee no network egress, demonstrate CPU/RAM quotas, or prove access denial against files on the real HDP VPS. Windows host identity/ACLs are not equivalent to VM or container isolation. The worker must remain limited to reviewed, bounded, first-party recipes. Keep GitHub Pages read-only and require explicit review before publishing code.

Production deployment stays blocked pending a separately authorized, independently verified VPS non-admin account and resource-isolation plan. Do not bypass a bridge execution safety denial. Recheck every CI output against the exact release commit and never describe a queued or failed run as successful.

## Source references

- `.github/workflows/test.yml`
- `scripts/ci-restricted-worker-smoke.ps1`
- `scripts/ci-seed-restricted-job.mjs`
- `scripts/ci-check-worker-boundaries.mjs`
- `scripts/ci-verify-restricted-job.mjs`
- `scripts/run-restricted-worker.mjs`
- `src/worker-policy.mjs`
