# Project Cleanup Baseline

Baseline commit: `70e0b2d`

This baseline captures the current consolidation opportunities before phased cleanup work begins.

## Priority 0 (high impact)

- **Duplicate sync/table mapping sources**
  - Mapping logic is duplicated across:
    - `talia-server/src/api/resolvers.ts`
    - `talia-server/src/services/synapse-sync.js`
    - `talia-server/sync.config.json`
    - `talia-ui/src/config/tableSources.js`
  - Risk: drift between sync operation names, UI source metadata, and API metadata lookups.

- **Component standards and styling guidance drift**
  - Conflicting guidance exists between:
    - `talia-ui/src/components/COMPONENT-STANDARDS.md`
    - `talia-ui/STYLING-GUIDE.md`
    - `docs/DIRECTIVE.md`
  - Risk: inconsistent implementation patterns (inline styles vs class/variable-driven styling).

- **Focus panel container/presenter pattern duplication**
  - Mixed loading/error/empty handling styles across focus panels (`PanelDataState` vs manual patterns).
  - Repeated context extraction and grouped action logic appears in multiple presenters.

## Priority 1 (medium impact)

- **Script overlap and partial duplication**
  - Validate and restart flows are split across overlapping scripts with repeated helper/config logic.
  - Candidate scripts:
    - `scripts/validate`
    - `scripts/validate-staging.sh`
    - `scripts/validate-staging-local.sh`
    - `talia-server/restart.sh`
    - `talia-server/restart-server.sh`

- **Registry metadata inconsistencies**
  - `talia-ui/src/components/focus-panels/registry.js` has non-uniform metadata keys and optional fields with no defaults.
  - Risk: inconsistent runtime capabilities and panel behavior assumptions.

- **Supabase config duplication**
  - Multiple config paths and defaults are used across server and scripts.
  - Risk: environment drift and inconsistent local/staging behavior.

## Priority 2 (lower impact, cleanup/debt)

- **Legacy or stale docs overlap**
  - Component creation/standards docs are spread across several files with overlaps and stale references.
  - `docs/DOCS-CANONICAL.md` does not currently map all active UI standards docs as canonical.

- **Legacy utility scripts**
  - Some table/setup scripts reference old import paths or outdated assumptions.
  - Candidate for archive/removal after verification.

## Initial consolidation targets

1. **Unify sync/table mapping source of truth** in server + UI.
2. **Canonicalize standards docs** and remove contradictory guidance.
3. **Standardize focus-panel shell patterns** (container/presenter state and grouped table actions).
4. **Consolidate validate/restart helpers** with shared shell utilities and config loading.

## Acceptance criteria for baseline phase

- Baseline commit hash captured and verified.
- Ranked findings documented with concrete file targets.
- Cleanup phases can now proceed with measurable before/after checks.

