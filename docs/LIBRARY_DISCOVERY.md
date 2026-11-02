# AUDK v0.9 — Library discovery and Python intake

## Public studio

Open `https://audk.digitalcrossdock.com/#library`. Search the 12 validated manifests; filter by category or type; select one to see the version, provenance, example(s), and a bounded interpreter preview. **Configure this applet** opens the existing corresponding wizard. The browser never installs code or makes privileged calls.

The sidebar remains a quick-launch list. Library Browser is the searchable catalog. The library index pins approved manifest filenames; new Python catalog entries are not automatically inserted into it.

## Python Explorer / intake proposals

The Python snapshot lists callable *metadata*, not installable or safe code. Entries corresponding to allowlisted recipes can be opened in Universal Wizard. All other entries offer **Export review intake**, producing `audk.python-intake.v1` JSON. It includes a name, signature, description, and required review steps; it expressly sets `runtimeEnabled:false` and `autoPublish:false`. This file must be evaluated by a developer. It cannot be used to execute arbitrary Python or publish to GitHub.

To actually add a new callable, implement a bounded recipe or isolated adapter, add test cases (including boundary conditions and Python/JavaScript comparisons where possible), produce a review packet, and submit a pull request. The existing v0.7 review/CI gates remain mandatory. No auto-merge or live execution is introduced.

## Local API

`npm start` binds to `127.0.0.1:4173` by default. `GET /api/library/search?search=sqrt&category=Mathematics&kind=curated-function` returns only metadata from validated registry entries. Category and kind are allowlisted; an invalid filter returns 400. The static GitHub Pages site serves no REST API.

## Verification

- `npm test` runs catalog/intake and existing runtime, review, Python and fixture tests.
- `npm run check` verifies the 12 versioned registry files.
- `GET /api/library/search` should filter correctly on the local server.
- In a browser: search `sqrt` in `#library`, select the result, change example, open its wizard, then search `math.cos` under `#python` and export a metadata-only intake. Inspect its safety fields.
- A headless Playwright attempt in the ChatGPT execution environment was blocked by an administrator navigation rule (`ERR_BLOCKED_BY_ADMINISTRATOR`). Browser click-through on the live URL remains a release follow-up.

## Security boundaries

- Do not treat discovery results as reviewed or executable.
- Render discovered text with `textContent`, never `innerHTML`.
- Keep the public website browser-local and the development HTTP API loopback-only by default.
- Keep GitHub source review as the publication gate; do not enable automated write access from the browser.
- Keep CNAME and GitHub Pages source configuration unchanged.
