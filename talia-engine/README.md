# talia-engine

Independent **Agent Runtime** for Talia. It is not part of `talia-server`.

**Terminology is normative in** [ADR-001](../docs/adr/ADR-001-rm-agent-framework-terminology.md).

| Term | Meaning |
|------|---------|
| RM Agent | Specialist evaluator (Regulator today). Not an LLM. |
| Finding | Score + recommended action + evidence |
| Checklist | UI over Findings |
| Talia Assistant | Later LLM helper. Not an RM Agent. |

## Run locally (own process)

```bash
cd talia-engine
npm install
npm run dev          # :4100
npm run run          # one-shot evaluate + persist Findings
npm test
```

Default port **4100**. Reads World State from local Supabase and writes `rm_findings` / `rm_engine_runs`. The dashboard never needs this process to *view* stored Findings; it does need it to run evaluations and show live Activity.

## Docker

`docker-compose.talia.yml` service `talia-engine` (`4100`). Python 3 is in the image for later discrete math/ML jobs (`python/`).

## v0 slice

1. Runtime + registry + Finding validation
2. Regulator vs inventory target load-factor + occupancy
3. Persist Findings
4. UI Checklist + Engine Activity (via talia-server GraphQL)

Probability, Competitor, Assistant, and reservation write-back are not in v0.

## Driver Analysis (science element)

Discrete Python job `science.driver_analysis.v0` — peerset / prior / decision moments /
material+revenue value. Advisory Evidence in `rm_science_evidence` (not Findings).

```bash
npm run driver-analysis
```

See [docs/talia-engine/DRIVER-ANALYSIS.md](../docs/talia-engine/DRIVER-ANALYSIS.md).
