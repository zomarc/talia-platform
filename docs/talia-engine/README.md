# talia-engine

Planning docs plus the **v0 Agent Runtime** in `/talia-engine` (TypeScript, port 4100).

| Doc | Purpose |
|-----|---------|
| [CLIENT-DISCUSSION-OVERVIEW.md](./CLIENT-DISCUSSION-OVERVIEW.md) / [.pdf](./CLIENT-DISCUSSION-OVERVIEW.pdf) | Client briefing |
| [RM-AGENT-FRAMEWORK.md](./RM-AGENT-FRAMEWORK.md) | Framework sketch |
| [contracts/finding.schema.json](./contracts/finding.schema.json) | Frozen Finding JSON Schema (v0) |
| [../../talia-engine/README.md](../../talia-engine/README.md) | How to run the runtime |
| [DRIVER-ANALYSIS.md](./DRIVER-ANALYSIS.md) | Prior / peerset / value science element (advisory Evidence) |

**Terminology is normative in** [ADR-001](../adr/ADR-001-rm-agent-framework-terminology.md).

## Forced terms (do not dilute)

- **RM Agent** — specialist RM evaluator (not an LLM)
- **Finding** — normalised score + recommended action + evidence
- **Checklist** — user-facing list of Findings / Recommended Actions
- **Talia Assistant** — optional LLM helper over Findings (not an RM Agent)
- **World State** — read model agents observe
- **Action Bus** — pathway for Findings and later approved execution via talia-server
