# AUDK v2.2 — Controlled CPython reference evidence

This **operator-only** tooling takes v2.1 SDK-to-recipe drafts for six explicitly reviewed **reference-fixture choices** and produces independent CPython 3.13 observations. This is **not** approval of an executable applet implementation and does not publish or modify the existing 28 applets or 24 reviewed wizard recipes.

## Supported functions and limits

Only `math.tan`, `math.acos`, `math.asin`, `math.acosh`, `math.atanh`, `math.erf` have sealed first-party test fixtures. The Python script `tools/approved_math_oracle.py` has a literal table of 32 bounded cases, including 10 invalid-domain/type cases. It rejects arbitrary function names, parameters, Python code and non-3.13 runtimes. The Node runner invokes Python with `-I -S`, stdin JSON, a 10-second default subprocess timeout, and bounded output. The JavaScript layer binds every capture to the pinned v2.1 draft checksum and the reference-runner source SHA-256. This is **not a full hostile-code sandbox** and is not designed to execute externally generated Python or arbitrary documentation snippets.

## Commands

Inspect metadata only (no Python invoked, no files written):

```bash
npm run reference:python -- --ids math.tan,math.acos
```

Collect fixed Python cases and write to a **new, private absolute folder**:

```bash
npm run reference:python -- --ids math.tan,math.acos,math.asin,math.acosh,math.atanh,math.erf --python python --capture --output /tmp/audk-python-reference-001
```

On Windows use a tested Python 3.13 executable path and a **new private** output directory outside the checkout. Do not install this as a privileged recurring task or expose a web API.

The output includes one `math-*.reference.json` per function, `reference-report.json`, and `REVIEW-CHECKLIST.md`. It records actual finite floating-point results (including `float.hex`) and Python `ValueError` / `TypeError` cases. Results may vary slightly across CPU/libm/platform; no blanket claim of bit-exact JS parity is made.

## Gates remaining

- The reference case table is a vetted *test scope*, **not** the complete input contract. Documentation references point at the official [Python 3.13 math manual](https://docs.python.org/3.13/library/math.html), but individual docs, precision rules and numerical domains still require independent review.
- Numeric values are observations from the specified Python runtime, not independent certified mathematical proofs or signed attestations. An operator must approve representative input limits, extended edge cases, and cross-language tolerances.
- A new JavaScript/Python recipe requires separate code, security, and regression review. Only then may a pull request propose adding it to `UNIVERSAL_RECIPES` and the public applet library. No automatic promotion, PR creation, publication, unreviewed execution or VPS changes occur here.
