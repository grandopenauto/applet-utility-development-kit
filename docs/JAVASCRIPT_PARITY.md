# AUDK v2.3 — Bounded JavaScript candidate parity (human-review only)

This stage compares **six hand-coded, first-party mathematical JavaScript prototypes** with the sealed CPython 3.13 oracle established in v2.2. It never compiles SDK discovery metadata, adds a reviewed recipe, promotes an applet, or opens an HTTP service. Passing reference fixtures proves only limited agreement on these examples, **not full Python behavioral equivalence**.

## Operator usage

Preview six candidates without executing Python or writing files:

```sh
npm run parity:javascript
```

Capture and compare only explicitly named approved fixtures, saving a private evidence report:

```sh
npm run parity:javascript -- --ids math.tan,math.acos --compare --python python --output /tmp/audk-js-parity-001
```

The output must be a **new, nonexistent absolute directory**, outside the source checkout. The Python oracle runs with its existing `-I -S` flags, pins the reference code hash and executes only fixed first-party examples. No arbitrary expressions, source code, or test inputs can be submitted to this command.

## Comparison policy

- `math.tan`: prototype input limited to [-1.2, 1.2]; excludes singularities near ±π/2.
- `math.acos`, `math.asin`: valid inputs [-1,1]. The prototype maps out-of-domain numeric inputs to a Python-like `ValueError` classification rather than JS's native `NaN`.
- `math.acosh`: valid prototype range [1,10]; values below 1 map to Python-like `ValueError`.
- `math.atanh`: prototype domain [-0.95,0.95], with ±1 classified `ValueError` as CPython does.
- `math.erf`: original fixed 40-term Maclaurin approximation, **only** [-1,1]; compare against CPython before assuming accuracy; never reuse as a general-purpose `erf` implementation without independent numerical analysis.
- For reference values, agreement is `|js - py| <= 5e-13 + 5e-13*|py|`. These are example-based tolerances, not proven worst-case numerical bounds. Expected `TypeError`/`ValueError` are compared as **normalized outcome classifications**; JS's native exceptions, coercion, and Python's full type behavior are not asserted to match.

The private report records every reference outcome, candidate outcome, error difference, source digest, Python oracle hash, and per-function pass/fail count. The report is **not signed or independently attested**. A pass does not waive documentation review, property tests, licensed-code review, security review or an explicit human approval and pull request before any registry promotion.

## Security / deployment

- Allowed IDs are fixed first-party functions; unknown and powerful Python builtins cannot execute.
- Only the sealed Python oracle and first-party JavaScript candidates are executed, with no public user-input API.
- There is no automatic publication, GitHub write, remote ingestion, permanent worker or VPS deployment.
- A low-privilege/disposable environment is preferred for future extended property tests; this code alone is not an untrusted-code sandbox.
