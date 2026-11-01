# Applet Utility Development Kit (AUDK) — v0.2 working prototype

**Build a function once. Configure it visually. Execute it as a macro. Export the code when needed.**

This is a working proof-of-concept for an **Applet Utility Development Kit (AUDK)**: a portable library of versioned, testable executable applets that can be invoked from a wizard, JSON macro, CLI, or HTTP API. This project is distinct from Google's Agent Development Kit (ADK).

## New in v0.2 — Applet Composer

The live GitHub Pages workbench now has an **Applet Composer** alongside the original nested-loop wizard. Compose a JSON macro from **cross join, map, filter, switch, sort, and aggregate** operations. It includes:

- Guided configuration forms for a range or list source and each connected applet.
- Reordering, removal, step-by-step data previews, output row counts and trace inspection.
- Two concrete runnable scenarios: **Digital CrossDock door/slot routing** and **inventory reorder calculation** (illustrative logic, not connected to live systems).
- **View Code** generates standalone JavaScript from the same JSON; **Macro JSON** runs without compilation.
- Save/load a macro in this browser, or download/import its JSON file.
- Local Node HTTP endpoints `POST /api/pipeline/validate`, `POST /api/pipeline/run`, `POST /api/pipeline/code`.
- Limits: 24 steps, 5,000 rows, validated fields/types, no code eval, arbitrary JavaScript, shell access, uploads or public API.

Note: this is a **declarative, sequential pipeline**, not yet a full visual directed-graph editor or an autonomous applet producer. Publishing generated applets is still a review-gated future milestone.

## What works today

- Interactive responsive browser studio with seven tabs: **Configure, Visualize, View Code, Macro JSON, Test Lab, API**.
- A nested `for`-loop wizard: variable names, start/end/step, inner/outer loops, operations, optional `switch` branch based on sum parity.
- Interactive execution tracing and stepping forward/backward through each iteration.
- Save a macro as JSON, edit its JSON, load it into the wizard, and execute **without recompiling**.
- Generate real, readable JavaScript equivalent to the interpreted macro.
- A discoverable applet registry with sample entries and a CLI template-based **Applet Factory**.
- Local-only HTTP API and optional Express 5 adapter. Built-in input validation and maximum execution bounds.
- Automated Node.js tests, including a generated-code/interpreter equivalence test, and a GitHub Actions workflow.

**Not yet built:** arbitrary applet generation by AI, autonomous publishing, arbitrary OS-function access, file watchers, visual drag-and-drop graph composition, mobile-native builds, remote deployment, compilation pipeline, real-time file change subscriptions, and authentication for public-hosted multi-user systems. The v0.1 applet factory is deterministic/template-based; it does **not** generate arbitrary code from a prompt. These are future work, not claimed capabilities.

## Run locally (no dependencies required)

Requires Node.js 20 or newer:

```bash
npm start
```

Open **http://127.0.0.1:4173**. The default server uses built-in `node:http`, so no `npm install` is needed for this mode.

To run inside an Express environment instead:

```bash
npm install
npm run start:express
```

The optional Express dependency is intentionally isolated from the core runtime.

## Run tests

```bash
npm test
npm run check
```

Generate a new applet registry item from a tested template:

```bash
npm run generate -- my-first-applet
npm run check
```

The CLI creates `library/my-first-applet.json`. Every applet is a versioned manifest and a declarative macro that can be configured and executed without recompilation. Commit reviewed additions to GitHub; future automated creation should use pull requests with required checks and human approval.

## API

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | Check local server |
| GET | `/api/applets` | List registered applets |
| POST | `/api/validate` | Validate a macro |
| POST | `/api/run` | Execute a macro and return trace rows |
| POST | `/api/code` | Generate JavaScript |
| POST | `/api/test` | Run applet self-checks |
| POST | `/api/pipeline/validate` | Validate a composed applet pipeline |
| POST | `/api/pipeline/run` | Execute pipeline and return per-step trace |
| POST | `/api/pipeline/code` | Export standalone JavaScript for pipeline |

Example (in a shell):

```bash
curl -s http://127.0.0.1:4173/api/run \
  -H 'Content-Type: application/json' \
  -d '{"name":"sample","outer":{"name":"i","start":1,"end":3,"step":1},"inner":{"name":"j","start":1,"end":4,"step":1},"operation":"product","branchBy":"sumParity"}'
```

## Architecture

- **Applet Studio**: wizard / execution trace / source-code preview.
- **Declarative macro**: version-controlled JSON, reusable without application recompilation.
- **Runtime**: bounded interpreter, validates macro structure, no `eval` or arbitrary JS/OS access.
- **Code exporter**: human-readable JavaScript for conventional use.
- **Registry**: versioned applet library, auto-discovered from `library/*.json`.
- **Applet Factory**: script that scaffolds an applet from a trusted template and validates it.
- **Transport**: local Node HTTP API with optional Express interface.

## Design guardrails

- Default binding is `127.0.0.1`; **do not** publish this prototype's APIs to the internet as-is.
- Macro execution is strictly declarative; it does not run arbitrary submitted JavaScript or operating-system commands.
- Integer-only bounds; exclusive endpoints; zero-step and invalid variable names rejected; maximum of 5,000 output rows.
- No registry mutation through HTTP, no shell commands, no credentials, no background deployment. The public Composer runs in the visitor browser only.
- Compiling, testing, approving and publishing generated code should be separate stages. In a future auto-builder, generated components should go into **pull requests**, with sandboxed tests, review, and signed releases; never auto-merge AI-generated privileged code.

## Next milestones

1. Generalized typed manifests and capability-scoped execution engine.
2. A full **For/While/Switch/Watch** applet family (watchers isolated in worker processes, lifecycle and resource limits).
3. Guided config schemas, documentation, generated tests and a richer code editor.
4. Graph composition with nested macro applets, version pinning, state snapshots and step-through debugger.
5. Applet Factory with AI-assisted source creation in an isolated sandbox; PR-based publishing.
6. Optional auth-protected multi-host connectors, packaging, deployment, and monitoring.

## Licensing

**No open-source license has been selected yet.** This prototype is provided to its owner for evaluation; do not assume that uploading a repository makes its source open-source. Select the license and contribution model before publicly accepting contributions.

## Public GitHub Pages demonstration

The repository root has a separate static `index.html`, `style.css` and `pages-app.js`. Its safe nested-loop interpreter runs **entirely in the browser**, without HTTP APIs, server-side execution, credentials, filesystem access or operating-system controls. The Digital CrossDock door/slot example is illustrative: it enumerates combinations, not dispatch or bookings.

To host this demo on GitHub Pages, configure **Settings → Pages → Deploy from a branch → `main` / `(root)`**, then set the custom domain to `audk.digitalcrossdock.com`. Preserve the root `CNAME` file. At the authoritative DNS provider create `CNAME audk → grandopenauto.github.io` (not a URL or repo path). After DNS resolves, enable HTTPS in GitHub Pages.

The API routes in the table above work **only** when running the local Node HTTP/Express server. GitHub Pages cannot host Node.js servers. The `public/` directory remains the local-server version; it is intentionally not the static Pages entry point.

GitHub Actions runs tests on changes. Proposed autogenerated applets should go into reviewed pull requests, never directly to production. Do not commit secrets or environment files.
