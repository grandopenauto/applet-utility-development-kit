# AUDK `math.tan` — Draft implementation review (not approved)

**Status: DRAFT; do not merge as an approved recipe.** This proposal deliberately avoids all changes to `UNIVERSAL_RECIPES`, `library/`, `policy/worker-source-lock.json`, the build queue, website publication and Windows worker deployment.

## Proposed *narrow* contract

The experimental implementation exports `evaluateMathTanProposal(x)` as a pure function returning an outcome object. It accepts only primitive, finite JavaScript numbers from **-1.2 through 1.2 radians**, inclusive, and returns a finite `Math.tan(x)` value. `-0` remains negative zero. Any other type (including booleans), NaN or infinities returns `{kind:'error',exception:'TypeError'}` without converting inputs. Finite values outside the bound return `{kind:'unsupported'}`. There are no filesystem, network, process, timer, dynamic evaluation or third-party dependencies.

This is **not** a fully compatible implementation of Python `math.tan`: Python permits booleans as numeric input, treats infinite values differently, and supports a wider numeric domain. This proposal intentionally excludes the vicinity of ±π/2, where tangent is ill-conditioned.

## Verification on the review branch

Run `node --test tests/math-tan-review.test.mjs`, `npm test`, `npm run check`, and `node scripts/verify-worker-lock.mjs`. The new focused suite uses the **existing checked-in fixed CPython 3.13 property oracle** (101 `math.tan` cases, `-I -S` Python, no dynamic code) and compares the proposal against the existing candidate parity adapter on 1001 deterministic numeric inputs. It tests endpoint values, signed zero, denied coercion, and out-of-bounds behavior. No tests should silently approve a new recipe.

Numerical criterion: |JS - Python| ≤ 5e-13 + 5e-13 × |Python| for the 101 fixed CPython cases. Passing the finite grid is not proof of full accuracy, platform independence, mathematical correctness at all inputs, or a signed attestation.

Official references:
- Python 3.13 math module: https://docs.python.org/3.13/library/math.html
- JavaScript Math.tan: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/tan

## Required human decision — no approval has been granted

- [ ] Accept/reject the *restricted subset* in lieu of Python's full semantics.
- [ ] Confirm finite-number-only type policy and nonfinite `TypeError` classification.
- [ ] Confirm ±1.2 interval, boundary behavior, signed zero and documented numerical tolerance.
- [ ] Independently review tests, source, official documentation and cross-platform CI.
- [ ] Agree on applet identifier, version, manifest, error contract and license.
- [ ] Only after recorded human authorization, create **another separately reviewed PR** that updates the allowlisted recipe, generated exports, registry and source lock.

**Merge caveat:** This draft PR may be reviewed as experimental source, but merging it does not by itself approve `math.tan` for runtime or registry promotion. Keep it unmerged until the owner reviews it.
