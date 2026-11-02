# AUDK v2.4 — Fixed Python–JavaScript property parity

This **development-only** gate extends the first-party v2.3 numerical comparisons from 32 review fixtures to **606 deterministic reference inputs** (101 per experimental candidate) and **12 negative/boundary classifications**. A repository-pinned Python script evaluates only six hard-coded `math` functions; it does not accept code, names, arguments or user-defined input. Node compares actual Python 3.13 results with existing bounded, first-party JavaScript candidate adapters.

Supported candidates: `math.tan`, `math.acos`, `math.asin`, `math.acosh`, `math.atanh`, `math.erf`. The approximation for `math.erf` is still explicitly restricted to the interval [-1, 1]; this test is not a proof of complete numerical accuracy across the function's domain.

The gate independently checks monotonicity for each sampled function. For symmetric functions it checks oddness; for `acos` it checks `acos(x) + acos(-x) ≈ π`. The 12 separate negative/boundary checks validate prototype rejection or Python-like error classifications for invalid inputs. All numerical comparisons use a bounded absolute+relative tolerance (5e-13 + 5e-13×|reference|).

Use:

```bash
# Safe preview, no Python execution or filesystem writes
npm run parity:properties

# Explicitly invoke only the pinned CPython 3.13 oracle, print a summary
npm run parity:properties -- --check --python python

# Explicitly write the report into a NEW private folder
npm run parity:properties -- --check --python python --output /tmp/audk-parity-properties-review
```

On Windows select an approved absolute Python 3.13 path for `--python` and a separate private output directory. The local shell command does not install a VPS task or create a network service.

**Security and review:** The property oracle only executes fixed, reviewed first-party Python `math` calls, never SDK-discovered or externally supplied functions. There is no general sandbox for untrusted code. Outputs are untrusted review evidence, protected by reproducible hashes but not signed. The operator must still independently review domain semantics, tolerances, failure behavior, code, licensing, and security before an explicit GitHub pull request promoting any new recipe. No registry write, build queue enqueue, promotion or automatic publication happens here.
