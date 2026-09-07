# ADR-001: RM Agent Framework Terminology and Boundaries

**Status:** Proposed  
**Date:** 2026-09-07  
**Deciders:** Product / architecture (Talia Engine)  
**Related:** [FUTURE-ARCHITECTURE.md](../FUTURE-ARCHITECTURE.md), [Framework sketch](../talia-engine/RM-AGENT-FRAMEWORK.md)

---

## Context

Talia needs a server-side, UI-independent component inside **talia-engine** that can evaluate revenue-management (RM) situations and produce recommended actions. This continues a classical multi-agent RM approach (specialist evaluators observing shared state and emitting local decisions), not the recent “LLM agent” product pattern.

Separately, a small **local** language model will be useful soon as a user aid. That capability must not redefine or replace the RM Agent model.

Ambiguous use of the word **agent** would create lasting confusion in code, UI copy, and hiring/onboarding. Terminology must be forced early.

---

## Decision

### 1. Forced terminology (normative)

| Term | Meaning | Must not mean |
|------|---------|----------------|
| **RM Agent** | A specialist evaluator module in talia-engine that observes shared RM world state and emits zero or more **Findings** | Chatbot, LLM tool-caller, autonomous writer to the reservation system |
| **Agent Runtime** | The engine subsystem that registers, schedules, and runs RM Agents, and persists their outputs | The LLM, the UI, talia-server |
| **World State** | The read model RM Agents observe (sailings, targets, ROS, load factor, reservations, competitor data, etc.), typically via talia-server / synced stores | Live Seaware session state unless explicitly connected later |
| **Finding** | The normalised output of an RM Agent for one subject at one evaluation time: score + recommended action + evidence | Free-text chat, untyped “insight” |
| **Recommended Action** | A typed intent inside a Finding (`action_type` + structured `params`) | An executed change in the reservation system |
| **Action Bus** | The pathway that stores Findings and, in later phases, routes **approved** Recommended Actions to executors | Direct agent→Seaware calls |
| **Checklist** | The primary user-facing presentation of open Findings / Recommended Actions | Automatic application of changes |
| **Talia Assistant** | An optional, pluggable **language-model helper** that explains, prioritises, or drafts language **over existing Findings and context** | An RM Agent; a source of scores; an executor of reservation writes |
| **Assistant Provider** | A swappable implementation behind the Assistant API (e.g. local small LLM, later remote) | Hard-wired OpenAI-style “agent framework” as the core of the engine |

**Banned in core engine docs and APIs (unless clearly scoped to Assistant):**

- “AI agent”, “autonomous agent”, “LLM agent”, “tool-calling agent” as synonyms for RM Agent  
- Using “agent” alone in UI without the **RM** or **Assistant** qualifier when both exist  

**Preferred short forms in code:**

- Packages / folders: `rm_agents/` (or `agents/` only inside `talia-engine` with README stating “RM Agents”)  
- Assistant: `assistant/` — never under `rm_agents/`  
- Types: `RmAgent`, `Finding`, `RecommendedAction`, `AssistantProvider`

### 2. Architectural boundaries

```
talia-ui
   │  Checklist / focus panels / (later) Assistant chat
   ▼
talia-server          ← sole data gateway & (later) write executor
   │
   ▼
talia-engine
   ├── Agent Runtime
   │     └── RM Agents (Regulator, Probability, Competitor, …)
   ├── Finding store interface
   └── Assistant (optional plugin; reads Findings + context only)
```

Rules:

1. **RM Agents produce Findings; they do not chat.**  
2. **Talia Assistant never invents scores or Recommended Actions.** It may only narrate, rank, filter, or draft text grounded on Findings and approved context.  
3. **talia-server owns external writes** (talia GQL / reservation / Seaware adapters). The engine emits intent; the server executes after policy/approval.  
4. **Firewall / offline Seaware:** reads prefer synced World State; writes are queued on the Action Bus until connectivity and approval allow flush.

### 3. Finding contract (frozen for v0)

Every RM Agent output MUST conform to this shape (field names may be snake_case or camelCase in transport, but semantics are fixed):

| Field | Type | Rules |
|-------|------|--------|
| `finding_id` | string (uuid) | Assigned by runtime |
| `agent_id` | string | Stable id, e.g. `rm.regulator.performance_vs_target` |
| `subject` | object | `{ type, id, … }` — e.g. sailing, ship, group reservation |
| `as_of` | datetime | Evaluation time (UTC) |
| `score` | number in **[0, 1]** | **Urgency / need-to-act.** `1` = strongest need to act. Signed over/under performance belongs in `evidence`, not in `score`. |
| `severity` | enum | `info` \| `watch` \| `action` \| `critical` — derived from score bands (configurable thresholds) |
| `recommended_action` | object | `{ action_type, params, rationale }` |
| `evidence` | object | Key inputs and intermediate metrics (ROS, LF, target, gap, comps, …) |
| `confidence` | number in [0, 1] \| null | Optional |
| `status` | enum | `open` \| `acknowledged` \| `dismissed` \| `applied` \| `expired` |

**Score scale is normative:** do not mix signed scores across agents. Ranking the Checklist uses `score` then `severity`.

**Initial `action_type` catalogue (extensible, not closed):**

- `REVIEW_TARGET`
- `REVIEW_PRICING`
- `REVIEW_INVENTORY`
- `UPDATE_GROUP_EXPECTATION`
- `FLAG_OVERBOOK_RISK`
- `PRICE_REVIEW`
- `MONITOR_COMPETITOR`
- `ESCALATE_SAILING`

New types may be added; removing or renaming requires an ADR amendment.

### 4. Assistant plugin boundary

The Assistant is registered as an `AssistantProvider`:

- **Inputs:** user prompt, optional subject focus, **retrieved Findings**, and bounded context snippets from World State  
- **Outputs:** assistant messages / summaries — **not** Findings  
- **Forbidden:** writing `score`, creating `recommended_action`, calling reservation mutations directly  

Grounding policy: if the provider cannot cite Findings or context, it must say so rather than fabricate RM conclusions.

### 5. Phased delivery (product, not calendar)

| Phase | Scope |
|-------|--------|
| **A – Advise** | Agent Runtime + Finding persistence + Checklist UI; RM Agents read synced World State only |
| **B – Propose write** | Recommended Actions carry payloads shaped for future talia GQL mutations; still no auto-apply |
| **C – Execute** | Approved actions executed via talia-server adapters; queue when Seaware/firewall unavailable |
| **D – Assist** | Talia Assistant provider (prefer small local / private model) over Findings |

Phases may overlap in implementation work, but **D must not precede a working Finding store**, and **C must not bypass approval**.

---

## Consequences

### Positive

- Terminology survives the industry’s LLM overload and matches classical RM multi-agent design.  
- New RM Agents stay cheap to add: implement evaluate → emit Findings.  
- Assistant can be added later without rewriting agents or the Checklist.  
- Write-back and firewall concerns stay at the server/Action Bus edge.

### Negative / trade-offs

- “Agent” alone is insufficient in UI and docs; always qualify.  
- Score-as-urgency requires discipline (signed gaps live in evidence).  
- Python vs TypeScript runtime placement remains an open implementation choice; **this ADR does not pick a language**, only the contract and names.

### Follow-ups

- Accept or amend this ADR after terminology review.  
- Implement package skeleton and Finding schema per [RM-AGENT-FRAMEWORK.md](../talia-engine/RM-AGENT-FRAMEWORK.md).  
- First vertical slice: one Regulator RM Agent → Findings → Checklist panel.

---

## Notes on lineage (non-normative)

The RM Agent model is intentionally continuous with classical multi-agent RM systems (specialist agents, shared environment, local recommendations), including Swarm-era simulation platforms. That history informs extensibility and simplicity; it does not require reimplementing Swarm.
