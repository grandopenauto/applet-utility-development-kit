# Applet Utility Development Kit (AUDK) — v0.8 working prototype

**Build a function once. Configure it visually. Execute it as a macro. Export the code when needed.**

This is a working proof-of-concept for an **Applet Utility Development Kit (AUDK)**: a portable library of versioned, testable executable applets that can be invoked from a wizard, JSON macro, CLI, or HTTP API. This project is distinct from Google's Agent Development Kit (ADK).

## New in v0.8 — First-party Python applet library expansion

- Eight **pinned first-party pure-function presets** now live in `library/` alongside the original four applets (12 total). Every preset has exact declarative configuration; its JavaScript and Python implementations are generated from reviewed allowlisted recipes, not arbitrary imports.
- The schema-driven Universal Wizard now supports **14** bounded recipes (previously eight); new choices: `math.isqrt`, `math.floor`, `math.ceil`, `builtins.abs`, `builtins.min`, and `builtins.max`.
- `library/index.json` is a versioned static listing so the GitHub Pages library sidebar can browse all published applets without a backend. Choosing a curated preset opens its complete parameters in the Universal Wizard.
- `npm run check` validates that the curated presets exactly match their pinned definitions; `npm test` verifies Python/JavaScript preview equivalence and negative-input limits.
- **Important review distinction:** curated entries are first-party recipes verified by automated cross-language tests. They are not human-signed third-party proposals. New external applets continue through v0.7 review packets, proposals, CI, and GitHub pull-request review. The public site cannot publish code.

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

## AUDK v0.3 — Applet Factory and Windows companion utilities

The **Applet Factory** wizard now generates reviewed-template manifests using a shared, browser-safe JavaScript module. Templates include nested loops, Digital CrossDock door/slot matrices, and inventory thresholds. Each generated manifest is versioned, validated, run immediately without compilation, and accompanied by portable JavaScript. Factory output is **downloaded to the user's browser**, not automatically pushed to GitHub. A pipeline template can be opened in the Applet Composer for further changes. Two tested declarative pipeline examples are included in `library/`.

**Windows HTA companion applications:**

- `downloads/hta/audk-loop-planner.hta` — configure bounded nested-loop JSON on Windows.
- `downloads/hta/audk-slot-matrix.hta` — prepare a Digital CrossDock door/slot pipeline JSON.

Both are small, offline-only, self-contained Windows HTML Applications using legacy JScript syntax. They have **no network, shell, ActiveX, registry writes, or filesystem operations**. Download and review source before executing. HTA applications run with high privileges relative to browser pages, are not a recommended format for untrusted downloads, and may be blocked by your Windows security policy. Microsoft removed direct opening of HTA files from IE/Edge IE-mode download dialogs in 2024; users must save and open manually on compatible Windows installations. The HTAs have not been runtime-tested on a Windows machine; tests verify source constraints and generated macro conventions. A signed, sandboxed modern desktop app is a preferable longer-term distribution path.

New local-only API: `POST /api/factory/preview` returns `{entry,preview,code}` for a validated factory template. No remote repository mutation or compilation occurs.

## What works today

- Interactive responsive browser studio with dedicated workspaces including: **Configure, Visualize, Applet Composer, Applet Factory, Windows HTA Apps, View Code, Macro JSON, Test Lab, API**.
- A nested `for`-loop wizard: variable names, start/end/step, inner/outer loops, operations, optional `switch` branch based on sum parity.
- Interactive execution tracing and stepping forward/backward through each iteration.
- Save a macro as JSON, edit its JSON, load it into the wizard, and execute **without recompiling**.
- Generate real, readable JavaScript equivalent to the interpreted macro.
- A discoverable applet registry with sample entries and a CLI template-based **Applet Factory**.
- Local-only HTTP API and optional Express 5 adapter. Built-in input validation and maximum execution bounds.
- Automated Node.js tests, including a generated-code/interpreter equivalence test, and a GitHub Actions workflow.

**Not yet built:** AI-based arbitrary applet generation, autonomous publishing, arbitrary OS-function access, file watchers, visual drag-and-drop graph composition, mobile-native builds, remote deployment, compilation pipeline, real-time file change subscriptions, and authentication for public-hosted multi-user systems. The v0.1 applet factory is deterministic/template-based; it does **not** generate arbitrary code from a prompt. These are future work, not claimed capabilities.

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
| POST | `/api/factory/preview` | Build, validate, and preview an applet manifest (no publication) |
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

## New in v0.4 — Function Blueprint Lab and real navigation

- **Navigation now follows the active function**: the sidebar, selected tab, workspace heading, breadcrumb, URL hash, and browser Back/Forward controls stay synchronized. Links such as `#blueprints`, `#compose`, and `#windows` open the correct section directly. Mobile retains direct links to the main functions.
- **Function Blueprint Lab** dynamically constructs a configuration wizard from six reviewed function definitions (transform, filter, cross join, switch, sort, aggregate). Set range or list inputs, change function parameters, inspect live execution results, and generate a versioned registry manifest.
- **Three portable output files:** download a manifest JSON, equivalent standalone JavaScript `.mjs`, and a Node.js `.test.mjs` fixture that verifies an observed output count and sample rows. Save all three in the same folder and run `node --test example.test.mjs`.
- **Composer integration:** send a generated single-function pipeline to the existing multi-function Applet Composer for further editing.
- **Safe by default:** no arbitrary JavaScript evaluation, OS access, code compilation service, or automatic GitHub publishing in the public demo. Newly generated applets require review before being accepted into the library.

The local development API also offers `GET /api/blueprints` and `POST /api/blueprints/preview`; GitHub Pages remains browser-only.

## New in v0.5 — Python discovery and Python code export

- **Python Function Explorer** (`#python`) lets visitors search a static, read-only snapshot of callable Python names, signatures, and documentation summaries from seven allowlisted modules: builtins, math, statistics, itertools, functools, operator, and json. The bundled Python 3.13 discovery snapshot contains **354 callable entries**. These entries are **discovered only**—they are not yet verified standalone AUDK applets or public callable APIs.
- `tools/python_discover.py` regenerates the snapshot locally by introspection. It restricts imports to a hardcoded allowlist and never invokes any discovered function. Run `npm run discover:python` on a Python-enabled developer machine to refresh the catalog. The snapshot is Python-version-specific.
- **Python 3.10+ exporter** turns validated declarative Composer pipelines and Function Blueprints into standalone `.py` files. The Python interpreter is **not hosted on GitHub Pages**; export, then run it on your own device. The browser continues to execute only the bounded JavaScript interpreter.
- New local Node HTTP endpoint: `POST /api/pipeline/python` (export only). It does not execute Python.
- Additional automated tests run generated Python in a local subprocess and compare its output to AUDK interpreted results on reviewed scenarios. GitHub Actions performs tests; no Python runtime deployment was introduced.

**Limitations:** Discovery metadata is not a guarantee that reflection yields complete signatures or that a function is safe to execute. The exporter implements AUDK's current six pipeline operations, not arbitrary Python source translation. Review generated source and run it only in a trusted local environment.

### Next work

1. Publish a versioned, typed schema for function parameters and outputs.
2. Add review workflows for mapping discovered Python candidates to vetted applets with generated input wizards, fixtures and error handling.
3. Implement a sandboxed Python execution runner *locally*, with resource limits and opt-in permissions.
4. Create comparative JavaScript/Python test matrices; support multiple Python versions and control-function (loop/branch) exports.
5. Introduce capability-scoped file watchers and optional native/HTA diagnostic extensions; never expose privileged operations directly on the public Pages site.

## New in v0.6 — Universal Applet Wizard (review-gated)

**Live browser route:** `#universal`. This release adds eight curated, pure Python-compatible callable recipes with typed, bounded parameter schemas: `math.sqrt`, `math.factorial`, `math.gcd`, `statistics.mean`, `statistics.median`, `builtins.sum`, `builtins.sorted` (numeric lists), and `builtins.len` (Unicode text). Users can choose a sample, edit auto-generated controls, preview the result locally, and download **candidate manifest JSON, runnable JavaScript `.mjs`, runnable Python `.py`, and a Node.js test fixture**. The JSON manifest uses `audk.universal.v1` and explicitly declares `candidate-review-required`, **not** an installed applet.

The read-only Python Explorer now offers **Configure in Universal Wizard** on these reviewed items. Other discovered callables remain read-only and cannot be invoked. The public Github Pages app remains static and browser-only: no Python execution, `eval`, remote code execution, shell, filesystem access, privileged APIs, or automatic publication.

Local-only API additions: `GET /api/universal/functions` and `POST /api/universal/preview`, compatible with both built-in Node HTTP and optional Express server. Guardrails include allowlisted function names, type checking, finite numeric bounds, JSON array length limits, safe candidate IDs, and explicit review status. The generated test `.test.mjs` should be saved next to the generated `.mjs` and run with `node --test <id>.test.mjs`; run Python locally with `python <id>.py`.

The CI suite now covers curated example cases across JavaScript and Python, candidate validation, API contracts and navigation. The Python discovery snapshot still contains **354 discovered callables**, and the committed `library/` still contains **four published manifests**: these counts must not be combined. The eight recipes are *reviewed function templates*, not eight automatically installed library entries.

Next: add candidate review workflow with versioning and provenance, optional whitelisted output composition, more curated Python functions, and capability-scoped external integrations. Never auto-merge generated code.

## New in v0.7 — Applet Review & Promotion Desk

**Live browser route:** `#review`. Configure an allowlisted function in the Universal Wizard, choose **Send to Review Desk**, or load a sample in the Review Desk. AUDK generates a versioned `audk.review.v1` packet containing candidate input, artifacts, interpreter test cases, provenance and SHA-256 fingerprints. It verifies the packet against a fresh deterministic regeneration, detecting modified code, test results, configuration or manifests.

Reviewers can download the packet, inspect artifacts, and record a local acknowledgment with a name label and review notes. This generates an **unpublished promotion proposal**—not authenticated approval. The public site cannot write to GitHub or the library. Local-only API routes are `POST /api/review/packet`, `POST /api/review/verify` and `POST /api/review/proposal`.

Two new CLI commands provide a deliberate offline workflow: `npm run review:propose` writes a proposal under `proposals/`, and `npm run review:stage` verifies it and writes a single registry-compatible `library/<id>.json` in a local working copy. Both require explicit flags. They neither push to GitHub nor bypass separate source review. `npm run check` now validates promoted pure-function applets and their candidate-manifest fingerprint.

**Full release policy and commands:** [docs/REVIEW_AND_PROMOTION.md](docs/REVIEW_AND_PROMOTION.md).

**Current inventory:** Four existing published registry applets, eight allowlisted universal function recipes, 354 Python discovery records. v0.7 does **not** automatically add new published applets or authenticate reviewers.

**Next:** trusted maintainer PR review integration (no auto-merge), richer example coverage, cross-platform packaging, and more curated Python schemas.
