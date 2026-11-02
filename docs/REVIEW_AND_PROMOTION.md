# AUDK Review & Promotion (v0.7)

The Applet Review Desk creates **review packets**, not new trusted or published code. The public GitHub Pages experience remains browser-only; review operations are deterministic for eight allowlisted pure functions. Python discovery records are not executable applets.

## Review lifecycle

1. **Discover/configure**: Select an allowlisted function in the Universal Wizard or Review Desk.
2. **Build candidate**: Generate the versioned manifest and JavaScript/Python/test artifacts. Everything executes locally for previews.
3. **Verify evidence**: `audk.review.v1` packets store example cases, interpreter results, provenance and SHA-256 digests of the manifest/configuration/artifacts/evidence. SHA-256 detects alteration but does not authenticate a reviewer or prove Python execution. The automated CI tests run generated Python and JavaScript for reviewed recipes.
4. **Local acknowledgment**: A reviewer may record their name label, notes and checkbox, producing `audk.promotion-proposal.v1`. This is a **local self-attestation only**, not a verified approval.
5. **Stage locally**: A developer independently reviews the proposal and uses the CLI to produce a registry-compatible file. Staging changes a local working tree only.
6. **Publish deliberately**: Submit a pull request with the proposal source, generated code/test evidence and registry entry. Check diffs, run tests, obtain authorized code review, and merge to publish. There is no auto-push, auto-merge, remote arbitrary-code execution or server-side registry mutation endpoint.

## CLI walkthrough

Download `<id>.review.json` and `<id>.proposal.json` from the Review Desk, or generate the proposal locally:

```sh
npm run review:propose -- --packet ./candidate.review.json --reviewer "Review Team" --note "Inspected the code and test evidence" --acknowledge
```

This writes `proposals/<id>.proposal.json` with exclusive create; it refuses overwrites and an existing applet ID.

To create an **uncommitted** registry entry, after inspecting the files:

```sh
npm run review:stage -- --packet ./candidate.review.json --proposal ./proposals/<id>.proposal.json --confirm-stage
npm test
npm run check
```

This writes `library/<id>.json` locally using exclusive create. Only after separate GitHub PR review and CI should the registry addition be merged. Stage does **not** grant trust or publish remotely.

## API (localhost only)

- `POST /api/review/packet` — build a reviewed-function candidate packet from an allowlisted config.
- `POST /api/review/verify` — independently regenerate and check a review packet.
- `POST /api/review/proposal` — produce a local proposal after explicit reviewer notes and acknowledgement.

These routes do not create files. The public Pages site does not expose them. The default HTTP listener is `127.0.0.1`; do not bind the service publicly without authentication, authorization, isolation and abuse controls.

## Trust limits

- SHA-256 is **not** a digital signature. Anyone can generate a structurally valid local acknowledgment; authenticated maintainer GitHub review remains mandatory.
- Example evidence runs AUDK's bounded JS interpreter only; it is not a cryptographic proof of software correctness or proof that a remote Python execution occurred.
- Only the current eight allowlisted pure-function recipes are supported. No arbitrary Python modules, filesystem, process, network or shell permissions are granted.
- The review feature does not silently change the four existing library applets. Promotion changes require explicit manual staging and an actual GitHub merge.
- Do not upload credentials, system logs containing private data or untrusted Python source to review packets. Keep package generation reproducible.
