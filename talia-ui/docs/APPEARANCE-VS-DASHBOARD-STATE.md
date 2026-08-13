# Talia user, role, focus, style, and global criteria

Authoritative product model — keep these boundaries in code and in naming.

---

## 1. User and role

- A **`talia_user`** has a durable **`role`** column (`GUEST` | `USER` | `MANAGER` | `ADMIN` | `SUPER_USER`) — see migration `20260813180000_talia_users_role.sql`, GraphQL `TaliaUser.role` / `updateTaliaUserRole`, and auth (`SupabaseAuthContext` prefers DB role over email heuristics).
- Helpers: `src/utils/roleUtils.js` (`normalizeRole`, `isAdmin`, `canAccessPrivilegedPanels`, `canConfigureComponentOperations`, `hasRole`).
- **ADMIN / SUPER_USER** may configure Operations chrome and role baselines; end users do **not** see Operations toggles in the tab Options menu.

---

## 2. Focus (work surface — layout only)

- A **focus** is **only a layout of panels/components** — which reports are open, Dockview geometry, saved presets. It is the **basis for actual work** for each user: the shell they operate in.

- A **role** has access to **various reports / focuses**; which focuses exist for whom is **already configurable** with existing functionality (`focusesByRole`, `GraphQLFocusService.getFocusesForRole`, `useTaliaFocusManagement`, focus admin UI where applicable).

- **Not** theme/style. **Not** global criteria.

Legacy code name **`focus-panels/`** = **registry report components** (implementations of those panels). **`focus-panels.css`** styles those UIs — not the product term “focus” for a saved layout.

---

## 3. Theme / style (presentation — appearance only)

- **Theme / style** is **only a presentation layer**: **appearance** — how the app looks and reads (palette, typography, spacing, chrome visibility, formatting prefs such as default display currency, …).

- It should stay **self-contained and clear**: configure and persist **appearance** through **`ThemeContext.jsx`**, **`DashboardSidebar`** (primary), GraphQL **`appearanceSettings`**, plus baseline **`theme.css`** / `applyTheme()` in `main.jsx`. It does **not** define which panels are in a focus, and it is **not** the channel for **data filters** (that is global criteria + bus). **Do not** park Views/Operations or role criteria in ThemeContext.

---

## 4. Global criteria (role baseline → user deltas → bus)

- **Role** defines **baseline global criteria** (`config_setting` / `ui_profile` key `role_criteria:{ROLE}`), edited in Admin → **Role Criteria**.
- **User** inherits that baseline and may personalize **deltas** (`ui_profile` `state:{userId}.globalCriteria`).
- **Admin override** for a user: `adminCriteriaOverride` (+ optional `adminCriteriaLocked`) via `saveUserCriteriaOverride`.
- **Effective criteria** = `merge(roleCriteria, userDeltas)` or admin override when present — loaded by StatusBar via `effectiveGlobalCriteria` / `roleCriteriaService.js`, then published on the bus.
- They **must propagate to all reports** via `talia:dashboard.globalConfig` / `__taliaGlobalCriteria`.

**Unified UI + criteria channel:** `talia:dashboard.globalConfig` (`publishDashboardGlobalConfig` / `window.__taliaDashboardGlobalConfig` in `services/dashboardUiState.js`). Payload includes table layout, filter/details/titles/callouts chrome, `viewScope`, `criteria`, `activePanelId`.

Components and framework listeners (**especially Tabulator fit** in `tabulatorConfig.js`) **ALWAYS conform** to the latest `globalConfig`.

---

## 5. Per-component Views vs Operations

| Layer | Meaning | Who can change | Persistence |
|--------|---------|----------------|-------------|
| **Views** | Presentation (Nested/Flat, Details, Segments, …) | Any user who can open the component (non-restrictive) | `componentOptions.{panelId}.views` on user profile |
| **Operations** | Capabilities (show filters, column filters, allocate, …) | Capability allowed by role (+ optional role allow-list); **Options menu to enable/disable** is Admin+ only | Role allow-list `role_component_ops:{ROLE}`; optional admin ops prefs on user profile |

- Tab chrome: active dock tab **Options** (⚙) — Views for everyone; Operations section only when `canConfigureComponentOperations(role)`.
- Catalog: `lib/componentOptionsCatalog.js` + optional `registry.options`; hook `useComponentOptions`.
- Global StatusBar **Operations** visibility toggle is **retired** (replaced by per-component Options).

**Component access by role:** registry `allowedRoles` and/or `minRole` via `canRoleAccessComponent` (Dashboard add-panel / sidebar gates).

---

## Summary table

| Concept | Definition | Main implementation |
|--------|------------|----------------------|
| **`talia_user` + role** | Durable role on user; ADMIN/SUPER configure ops | DB column, GraphQL, auth, `roleUtils`, Admin Users table |
| **Focus** | Layout of panels/components = work surface | `focusesByRole`, Dockview |
| **Theme / style** | Presentation / appearance only | `ThemeContext`, `appearanceSettings` |
| **Role → criteria** | Baseline always applied; user deltas; admin override | `roleCriteria`, `effectiveGlobalCriteria`, StatusBar |
| **Views / Operations** | Per-component Options; Views free; Ops role-gated | Tab Options, `useComponentOptions`, Admin Role Criteria |
| **Component ACL** | `allowedRoles` / `minRole` on registry | `canRoleAccessComponent` |
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
