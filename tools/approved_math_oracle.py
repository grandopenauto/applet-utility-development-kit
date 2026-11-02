"""AUDK v2.2: sealed, first-party Python math reference fixture runner.

Only enumerated pure math functions and literal, bounded cases are permitted.
No source text, function expression, Python snippet or arbitrary input is evaluated.
"""
import json
import math
import sys

SCHEMA = "audk.math-reference-oracle.v1"
REQUEST = "audk.math-reference-request.v1"
# Each fixture is (case ID, x, expected outcome, expected exception type).
CASES = {
    "math.tan": [
        ("reference-01", 0.0, "value", None),
        ("reference-02", 0.5, "value", None),
        ("reference-03", -0.5, "value", None),
        ("reference-04", 1.0, "value", None),
        ("type-invalid-01", "not-a-number", "error", "TypeError"),
    ],
    "math.acos": [
        ("reference-01", -1.0, "value", None),
        ("reference-02", 0.0, "value", None),
        ("reference-03", 1.0, "value", None),
        ("reference-04", 0.5, "value", None),
        ("domain-invalid-01", 1.01, "error", "ValueError"),
        ("domain-invalid-02", -1.01, "error", "ValueError"),
    ],
    "math.asin": [
        ("reference-01", -1.0, "value", None),
        ("reference-02", 0.0, "value", None),
        ("reference-03", 1.0, "value", None),
        ("reference-04", 0.5, "value", None),
        ("domain-invalid-01", 1.01, "error", "ValueError"),
        ("domain-invalid-02", -1.01, "error", "ValueError"),
    ],
    "math.acosh": [
        ("reference-01", 1.0, "value", None),
        ("reference-02", 2.0, "value", None),
        ("reference-03", 5.0, "value", None),
        ("domain-invalid-01", 0.0, "error", "ValueError"),
        ("domain-invalid-02", -1.0, "error", "ValueError"),
    ],
    "math.atanh": [
        ("reference-01", -0.5, "value", None),
        ("reference-02", 0.0, "value", None),
        ("reference-03", 0.5, "value", None),
        ("domain-invalid-01", 1.0, "error", "ValueError"),
        ("domain-invalid-02", -1.0, "error", "ValueError"),
    ],
    "math.erf": [
        ("reference-01", -1.0, "value", None),
        ("reference-02", 0.0, "value", None),
        ("reference-03", 1.0, "value", None),
        ("reference-04", 0.5, "value", None),
        ("type-invalid-01", "not-a-number", "error", "TypeError"),
    ],
}
FUNCTIONS = {
    "math.tan": math.tan,
    "math.acos": math.acos,
    "math.asin": math.asin,
    "math.acosh": math.acosh,
    "math.atanh": math.atanh,
    "math.erf": math.erf,
}


def run():
    if sys.version_info[:2] != (3, 13):
        raise ValueError("Python 3.13 required to match pinned catalog")
    raw = sys.stdin.buffer.read(2049)
    if len(raw) > 2048:
        raise ValueError("Oracle request exceeds 2048 bytes")
    obj = json.loads(raw)
    if not isinstance(obj, dict) or set(obj) != {"schema", "ids"} or obj["schema"] != REQUEST:
        raise ValueError("Invalid oracle request schema")
    ids = obj["ids"]
    if not isinstance(ids, list) or not (1 <= len(ids) <= 6) or len(set(map(str, ids))) != len(ids):
        raise ValueError("Invalid oracle selection")
    if any(not isinstance(key, str) or key not in FUNCTIONS for key in ids):
        raise ValueError("Oracle allows only approved pure math fixtures")
    records = []
    for key in ids:
        output = []
        for case_id, value, intended, error_type in CASES[key]:
            try:
                result = FUNCTIONS[key](value)
                if intended != "value" or not math.isfinite(result):
                    raise AssertionError("Fixture unexpected success or non-finite output")
                outcome = {"kind": "value", "value": result, "floatHex": float(result).hex()}
            except (ValueError, TypeError) as exc:
                if intended != "error" or type(exc).__name__ != error_type:
                    raise AssertionError("Fixture unexpected exception") from exc
                outcome = {"kind": "error", "exception": error_type}
            output.append({"caseId": case_id, "inputs": {"x": value}, "outcome": outcome})
        records.append({"functionId": key, "cases": output})
    result = {
        "schema": SCHEMA,
        "pythonVersion": "%d.%d.%d" % sys.version_info[:3],
        "pythonImplementation": sys.implementation.name,
        "records": records,
        "codeExecution": "fixed-approved-math-fixtures-only",
        "sourceCodeAccepted": False,
        "approvedRecipe": False,
        "automaticPublication": False,
    }
    sys.stdout.write(json.dumps(result, ensure_ascii=True, allow_nan=False, separators=(",", ":")) + "\n")


if __name__ == "__main__":
    try:
        run()
    except (ValueError, TypeError, KeyError, AssertionError, json.JSONDecodeError) as exc:
        sys.stderr.write("AUDK_ORACLE_REJECTED=" + type(exc).__name__ + "\n")
        raise SystemExit(2)
