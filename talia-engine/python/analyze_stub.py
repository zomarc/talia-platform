#!/usr/bin/env python3
"""Discrete Python element hook. RM Agents must not import this for scores."""
import json
import sys

payload = json.load(sys.stdin) if not sys.stdin.isatty() else {}
print(json.dumps({
    "ok": True,
    "tool": "analyze_stub",
    "task": payload.get("task"),
    "note": "Stub only. Later ML / mathlib jobs return results here; they do not emit Findings.",
}))
