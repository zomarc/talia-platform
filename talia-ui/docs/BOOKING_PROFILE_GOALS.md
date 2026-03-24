# Booking profiles: three goals (REAL, TARGET, MODEL)

This doc maps **product intent** to **panels** in the Talia UI so charts are not confused with each other.

## System ownership (`talia`)

Canonical **REAL / TARGET / BUDGET / MODEL** profile data stored in Supabase is owned by the **Talia system**, not by an individual user account:

- **Scope:** `system` (GraphQL `ProfileSeriesScope.SYSTEM`)
- **Owner key:** `talia` (constant `TALIA_SYSTEM_OWNER_KEY`)
- **Humans:** default to **viewers**; **Manager+** or **Super User** roles may mutate curves and `target_profiles`. The API records **who last edited** (`last_edited_by`) for audit, while rows remain system-owned.

GraphQL context comes from request headers `x-user-id`, `x-user-role`, `x-user-email` (set by the UI Apollo link from `localStorage` / dev user switcher).

## ① REAL — actual booking behaviour

- **What:** Trends, KPIs, and (optionally) build curves from reservation/booking data.
- **Primary panel:** **Real booking profile (+ YoY)** (`booking-profile`).
- **Shortcuts:** Sidebar → Reports → **Profile Tools** → **① Real profile** or **① Real + YoY**.
- **Sail context:** The panel listens to `talia:sail.select` / clear and restores the last sail from persisted events when needed (same idea as other booking charts).
- **YoY:** Pass `includeComparison: true` in panel `params` (the **① Real + YoY** shortcut does this). Prior-year sail is auto-derived unless you pass `previousYearSailCode`.
- **Note:** If you enable **both** `includeBuildCurves` and `includeComparison`, the curves hook currently loads comparison data without full build-curve merge — prefer separate panels if you need both at once.

## ② TARGET — business / external targets

- **What:** Targets supplied outside Talia (e.g. planning spreadsheets) ingested for display.
- **How loaded:** **Data Management** import → `booking_targets_supplied`.
- **Primary panel:** **TARGET only (imported)** (`booking-target-data-simple`) for an isolated TARGET curve check.
- **Also shown on:** **Overlay: REAL + TARGET + MODEL** and **Target vs booking (configurable)**.

## ③ MODEL — Talia-defined curve, stored for reuse

- **What:** A profile you shape in the UI (when permitted), then **save** as consolidated **MODEL** data on the **inventory item** (`upsertInventoryProfileSeries`). Rows are stored as **system / talia**; your user id is only an audit stamp.
- **Permissions:** **Manager+** or **Super User** can save; others see a read-only banner and cannot drag or edit table cells in the MODEL editor panel.
- **Primary panel:** **MODEL profile editor (graph)** (`booking-target-profile-editor-simple`).
- **Shortcut:** Sidebar → **③ Model editor (graph)**.
- **Point grid:** Tabulator via shared `initTabulator` / `getTabulatorOptions`. **Header ≣** toggles this grid with other panels’ data details (`talia:dashboard.detailsVisibility`). **Tab ⓘ** is only for technical `ReportEventMeta` (dev/admin), not this table.
- **Database:** Saving requires table `inventory_item_profile_curve_point` and system-owner columns. Apply migrations in order, including `20260324100000_talia_system_intel_owner.sql` (e.g. `supabase db push`). If you see a Supabase “schema cache” error after migrating, retry after cache refresh.
- **Numbers:** Bookings/guests are stored and shown as **whole numbers** with sane caps so the chart axis stays readable (no float drift / scientific notation).

## Overlay / exploratory

- **Overlay: REAL + TARGET + MODEL** (`booking-combined-data-simple`): one chart comparing streams; respects Wide vs Local scope where applicable.
- **Target vs booking (configurable)** (`booking-target-chart`): flexible metrics and legacy target-profile workflows; banner on the panel points editors to the **MODEL profile editor** for inventory-backed graph editing.

## Legacy

- **Target Profile Editor** (`target-profile-editor`): table-oriented editor for legacy `target_profiles`; hidden from Reports list (`showInReports: false`, marked legacy). Prefer **MODEL profile editor (graph)** for the consolidated inventory MODEL workflow.
