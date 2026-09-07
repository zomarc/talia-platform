# Talia Engine — RM Agent Framework (Sketch)

**Status:** Agreed (aligned with Accepted ADR-001)  
**Normative terminology:** [ADR-001](../adr/ADR-001-rm-agent-framework-terminology.md)  
**Parent vision:** [FUTURE-ARCHITECTURE.md](../FUTURE-ARCHITECTURE.md)

This document sketches the framework. Where it conflicts with ADR-001, **ADR-001 wins**.

---

## 1. Purpose

**talia-engine** hosts a UI-independent **Agent Runtime** that runs **RM Agents**: small, extensible specialist evaluators for revenue management. They observe **World State**, emit normalised **Findings** (score + **Recommended Action** + evidence), and feed a user **Checklist**. Later, approved actions may integrate with the reservation system via **talia-server** (talia GQL / Seaware adapters). Separately, a **Talia Assistant** (local LLM plugin) may help the user interpret Findings — it is not an RM Agent.

---

## 2. Forced terminology (quick reference)

Use these names in code, GraphQL, UI labels, and docs:

| Say this | Not this |
|----------|----------|
| RM Agent | AI agent, LLM agent, bot |
| Agent Runtime | “the AI”, “agent platform” (ambiguous) |
| Finding | insight, alert (unless UI synonym clearly mapped) |
| Recommended Action | “the agent did X” (implies execution) |
| Checklist | “auto-pilot”, “agent actions applied” |
| Talia Assistant | RM Agent, “the LLM agent” |
| World State | “what the LLM knows” |

**Rule:** If both RM Agents and the Assistant are visible, never use bare **Agent** in user-facing copy.

---

## 3. System context

```
┌─────────────────────────────────────────────────────────────┐
│                         talia-ui                            │
│  Checklist panel │ sailing context │ (later) Assistant UI   │
└───────────────────────────┬─────────────────────────────────┘
                            │ GraphQL
┌───────────────────────────▼─────────────────────────────────┐
│                       talia-server                          │
│  World State API │ Finding API │ (later) Action Executor    │
│  Synapse sync │ Supabase │ (later) Seaware / talia GQL write│
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│                       talia-engine                          │
│  ┌───────────────── Agent Runtime ─────────────────────┐    │
│  │  schedule / run-on-demand / register plugins         │    │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐              │    │
│  │  │Regulator │ │Probability│ │Competitor│  … RM Agents │    │
│  │  └────┬─────┘ └────┬─────┘ └────┬─────┘              │    │
│  │       └────────────┴────────────┘                    │    │
│  │                    Findings                          │    │
│  └───────────────────────┬──────────────────────────────┘    │
│                          ▼                                  │
│              Finding store (via server/DB)                  │
│                          │                                  │
│              ┌───────────▼───────────┐                      │
│              │   Talia Assistant     │  optional plugin     │
│              │   (AssistantProvider) │  reads Findings only │
│              └───────────────────────┘                      │
└─────────────────────────────────────────────────────────────┘
```

**Seaware / firewall:** dedicated instance may be unreachable. Engine defaults to synced World State for reads. Writes (Phase C) go through talia-server and may queue until the path is open.

---

## 4. Package sketch (logical)

Language choice (TypeScript worker vs Python service) is **open**; layout should stay isomorphic:

```
talia-engine/
  README.md                 # terminology + pointers to ADR-001
  runtime/
    registry.py|ts          # register RM Agents
    scheduler.py|ts         # cron / on-demand runs
    runner.py|ts            # execute agent, validate Finding envelope
  rm_agents/
    base.py|ts              # RmAgent interface
    regulator/
    probability/
    competitor/
  contracts/
    finding.schema.json     # frozen Finding contract
    action_types.md         # catalogue
  assistant/                # NOT under rm_agents/
    provider.py|ts          # AssistantProvider interface
    local_llm/              # future small local model
  adapters/
    world_state_client      # read via talia-server GraphQL/HTTP
    finding_writer          # persist via server
```

### RM Agent interface (conceptual)

```text
RmAgent
  id: string                          # e.g. rm.regulator.performance_vs_target
  name: string
  evaluate(ctx: EvaluationContext) -> Finding[]

EvaluationContext
  as_of: datetime
  subjects: Subject[] | "all-configured"
  world: WorldStateView               # read-only
  config: AgentConfig                 # thresholds, target set, etc.
```

Agents should be **as simple as possible**. Shared math and data shaping belong in adapters/helpers, not copied inside each agent.

---

## 5. Finding contract (frozen)

See ADR-001 for the normative table. Summary:

- **`score` ∈ [0, 1]** = urgency / need-to-act (not signed deviation)
- **`severity`** ∈ `info | watch | action | critical`
- **`recommended_action`** = `{ action_type, params, rationale }`
- **`evidence`** holds ROS, load factor, targets, gaps, comps, probabilities, etc.
- **`status`** lifecycle: `open → acknowledged | dismissed | applied | expired`

### Example Finding (Regulator)

```json
{
  "finding_id": "f-…",
  "agent_id": "rm.regulator.performance_vs_target",
  "subject": { "type": "sailing", "id": "SAIL-12345" },
  "as_of": "2026-09-07T12:00:00Z",
  "score": 0.82,
  "severity": "action",
  "recommended_action": {
    "action_type": "REVIEW_PRICING",
    "params": { "target_id": "tgt-occupancy-oct", "dimension": "occupancy" },
    "rationale": "Load factor and rate of sale trail the selected target band for days-to-sail."
  },
  "evidence": {
    "load_factor": 0.41,
    "rate_of_sale": 12.5,
    "target_load_factor": 0.55,
    "gap_signed": -0.14,
    "days_to_sail": 46
  },
  "confidence": 0.7,
  "status": "open"
}
```

---

## 6. Initial RM Agents (plugins)

All emit the same Finding contract.

### 6.1 Regulator — performance vs target

- **Purpose:** Compare current performance to configured targets (many targets).
- **Inputs:** targets, rate of sale, load factor / occupancy, booking build where available.
- **Output:** urgency score + actions such as `REVIEW_TARGET`, `REVIEW_PRICING`, `REVIEW_INVENTORY`, `ESCALATE_SAILING`.
- **Simplicity rule:** one clear gap metric per target dimension; thresholds in config.

### 6.2 Probability — group expectations / materialisation

- **Purpose:** From historic behaviour and external inputs, review group probabilities and materialisation rates; recommend revised expectations.
- **Inputs:** reservation probabilities, historic group materialisation, current group book.
- **Output:** `UPDATE_GROUP_EXPECTATION`, `FLAG_OVERBOOK_RISK`.
- **Simplicity rule:** transparent rate-based update before any heavy ML.

### 6.3 Competitor — competitive pressure

- **Purpose:** Review available competitor sources; recommend attention to competitive pressure.
- **Inputs:** competitor pricing / position vs own published rates.
- **Output:** `PRICE_REVIEW`, `MONITOR_COMPETITOR`.
- **Simplicity rule:** pressure score from relative position bands, not a full pricing optimiser.

---

## 7. Action Bus and reservation integration

```
Finding (Recommended Action)
        │
        ▼
Checklist (user) ──acknowledge / dismiss──┐
        │                                 │
        │ approve apply (Phase C)         │
        ▼                                 ▼
talia-server Action Executor          status update
        │
        ├── talia GQL mutation (preferred integration surface)
        └── Seaware adapter (firewall-aware; may queue)
```

**Phase A:** Findings + Checklist only.  
**Phase B:** `params` shaped like future mutation inputs; still no execute.  
**Phase C:** execute only through talia-server; audit log; idempotent action ids.

RM Agents **never** call Seaware or B2B GraphQL directly.

---

## 8. Talia Assistant (plugin)

### Role

Help the user **work with** Findings and World State: explain, prioritise, summarise, draft notes. Optional; near-future.

### AssistantProvider interface (conceptual)

```text
AssistantProvider
  id: string
  complete(request: AssistantRequest) -> AssistantResponse

AssistantRequest
  messages: { role, content }[]
  focus_subject?: Subject
  findings: Finding[]              # retrieved by server/runtime, not invented here
  context_snippets?: object[]      # bounded World State excerpts

AssistantResponse
  messages: { role, content }[]
  citations?: { finding_id }[]     # encourage grounding
```

### Hard rules

1. Provider output is **not** a Finding.
2. Provider **must not** set `score` or `recommended_action`.
3. Prefer **small local / private** models for commercial RM data.
4. If ungrounded, the Assistant must say it lacks Findings/context.

### UI

Separate surface from the Checklist (e.g. “Ask Talia Assistant” beside recommendations). Do not label it as an RM Agent.

---

## 9. World State dependencies (readiness lens)

| Concept | Framework need | Notes from current platform |
|---------|----------------|-----------------------------|
| Targets | Required for Regulator | `target_profiles` exist |
| Load factor / occupancy | Required for Regulator | Real occupancy paths exist; some MVP metrics still mock |
| Rate of sale | Required for Regulator | Partially scaffolded; may need hardening |
| Group probability / history | Required for Probability | `res_probability`, historic reservation data; models thin |
| Competitor data | Required for Competitor | Sync + GraphQL + UI already present |
| Reservation write APIs | Phase C only | Not engine-owned; server adapters TBD |

Data gaps block **agent quality**, not the **framework**. Framework can land with stubs/fixtures for one vertical slice.

---

## 10. Suggested implementation order

1. **Accept ADR-001 terminology** (force names in review).
2. Add `talia-engine` skeleton + Finding JSON schema + registry.
3. Persist Findings (Supabase via talia-server GraphQL).
4. Checklist focus panel (open Findings, filter by sailing).
5. **Regulator v0** on one subject × one target dimension.
6. Probability and Competitor as next RM Agents.
7. AssistantProvider stub (echo/citations) then local LLM.
8. Action payload alignment with talia GQL; queued executor behind firewall.

---

## 11. Open decisions (do not block terminology)

| Topic | Options | Notes |
|-------|---------|--------|
| Engine language | TypeScript beside server vs Python service | Contract-first; either can host RM Agents |
| Job scheduling | Cron + DB, pg-boss, BullMQ, etc. | Need something beyond on-demand sync |
| Severity thresholds | Global vs per-agent | Config, not hard-coded forever |
| Multi-customer | Tenant on Finding now vs later | Prefer `tenant_id` early if multi-customer is real |

---

## 12. Documentation map

| Doc | Role |
|-----|------|
| [ADR-001](../adr/ADR-001-rm-agent-framework-terminology.md) | Normative terminology + Finding contract + phases |
| This file | Framework sketch for discussion and onboarding |
| [FUTURE-ARCHITECTURE.md](../FUTURE-ARCHITECTURE.md) | Three-tier vision (ui / server / engine) |
