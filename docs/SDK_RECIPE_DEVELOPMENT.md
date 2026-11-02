# AUDK v2.1 — SDK-to-Recipe Development Packets

AUDK can now turn its **pinned Python 3.13.5 discovery catalog** and validated assembly plan into a deterministic, explicitly **non-executable** candidate implementation review packet. This is a design/documentation step, not code generation or recipe approval.

## Operator workflow

```sh
npm run development:recipes -- --ids math.tan,math.acos
npm run development:recipes -- --module math --limit 10
npm run development:recipes -- --ids math.tan,math.acos --write --output /tmp/audk-sdk-dev-001
```

By default, the command **prints an inspection summary only**. `--write` requires an explicit fresh absolute private output directory outside AUDK source and other queues. It produces one `.recipe-draft.json` per candidate, a summary report, and a human `REVIEW-CHECKLIST.md`. For a special-review packet, the operator must additionally provide `--include-special`; the output stays non-executable.

## Packet contents

- Exact discovered function name and pinned Python runtime version, an entry fingerprint and a proposed official documentation URL (which must still be confirmed by a reviewer)
- Parameter names, position-only or keyword-only modes, literal default **text**, and unverified type/bound placeholders; the parser never evaluates expressions or imports SDK code
- Where suitable, a small set of **candidate input values** with intentionally missing expected results and error outcomes, to be filled from a trusted reference implementation
- Separate required reviews for semantic compatibility, side effects, input bounds, numeric precision, reference cases and approval
- Explicit `executable:false`, `verified:false`, `runtimeEnabled:false`, `automaticPublication:false` and no PR creation, execution, or registry modification

A source signature is only a starting point; it **does not establish type safety, return behavior, domain validity or licensing**. The existing assembly plan lists 157 development-review candidates and 173 special-review candidates. These counts are heuristic, not approvals or validated products.

## Promotion boundary

A human checks the official SDK docs and records exact reference results and expected error conditions, implements bounded JS/Python versions in a separate reviewed change, and adds coverage to the curated allowlist. Only then may the existing v2.0 production pipeline build the newly approved function. This release never upgrades an unreviewed function to executable or publishes it.

The GitHub Pages Studio remains static. No VPS agent, new API, scheduler, credentials, or public build endpoint is installed by this release.
