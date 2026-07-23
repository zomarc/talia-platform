# Talia user, role, focus, style, and global criteria

Authoritative product model — keep these boundaries in code and in naming.

---

## 1. User and role

- A **`talia_user`** has a **role** (Talia role), e.g. `USER`, `MANAGER`, `ADMIN`, … — see `src/utils/roleUtils.js` (`normalizeRole`, `isAdmin`, …) and auth / `GraphQLUtils.getUserRole`.

- The **ADMIN** role is intended to have access to **all functions** (privileged panels, advanced header, admin surfaces) — enforced via the same role checks (`isAdmin`, `canAccessPrivilegedPanels`, registry access, etc.).

---

## 2. Focus (work surface — layout only)

- A **focus** is **only a layout of panels/components** — which reports are open, Dockview geometry, saved presets. It is the **basis for actual work** for each user: the shell they operate in.

- A **role** has access to **various reports / focuses**; which focuses exist for whom is **already configurable** with existing functionality (`focusesByRole`, `GraphQLFocusService.getFocusesForRole`, `useTaliaFocusManagement`, focus admin UI where applicable).

- **Not** theme/style. **Not** global criteria.

Legacy code name **`focus-panels/`** = **registry report components** (implementations of those panels). **`focus-panels.css`** styles those UIs — not the product term “focus” for a saved layout.

---

## 3. Theme / style (presentation — appearance only)

- **Theme / style** is **only a presentation layer**: **appearance** — how the app looks and reads (palette, typography, spacing, chrome visibility, formatting prefs such as default display currency, …).

- It should stay **self-contained and clear**: configure and persist **appearance** through **`ThemeContext.jsx`**, **`DashboardSidebar`** (primary), GraphQL **`appearanceSettings`**, plus baseline **`theme.css`** / `applyTheme()` in `main.jsx`. It does **not** define which panels are in a focus, and it is **not** the channel for **data filters** (that is global criteria + bus).

---

## 4. Global criteria and dashboard globalConfig (per user → all reports via bus)

- **Global criteria** are **set per user** (saved with user profile / dashboard state, e.g. `StatusBar` + `saveUserProfileState` patch `globalCriteria`, and `window.__taliaGlobalCriteria`).

- They **must propagate to all reports** (and any subscriber) via the **message bus**.

- **Unified UI + criteria channel:** `talia:dashboard.globalConfig` (`publishDashboardGlobalConfig` / `window.__taliaDashboardGlobalConfig` in `services/dashboardUiState.js`). Payload includes:

  - `tableLayoutMode` (`best` | `width` | `data`)
  - chrome toggles: `filtersVisible`, `tabulatorFiltersVisible`, `detailsVisible`, `titlesVisible`, `calloutsVisible`, `actionsVisible`, `controlsVisible`
  - `viewScope`, `criteria`, `activePanelId`

- Components and framework listeners (**especially Tabulator fit** in `tabulatorConfig.js`) **ALWAYS conform** to the latest `globalConfig`. Fit is re-applied when a Dockview tab becomes active (`talia:report.activePanelChanged`) so hidden-panel refreshes cannot poison column widths.

- Legacy aliases still fire from the same publish for compatibility: `talia:dashboard.globalCriteria`, `talia:dashboard.tableLayout`, filter/details/viewScope visibility events.

- **Separation:** appearance tokens (ThemeContext CSS variables) stay presentation-only. **Which filters / fit / chrome toggles apply right now** is the **bus payload**, not Theme by itself.

---

## Summary table

| Concept | Definition | Main implementation |
|--------|------------|----------------------|
| **`talia_user` + role** | User carries a role; ADMIN → all functions | Auth, `roleUtils`, registry / header gates |
| **Focus** | Layout of panels/components = work surface | `focusesByRole`, `GraphQLFocusService`, Dockview, `__taliaFocusState` |
| **Theme / style** | Presentation / appearance only | `theme.css`, `ThemeContext`, sidebar, `appearanceSettings` |
| **Role → reports/focuses** | Configurable access list | Existing focus / registry / role configuration |
| **Global criteria / UI config** | Per-user filters + chrome + fit → **all** reports via bus | `talia:dashboard.globalConfig`, `__taliaDashboardGlobalConfig`, aliases for criteria/layout |

Optional refactors later: rename `ThemeContext` → `AppearanceContext`, rename `focus-panels/*` → `report-panels/*`. This document is the behavioral contract regardless of filenames.

---

## Why saved styles / appearances can *look* “gone” (nothing deleted from the repo)

**The CSS files are still there.** `main.jsx` still imports `theme.css`, `components.css`, `dashboard.css`, `focus-panels.css`, etc. Those define **defaults** and component layout classes.

What you experience as “appearance” in the running app is mostly **runtime**: `ThemeContext.jsx` writes **`--theme-*` (and related) on `document.documentElement`**, using values from **GraphQL `appearanceSettings`** for the logged-in **Talia user**, plus the large `useEffect` that recomputes tokens from sliders (font size, palette, row colors, …).

**Important behavior in `ThemeContext.jsx`:**

1. **Hard reset on auth / user key** — When `authLoading` finishes or `appearanceUserId` changes, an effect **resets many appearance fields to built-in defaults** (font, intensities, hex colors, profiles cleared, `appearanceDbLoaded` set false, …).

2. **Then** settings are **loaded asynchronously** from the server. **`applyAppearanceSettings` runs only if the DB returns a non-empty `settings` object.** If the payload is empty, missing, or the request fails, the UI **stays on those defaults** — so anything you *remember* from older custom saves is not shown until the server returns them.

3. **Legacy localStorage** — Old **`taliaLayout.fontSettings`** were intended to be **one-time migrated** into the DB, then removed from local storage. If migration never ran or the DB row stayed empty, that old local-only appearance will not come back.

4. **Save debounce** — After `appearanceDbLoaded` is true and a Talia user id exists, changes are **saved back** to `appearanceSettings`. If the load path never applied your stored settings (error / empty object), the in-memory state can still be defaults; a subsequent save can **persist that default snapshot** (risk if loads fail repeatedly).

So: **styles are not removed from the codebase**; “lost” usually means **the runtime layer never re-applied your saved `appearanceSettings`**, or only the **default** token layer is active. Check network/GraphQL for `appearanceSettings`, and that `settings` is a non-empty object for your user.

### Header “Style” vs staging vs local

The eye-menu **Style** control originally listed **only** saved **appearance profiles** (`appearanceSettings.profiles`). If the API returned **no profiles** (common on a fresh local DB), the **whole Style row was hidden** — it looked like “no styles,” while **staging** still had profiles (“Talia Standard”, “Retro 2020”, …).

**Extra palette names** (beyond built-ins like Midnight / Navy) come from **`taliaUiThemeRegistry`** in the database, merged in `ThemeContext` — staging DB has those rows; local may not until the same data exists or GraphQL points at the same backend.

**Change in the app:** when there are **no** profiles, the header **Style** menu now **falls back** to **`availableThemes`** (built-in themes plus any keys returned from `taliaUiThemeRegistry`), so local dev still gets a palette list without copying staging profile rows.

If you want a code hardening follow-up: gate `saveAppearanceSettings` until a successful first load (or never save after a failed load) so defaults cannot overwrite a previously good DB row.
