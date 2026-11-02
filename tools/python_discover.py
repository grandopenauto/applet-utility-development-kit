#!/usr/bin/env python3
"""AUDK v0.5: read-only, allowlisted Python callable discovery.

This discovers signatures/doc summaries, NOT executable AUDK applets. Arbitrary
modules are not imported and discovered functions are never invoked.
"""
import argparse
import builtins
import importlib
import inspect
import json
import platform
from pathlib import Path

MODULES = ("builtins", "math", "statistics", "itertools", "functools", "operator", "json")
MAX_ENTRIES_PER_MODULE = 250


def discover(modules=MODULES):
    output = []
    for name in modules:
        if name not in MODULES:
            raise ValueError(f"Module {name!r} is not allowlisted")
        module = builtins if name == "builtins" else importlib.import_module(name)
        for member_name, member in inspect.getmembers(module):
            if member_name.startswith("_") or not callable(member):
                continue
            try:
                signature = str(inspect.signature(member))
            except (ValueError, TypeError):
                signature = "(signature unavailable)"
            doc = inspect.getdoc(member) or ""
            line = doc.splitlines()[0] if doc else "No documentation summary available"
            output.append({
                "module": name,
                "name": member_name,
                "qualifiedName": f"{name}.{member_name}",
                "signature": signature[:240],
                "summary": line[:240],
                "kind": "function" if inspect.isroutine(member) else "callable",
                "status": "discovered-only",
            })
        if sum(v["module"] == name for v in output) > MAX_ENTRIES_PER_MODULE:
            raise ValueError(f"Exceeded catalog limit for {name}")
    return {"schema": "audk.discovery.v1", "pythonVersion": platform.python_version(),
            "modules": list(modules), "count": len(output), "entries": output}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--modules", nargs="*", choices=MODULES, default=list(MODULES))
    parser.add_argument("--output", help="Optional output JSON path")
    args = parser.parse_args()
    catalog = discover(args.modules)
    data = json.dumps(catalog, indent=2, ensure_ascii=False) + "\n"
    if args.output:
        Path(args.output).write_text(data, encoding="utf-8")
        print(f"Discovered {catalog['count']} callables in {len(catalog['modules'])} modules -> {args.output}")
    else:
        print(data)


if __name__ == "__main__":
    main()
