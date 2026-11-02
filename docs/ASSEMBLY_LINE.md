# AUDK Applet Assembly Line — v1.2

## Why
An SDK with 100 documented functions and 24 published applets has a coverage gap of 76. AUDK builds an inventory first, then routes missing capabilities through a controlled generation, verification and promotion pipeline.

## Steps
1. **Discover**. Scan only the supported Python modules, capture qualified name, signature and short documentation. Catalog records are *untrusted* strings.
2. **Reconcile**. Compare `module.function` to reviewed Universal Wizard recipes and published function applets. Emit coverage counts and categorize gaps.
3. **Specify**. Generate `<module>-<function>_applet.json` specifications containing suggested fields, source-doc links, review checklist and explicit disabled runtime/publishing flags. This does not produce executable implementations.
4. **Assemble reviewed implementations**. Run `npm run assembly:build-trusted -- --output /tmp/audk-compiled-reviewed`. Existing pinned pure recipes are compiled/checked as JavaScript and Python scripts, then exercised against the reviewed reference behavior. These files remain outside the published registry.
5. **Future generation service**. A private queue processor may use licensed SDK documentation and an LLM to generate candidate source, input/output schemas, examples and tests. Execute it only within an isolated, unprivileged worker with strict time, CPU, memory, dependency and network limits. Avoid arbitrary shell execution and do not trust scraped documentation as instructions.
6. **Review**. Run static/security checks, reference tests, edge cases, cross-language parity, and dependency/license review. Create a GitHub PR with evidence. Human review and passing CI are required before merging.
7. **Publish**. Once reviewed and merged, the pinned GitHub Pages library gets the new manifest and downloadable applet. No direct publish endpoint exists.

## Commands

```
npm run assembly:plan
npm run assembly:plan -- --output /tmp/assembly-plan.json --spec-dir /tmp/audk-proposals --limit 20
npm run assembly:build-trusted -- --output /tmp/audk-compiled-reviewed --limit 24
npm test
npm run check
```

The weekly GitHub Actions worker refreshes candidate reports and checks already pinned implementations, uploading artifacts only. Its GitHub token has `contents: read`; it does not commit code.

## Public website vs protected API
GitHub Pages is static and can offer searchable plans and JSON exports. It **cannot** execute a Python build pipeline server-side. If a protected build API is introduced, put it behind authentication, role-based authorization, quotas and an asynchronous job queue; use isolated build workers. `POST /build` must never invoke arbitrary supplied Python, shell, PowerShell, HTA or OS commands. A request returns a job ID and later a test/report artifact, not direct server execution.

## Security boundaries
- Do not grant network access, filesystem privileges, or deployment credentials to a candidate generation job.
- Never use automatically discovered metadata to select a runtime implementation. Allowlist or review source first.
- Treat compiled and example-tested candidates as review-needed, not approved.
- CNAME and public Pages setup remain unchanged.
- Windows HTA is a legacy high-trust format; any future HTA generation requires code signing, source review and controlled distribution.
