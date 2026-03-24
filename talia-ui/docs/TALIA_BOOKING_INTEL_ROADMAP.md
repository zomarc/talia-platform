# Booking intelligence — product direction (checkpoint)

## Target state (simple)

1. **REAL — booking history profile**  
   Visualise build / booking curves from **actual** reservation/booking data, scoped consistently (e.g. sail + global criteria).

2. **TARGET — defined in Talia, stored for real**  
   Business targets are **authored or imported inside Talia** and persisted in **Supabase** (not only ephemeral UI), with a clear source of truth.

3. **Inventory mapping**  
   All persisted profile series (REAL / TARGET / BUDGET / MODEL as applicable) are keyed by **`inventory_item`** (and related keys such as `sail_code` / `local_key`) so dashboards and editors resolve the same entity.

## System ownership (current)

- Canonical stored curves use **scope `system`**, **owner `talia`**, with **audit** (`last_edited_by`) for humans.  
- See server constants and migrations under `talia-server` for schema.

## Known rough edges to tighten next session

- **Data Management**: Sync UX (header strip, table actions, logs) must stay visible for admins; panel uses `usePanelDetailsVisibility` only for *secondary* strips — do not tie core sync entry points to “report details” toggles.
- **Charts vs storage**: Align GraphQL resolvers, UI hooks, and Supabase writes so **save** paths hit the same tables the **read** paths use for overlays.
- **Profile editors**: One clear path: **view REAL**, **edit/save TARGET & MODEL** (per permissions) on the mapped **inventory item**.

## Reference UI patterns

- **Data details (≣)**: `ReportDataDetails` + `usePanelDetailsVisibility` for optional tables/grids.  
- **Technical meta (ⓘ)**: `usePanelTechnicalMetaVisibility` + `ReportShell` only.
