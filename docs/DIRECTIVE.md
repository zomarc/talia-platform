# Talia Development Directive

This is the canonical directive for development standards in `talia`.

## Non-Negotiable Rules

1. Use supported libraries first; do not reimplement library behavior in custom code.
2. Keep code minimal and explicit; avoid unnecessary abstractions.
3. Keep presentation in CSS files; avoid inline style objects and embedded style blocks.
4. Keep behavior in JavaScript/TypeScript and styling in CSS.
5. Prefer one active implementation path; remove or archive legacy duplicates.
6. Do not dispatch manual `window.resize` events to force component redraws.
7. Do not call component-specific resize APIs (for example `chart.resize()` or Tabulator redraw calls) from Dockview layout events.
8. Dockview owns layout/resize; Chart.js and Tabulator own their own responsive behavior.

## UI and Styling Rules

- Use existing UI/report libraries already in the project (Dockview, Tabulator, Chart.js).
- Do not bypass core libraries with ad hoc HTML fallbacks in active paths.
- Use CSS classes and variables from `talia-ui/src/styles/`.
- Do not add new inline styles (`style={...}`) unless there is a hard technical blocker.
- If a temporary inline style is required, document it and create follow-up cleanup work.

## Documentation Rules

- Canonical docs are listed in `docs/DOCS-CANONICAL.md`.
- Files under `docs/archive/` are historical reference only.
- New feature docs should update canonical docs first; archive docs are optional.

## Branch and Delivery Rules

- Development happens on `main` by current team decision.
- Keep commits focused and small.
- Validate local state before development:
  - `./scripts/validate-staging.sh local --quick`
  - or interactive `./scripts/validate`

## Definition of Done (for local dev work)

- One local UI instance on port `5173`.
- One local API instance on port `4000`.
- Running processes originate from `~/Dev/talia`.
- No new inline styling in changed files.
- Canonical docs updated when behavior or standards change.
