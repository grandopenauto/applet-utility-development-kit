# AUDK v2.0 — Automated production batches (review-gated)

AUDK can now **manufacture a batch of reviewed, deterministic applets**, run their generated JS/Python test programs, reconstruct their expected artifacts, and stage reproducibility evidence and an operator review checklist. This is a **private operator command**, not a public endpoint, background worker, or publishing workflow.

## Usage

Inspect a default five-function reviewed batch (no files written):

```bash
npm run production:batch
```

Inspect a mixed production/review packet:

```bash
npm run production:batch -- --reviewed math.sqrt,math.gcd --proposals math.tan,math.acos
```

Build into a new, nonexistent private directory, using an explicitly approved Python executable:

```bash
npm run production:batch -- --reviewed math.sqrt,math.gcd --proposals math.tan --build --output /tmp/audk-reviewed-batch-001 --python python
```

Windows: use an absolute private output such as `C:\\HDP\\AUDK\\experiments\\batch-001` **only after a low-privilege worker and isolation gate have been authorized**. This command currently does not install a VPS task or change server security settings. Do not run it as a privileged VPSBridge build worker.

## What is produced

A fresh private output contains a `jobs/<UUID>/` folder per reviewed function with the generated `.mjs`, `.py`, `.test.mjs`, `.manifest.json`, `job.json` and `evidence.json`. `production-report.json` enumerates reviewed function IDs, artifact SHA-256 checksums, evidence SHA-256 and source fingerprints; `REVIEW-CHECKLIST.md` lists the human sign-off requirements. Separate `proposals/*.spec.json` files are metadata-only drafts for unimplemented SDK functions. Proposals have `runtimeEnabled:false` and `publishEnabled:false` and **are never sent to the execution queue**.

## Safety and operational limits

- Only first-party `UNIVERSAL_RECIPES` can be built. A batch has at most 10 reviewed builds and 25 inert proposals. An unreviewed function can only become a separate development specification.
- All output is in a new private folder outside the source checkout; the command fails instead of touching an existing queue.
- `--build` is the explicit execution gate. Without it, the CLI only prints an inspected plan and never writes.
- Generated reviewed examples execute with subprocess timeouts. **This is not a sandbox for unknown source code**. Use an isolated, resource-limited worker before enabling externally submitted code.
- No automatic pull requests, registry writes, GitHub commits, release deployment, or code publication. A human reviews evidence and diffs before promoting anything.
- Hash-based evidence is reproducibility checking, not a cryptographically signed proof or tamper-proof audit log.

The v1.9 private gateway remains quarantine-only. Batch production does not consume from that inbox; an operator still performs a separate review and promotion decision.
