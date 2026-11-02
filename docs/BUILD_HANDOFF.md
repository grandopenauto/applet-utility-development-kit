# AUDK v1.8 — Portable Build Request Handoff

AUDK Studio is a static website. It **does not run a builder**, connect to the Windows VPS, or accept uploaded code. The browser's Build Request Handoff produces a small inert JSON document with a versioned schema (`audk.build-handoff.v1`) and one of two allowed modes:

- `specification`: metadata-only review proposal for a function in the expansion queue.
- `reviewed-build`: request to generate from an **existing reviewed, bounded, first-party** recipe, never from a function discovered only by name.

The public export carries no credentials, URLs, shell commands, code, publication rights, or executable scripts. The timestamp expires after 14 days; a new export can be generated at any time. A downloaded file is untrusted data even if its flags claim review status. Neither its origin nor its author is authenticated by this format.

## Offline operator procedure

1. Transfer the downloaded JSON into the operator's restricted intake area using a trusted offline channel. Inspect the source, keep it out of the public checkout, and protect the private `AUDK_BUILD_DATA_DIR` folder with OS ACLs.
2. `npm run build:import-handoff -- <absolute-path-to-json>` checks file size and type, schema and policy, fresh timestamp, allowed function mode and pinned local assembly plan. **Default is inspection only.**
3. For a specification request, `npm run build:import-handoff -- <path> --enqueue` creates a queued job; nothing runs.
4. For a reviewed implementation, inspect the function/mode first. Explicit operator approval is required: `npm run build:import-handoff -- <path> --enqueue --approve-reviewed`. The flag allows queueing **only** a pinned reviewed recipe; it does not authorize publishing.
5. Run the separately approved one-job worker under a restricted identity, then independently check reproducible build evidence and review any publication as a GitHub PR.

The importer is **not a public HTTP endpoint** and never launches Python/Node build subprocesses. It only adds validated metadata to the existing local queue. Unknown JSON fields, code injection attempts, symlinked intake files, invalid request IDs, disallowed modes, and stale or future timestamps are rejected. Queueing preserves the existing idempotency key.

## Boundaries

This is a manual, operator-controlled exchange, not an encrypted or signed message transport. The operator must still evaluate authenticity and intent before enqueuing. Token storage, network access controls, independent receipt signing, rate limiting, sandboxing arbitrary generated source, and a public job gateway require separate designs and authorization. Existing VPSBridge access restrictions remain unchanged; this release does not install a VPS service or create scheduled tasks.
