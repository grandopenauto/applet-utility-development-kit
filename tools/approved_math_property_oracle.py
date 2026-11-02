#!/usr/bin/env python3
"""AUDK v2.4 deterministic CPython property oracle, first-party fixed math cases only.
No command-line arguments, stdin, imports of discovered libraries, or user-supplied code.
"""
import json
import math
import sys

if len(sys.argv) != 1:
    raise SystemExit('No CLI arguments accepted')
if sys.version_info[:2] != (3, 13):
    raise SystemExit('CPython 3.13 required')

# Sampling grid is built in the oracle itself; JavaScript cannot alter these inputs.
BOUNDS = (
    ('math.tan', -1.2, 1.2),
    ('math.acos', -1.0, 1.0),
    ('math.asin', -1.0, 1.0),
    ('math.acosh', 1.0, 10.0),
    ('math.atanh', -0.95, 0.95),
    ('math.erf', -1.0, 1.0),
)
FUNCTIONS = {
    'math.tan': math.tan, 'math.acos': math.acos,
    'math.asin': math.asin, 'math.acosh': math.acosh,
    'math.atanh': math.atanh, 'math.erf': math.erf,
}

case_groups = []
for fid, lower, upper in BOUNDS:
    fn = FUNCTIONS[fid]
    group = []
    for i in range(101):
        x = lower + ((upper - lower) * i / 100)
        y = fn(x)
        if not math.isfinite(y):
            raise SystemExit('Unexpected nonfinite reference result')
        group.append({'x': x, 'value': y})
    case_groups.append({'functionId': fid, 'bounds': [lower, upper], 'cases': group})

result = {
    'schema': 'audk.math-property-oracle.v1',
    'pythonVersion': '.'.join(map(str, sys.version_info[:3])),
    'groups': case_groups,
    'policy': {'fixedInputs': True, 'dynamicEvaluation': False,
               'untrustedCodeExecution': False, 'automaticPromotion': False,
               'automaticPublication': False},
}
print(json.dumps(result, separators=(',', ':'), allow_nan=False))
