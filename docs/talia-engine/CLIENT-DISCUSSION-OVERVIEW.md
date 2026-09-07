# Talia Engine — RM Agents
## Client Discussion Overview

**Document type:** High-level briefing (for discussion)  
**Date:** September 2026  
**Status:** Agreed internal direction — shared for client discussion  
**Audience:** Business and technical stakeholders

---

## 1. Why this initiative

Talia already brings together sailing performance, targets, reservations, and competitor information in one place. The next major step is a **server-side capability that works independently of the dashboard UI**: continuously (or on demand) evaluating the book, scoring situations that need attention, and presenting **clear recommended actions** for the revenue team.

That capability lives in **Talia Engine**.

It is designed so specialist modules can be added over time without rebuilding the platform — starting simple, staying inspectable, and only later connecting recommended actions into the reservation system.

---

## 2. What we are building (in plain terms)

| Concept | Meaning for the business |
|--------|---------------------------|
| **RM Agent** | A focused specialist that watches one kind of RM problem (e.g. performance vs target) and produces a scored recommendation |
| **Finding** | A normalised result: how urgent is this, what should we do, and why (with supporting evidence) |
| **Checklist** | The first user experience: a prioritised list of recommendations for the team to review |
| **Talia Assistant** *(later)* | An optional helper (small local language model) that can explain or summarise Findings — it does **not** replace RM judgement or invent scores |
| **Action** *(later)* | When approved, a Recommended Action can be applied through controlled integration with the reservation system |

**Important terminology:** an **RM Agent** here means a classical revenue-management specialist module — not a chatbot and not an unsupervised “AI that books.” Automation of reservation changes is a later, controlled step.

---

## 3. How it fits Talia

```
   Dashboard (talia-ui)
            │
            │  Checklist / sailing context
            ▼
   Data gateway (talia-server)
            │
            │  Shared data (“World State”)
            ▼
   Talia Engine
      • Agent Runtime
      • RM Agents → Findings
      • (later) Talia Assistant
      • (later) approved actions → reservation integration
```

- The **UI** remains the place people work.  
- The **server** remains the gateway to data and, later, to write-backs.  
- The **engine** evaluates and recommends without depending on someone having a screen open.

---

## 4. First family of RM Agents

All RM Agents are intentionally **simple**. Each produces the same kind of output: a **score** (urgency) and a **recommended action**.

### 4.1 Regulator — performance versus target

Compares current performance to agreed targets (there may be many targets).  
Takes **rate of sale** and **current load factor** into account.  
Typical outcomes: review pricing, inventory posture, or escalate a sailing for attention.

### 4.2 Probability — expectations and materialisation

Uses historic behaviour and available inputs to review **group probabilities** and **materialisation rates**.  
Produces recommended updates to expectations (for example where the group book looks optimistic or risky).

### 4.3 Competitor — competitive pressure

Reviews available competitor sources and flags where competitive pressure warrants a pricing or positioning review.

Further RM Agents can be added on the same framework without changing the Checklist model.

---

## 5. What the user sees first

**Phase A — Advise (recommended starting point)**

1. RM Agents evaluate sailings / subjects using Talia’s available data.  
2. Each issue becomes a **Finding** with:
   - urgency score  
   - severity band (info → critical)  
   - recommended action  
   - short rationale and evidence  
3. The team works a **Checklist**: acknowledge, dismiss, or take offline action.

No automatic changes are made to the reservation system in this phase.

**Later phases (for discussion)**

| Phase | Outcome |
|-------|---------|
| **B — Propose write** | Recommendations carry structured payloads ready for system actions — still human-approved |
| **C — Execute** | Approved actions applied via controlled reservation integration (e.g. through Talia GraphQL / reservation adapters) |
| **D — Assist** | Optional **Talia Assistant** helps explain and prioritise Findings (local/private model preferred for commercial data) |

---

## 6. Reservation systems and network constraints

A dedicated **Seaware** instance and database exist but sit **behind a firewall**. That is expected and planned for:

- **Reads** for RM Agents prefer Talia’s synchronised operational data (so evaluation does not depend on opening the firewall for every run).  
- **Writes** (when enabled) go through **talia-server**, with queuing if the reservation path is temporarily unavailable.  
- RM Agents themselves do **not** talk directly to Seaware.

This keeps security boundaries clear and avoids fragile “dashboard-only” integrations.

---

## 7. Design principles (for alignment)

1. **Many simple specialists** beat one opaque black box.  
2. **Recommend before execute** — human-in-the-loop Checklist first.  
3. **Same output shape for every RM Agent** — easier training, UI, and audit.  
4. **Extensible** — new RM Agents plug into the same runtime.  
5. **Assistant is optional and bounded** — explains Findings; does not invent RM scores or apply booking changes.  
6. **Integration is controlled** — reservation writes are explicit, approved, and auditable.

---

## 8. Suggested discussion points with the client

1. Does the **Checklist-first** approach match how the revenue team wants to work day-to-day?  
2. Which **targets** and dimensions matter most for the first Regulator use case?  
3. Priority order among Regulator / Probability / Competitor for the first live slice?  
4. Appetite and governance for **later direct actions** into the reservation system?  
5. Interest in a **local Talia Assistant** for explanation and meeting prep, once Findings exist?  
6. Any constraints on where evaluation jobs may run relative to VPN / Seaware access?

---

## 9. Proposed near-term next steps

1. Confirm terminology and scope (this briefing + detailed ADR under review).  
2. Agree the first vertical slice — typically **Regulator on a limited set of sailings/targets**.  
3. Deliver Findings + Checklist in Talia (advise only).  
4. Review with users; then sequence Probability, Competitor, Assistant, and write-back.

---

## 10. One-page summary

**Talia Engine** introduces **RM Agents**: small, specialist evaluators that run independently of the UI, score situations, and recommend actions. The first product surface is a **Checklist of Findings**. Direct reservation actions and an optional **Talia Assistant** come later, under clear controls. The approach is extensible, inspectable, and designed to respect existing data and firewall boundaries.

---

*Talia Platform — Client discussion overview*  
*Supporting detail (internal): ADR-001 RM Agent Framework Terminology; RM Agent Framework sketch*
