# Canonical Documentation Map

This file defines the authoritative documentation set for active development.

## Canonical Files (Authoritative)

- `README.md` - project entry point and local run basics
- `docs/README.md` - docs hub and navigation
- `docs/DIRECTIVE.md` - mandatory coding and styling standards
- `docs/ARCHITECTURE.md` - system architecture and boundaries
- `docs/DEVELOPMENT-WORKFLOW.md` - development workflow and daily usage
- `docs/DEPLOYMENT.md` - deployment and environment operations
- `docs/ENVIRONMENTS-AND-DEPLOY.md` - local vs staging vs MVP, local deploys, backups, version pitfalls
- `docs/AZURE-STAGING.md` - Azure VM + Docker staging (Bicep, Caddy, env files)
- `docs/QUICK-START-GUIDE.md` - quick startup and verification

## Canonical UI Standards (Authoritative for `talia-ui`)

- `talia-ui/src/components/COMPONENT-STANDARDS.md` - component architecture and framework usage standards
- `talia-ui/src/components/focus-panels/COMPONENT-CREATION-GUIDE.md` - focus-panel build pattern and registration flow
- `talia-ui/STYLING-GUIDE.md` - CSS/theming rules and no-inline-style policy
- `talia-ui/CODING-STANDARDS.md` - library-first and implementation guardrails

## Reference-Only (Non-Canonical)

- `talia-ui/IMPLEMENTATION-GUIDE.md` - migration/reference context
- `talia-ui/archive/docs/old-implementation/*` - historical implementations

## Policy

- If a topic exists in both canonical and archive docs, canonical docs win.
- Archive docs are historical context, not execution guidance.
- New docs should be added to canonical files first; archive only when superseded.

## Consolidation Notes

- Duplicate ngrok docs exist under:
  - `docs/archive/ngrok-setup/`
  - `docs/archive/development-docs/ngrok/`
- Use canonical docs for active work; keep duplicate archive docs as historical snapshots.
