# Discrete Python elements

TypeScript owns the Agent Runtime and RM Agents.

Python is for **discrete** jobs only: mathlib, statistical analysis, or ML.
Those jobs return JSON to the runtime. They must **not** invent Finding `score`
or `recommended_action`.

| Script | Task id | Purpose |
|--------|---------|---------|
| `analyze_stub.py` | `ping` | Interpreter availability probe for Engine Activity |
| `driver_analysis.py` | `science.driver_analysis.v0` | Peerset / prior / decision moments / material+revenue value (advisory Evidence) |

Run via the engine:

```bash
npm run driver-analysis
# or POST /science/driver-analysis
```

Evidence is persisted to `rm_science_evidence` (not `rm_findings`). Role starts as
`advisory`; promotion to `source` is gated for later prior/peerset consumers.
