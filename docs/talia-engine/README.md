# talia-engine (planning)

This folder holds planning docs for the future **talia-engine** tier.

| Doc | Purpose |
|-----|---------|
| [RM-AGENT-FRAMEWORK.md](./RM-AGENT-FRAMEWORK.md) | Framework sketch: Agent Runtime, RM Agents, Findings, Checklist, Talia Assistant |
| [contracts/finding.schema.json](./contracts/finding.schema.json) | Frozen Finding JSON Schema (v0) |

**Terminology is normative in** [ADR-001](../adr/ADR-001-rm-agent-framework-terminology.md).

## Forced terms (do not dilute)

- **RM Agent** — specialist RM evaluator (not an LLM)
- **Finding** — normalised score + recommended action + evidence
- **Checklist** — user-facing list of Findings / Recommended Actions
- **Talia Assistant** — optional LLM helper over Findings (not an RM Agent)
- **World State** — read model agents observe
- **Action Bus** — pathway for Findings and later approved execution via talia-server
