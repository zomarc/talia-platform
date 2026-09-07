# Discrete Python elements

TypeScript owns the Agent Runtime and RM Agents.

Python is for later **discrete** jobs only: mathlib, statistical analysis, or ML.
Those jobs return JSON to the runtime. They must **not** invent Finding `score`
or `recommended_action`.

v0 ships `analyze_stub.py` so the Activity panel can show whether a Python
interpreter is available.
