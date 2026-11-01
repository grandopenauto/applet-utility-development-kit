# AUDK — Applet Utility Development Kit

**Build a function once. Configure it visually. Execute it without recompilation. Export the code when needed.**

AUDK is an early-stage, modular applet library and guided development environment. This repository includes an interactive nested-loop wizard, bounded declarative JSON macro interpreter, step-by-step execution tracing, tests, JavaScript export, a local HTTP API, and an illustrative Digital CrossDock scenario.

**Live site (once Pages and DNS resolve):** https://audk.digitalcrossdock.com

## GitHub Pages — browser-only demo

The root \`index.html\`, \`style.css\`, \`pages-app.js\` and \`src/engine.mjs\` provide a static, interactive demonstration. JavaScript macros execute locally in the browser, not on a server. Public Pages hosting has **no** filesystem, privileged OS controls, or live HTTP API.

Example applets load from \`library/*.json\` and \`scenarios/digital-crossdock-slot-matrix.json\`. The CrossDock scenario visualizes door × appointment-slot combinations; it is **not a real scheduling, optimization or booking service**.

## Local Node.js server

Requires Node.js 20 or later. No dependencies required.

\`\`\`bash
npm start
# Open http://127.0.0.1:4173
npm test
npm run check
\`\`\`

By default the local server binds to **127.0.0.1 only**. Do not expose its API publicly without authentication, authorization, rate limits and further security review.

Available local-only endpoints:

| Verb | Endpoint | Description |
|---|---|---|
| GET | \`/api/health\` | Health |
| GET | \`/api/applets\` | Registry manifests |
| POST | \`/api/validate\` | Validate macro |
| POST | \`/api/run\` | Execute bounded macro |
| POST | \`/api/code\` | Export JavaScript |
| POST | \`/api/test\` | Self-checks |

## Structure

- \`index.html\` / \`pages-app.js\` / \`style.css\`: static Pages applet studio
- \`src/engine.mjs\`: shared declarative runtime, validation, tracing, source exporter
- \`src/server.mjs\`: optional local Node HTTP server for the same studio and API
- \`library/\`: versioned sample applets
- \`scenarios/\`: Digital CrossDock demonstration (illustrative)
- \`tests/\`: automated tests
- \`.github/workflows/test.yml\`: validation on changes

## GitHub Pages and DNS

Repository: \`grandopenauto/applet-utility-development-kit\`

In **Settings → Pages**, select **Deploy from a branch**, branch \`main\`, folder \`/(root)\`. Set custom domain \`audk.digitalcrossdock.com\` and preserve the root \`CNAME\` file. In your authoritative DNS zone create \`CNAME audk → grandopenauto.github.io\` (no URL scheme or repository path). Enable Enforce HTTPS once GitHub completes certificate provisioning.

## Roadmap, scope and safety

Future components may include configuration-wizard schemas, file watchers, complex macro composition, sandboxed code generation, platform-specific adapters and a review-gated Applet Factory. **These are not built yet.** This initial demo supports nested numeric loops and branch visualization only.

No \`eval\`, dynamic arbitrary code execution, shell commands or remote OS operations are present in the browser demo. Generated code is shown as text; it is not executed automatically. Do not automatically merge or deploy AI-generated privileged code.

## License

No open-source license has been chosen. Public source visibility does not automatically grant redistribution or commercial-use permission. Select an appropriate license before inviting external contributions.
