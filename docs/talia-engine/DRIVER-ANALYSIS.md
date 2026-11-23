# Driver Analysis (Prior / Peerset / Value)

Discrete science element in **talia-engine** (`science.driver_analysis.v0`).

## Purpose

- Analyse historic booking horizons: peerset, prior, decision moments, material + revenue deltas.
- Show the same method at **now** (forward book Groups/MR manage) with value at stake.
- Argue why elevating prior/peerset quality improves future revenue.
- Advisory first (`role: advisory`); optional promotion to `source` for consumers.

## Not an RM Agent

Python must **not** invent Finding `score` or `recommended_action`. Artifacts live in `rm_science_evidence`, not `rm_findings`.

## Run

```bash
cd talia-engine
npm run driver-analysis
# POST /science/driver-analysis
```

UI: focus panel **Driver Analysis** (`driver-analysis`).

## Future source consumers

When `role=source`, read via `talia-server/src/lib/scienceEvidenceConsumer.ts`:

- `loadSourceEvidenceForSail(sailCode)` — prior/peerset payload + citation
- `attachScienceCitation(finding.evidence, citation)` — Probability/Regulator may cite only

Do not cut over `profile_model_map` or Groups MR until promotion is intentional.
