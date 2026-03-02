# Talia Documentation Hub

Use this page as the entry point for all active development documentation.

## Start Here

- `docs/DIRECTIVE.md` - mandatory development standards
- `docs/DOCS-CANONICAL.md` - canonical documentation map
- `README.md` - project-level quick start

## Active Development Docs

- `docs/DEVELOPMENT-WORKFLOW.md` - day-to-day workflow
- `docs/QUICK-START-GUIDE.md` - boot and verify quickly
- `docs/ARCHITECTURE.md` - system architecture and boundaries
- `docs/DEPLOYMENT.md` - deployment and environment operations
- `docs/CHANGELOG.md` - tracked changes and release notes

## Standards and Direction

- `docs/DIRECTIVE.md` is authoritative for:
  - library-first implementation
  - minimal code
  - CSS-only styling in active UI code

## Archive Policy

- `docs/archive/` contains historical notes and superseded plans.
- Archive files are not the source of truth for current implementation.
- See `docs/archive/README.md` for archive usage rules.

## Local Validation

Run before major changes:

```bash
./scripts/validate-staging.sh local --quick
```
