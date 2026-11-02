# AUDK v1.4: Dedicated Windows worker admission (NOT an untrusted-code sandbox)

## Scope of release

AUDK can reject unapproved worker identities *before* handling queued jobs. A separate, manual Windows operator launch is required. This release does **not** create local accounts, schedule tasks, start Windows services, open ports, deploy to the VPS, or allow arbitrary Python/JS submissions. It does not change the static GitHub Pages studio or the existing loopback-only private request API.

The earlier v1.3.1 proof (Queue rows 852–854) ran under privileged VPSBridge control and is not evidence of execution under a restricted account. The worker identity check is a policy gate, **not** Windows containment. Future execution of untrusted source requires stronger sandbox boundaries: dedicated VM/container, no reusable credentials, egress deny policy, per-job CPU/RAM/disk controls, no sensitive host mounts, and independent review.

## Identity and source invariants

- Windows-only wrapper rejects SYSTEM, built-in service accounts, administrators and privileged rights. `AUDK_WORKER_ALLOWED_SID` must pin a dedicated local/domain user SID in `S-1-5-21-...` form. The actual `whoami /user`, `/groups`, `/priv` evidence must match; absent or ambiguous evidence fails closed.
- The service must run under a distinct **non-administrative user** with explicit read/execute permission on the pinned code directory and write permission on a separate private job directory. Ordinary Users, Authenticated Users and IIS/AppPool principals must not have access to job artifacts.
- A SHA-256 source lock covers the build engine, reviewed recipes, assembly logic, Python discovery queue, policy and worker entry point. Validate lock before processing jobs. Regenerate with `npm run worker:lock` only after reviewing source changes, and commit the lock via code review. Hashes do not replace signed supply-chain provenance or physical access controls.
- The reviewed-only worker handles at most one job per deliberate invocation. It does not fetch external packages and cannot run arbitrary submitted source. Existing hardcoded subprocess timeouts are basic availability controls, not strong resource isolation.

## Operator review checklist — without executing it yet

1. Verify the approved repository commit, current VPSBridge receipts, and Windows local user/account policy.
2. Create a dedicated non-admin principal **only after separate operational authorization**, assign a private profile, deny interactive/remote login where appropriate, and record its SID locally. Avoid any identity shared by other HDP services.
3. Stage vetted source under a locked read-only directory; create a separate locked data directory. Confirm explicit ACLs via `Get-Acl` under the actual worker token and that it cannot open any HDP secrets or other project directories.
4. Pin the allowed SID with `AUDK_WORKER_ALLOWED_SID`, the private job directory with `AUDK_BUILD_DATA_DIR`, and an approved absolute interpreter with `AUDK_PYTHON`. Do not paste sensitive environment variables or bearer tokens into Sheets, log files, URLs or GitHub.
5. Run `node scripts/run-restricted-worker.mjs --check` once under that identity; require checked source locks, identity checks and directory audit. Only then run one synthetic `math.sqrt` job with `node scripts/run-restricted-worker.mjs`.
6. Independently verify generated hash receipts and that no default API ports, tasks, services or IIS routes remain active.

**Restrictions:** Do not run `node scripts/run-private-build-worker.mjs` under the administrative bridge as a production fallback. Do not grant public access to the private build API. Passing the `--check` command does not establish a secure sandbox or network restriction.

## Verification

`npm test` checks deterministic identity denial, whoami parsing, root separation, source integrity tampering and policy classification. `node scripts/verify-worker-lock.mjs` validates source hashes. CI runs on Windows and Linux; actual restricted-principal Windows execution remains a separate, uncompleted gate.

### v1.7 path and checkout integrity controls

- Create the dedicated worker's job directory **before** running `worker:restricted --check`; the preflight now rejects a nonexistent directory and never provisions it automatically.
- Source, job root, and every filesystem ancestor must be ordinary directories, with no symlink/junction indirection. Canonical paths must not overlap.
- Pinned source modules and their parent directories must be regular files/directories, not symlinks or junctions. A matching SHA-256 alone is not enough to authorize an indirection.
- The source tree must remain read-only to the dedicated Windows worker; unrelated protected files must be unreadable; the job root alone is writable. Keep CI checks, independent receipts, and deployment authorization.
- This is defense in depth, **not** permission to run arbitrary supplied code or create a public API endpoint.
