# Talia UI glossary (appearance, focus, identity)

Short names for product surfaces. GraphQL and database field names may differ; this doc is for **people and UI copy**.

## Appearance

- **Named appearance profile** — A saved bundle of UI appearance settings (fonts, spacing, colours where stored in profile settings). Shown in the Style menu as a named row users can pick or duplicate.
- **Palette / UI theme** — A colour (and optional asset) definition in the Talia UI **theme registry** (built-in keys plus DB overrides). Often edited from Admin → Themes.
- **Style menu** — The in-app control that lists **profiles** first, then **palette** themes. User-facing label “Style” refers to this combined picker, not a fourth separate object type.

Prefer **profile** vs **palette** in new copy instead of mixing “theme”, “style”, and “palette” interchangeably.

## Focus

- **Focus** — A named **workspace**: a **collection of panels** (Dockview layout + component metadata) plus **assignment** (who may open it): `type` (e.g. standard / role-scoped / user-scoped), `assignedRoles`, and optional `assignedUserId` (Talia user id). Persisted as one `focuses` row; Dockview JSON lives under `layout_data`.
- **Component** — A panel definition (type, position, settings, data source) on the common framework. Many components can belong to one focus layout.
- **Canonical focus list** — The app loads focus rows once via `FocusManagementProvider` + `useFocusManagement` / `useTaliaFocusManagement` so the **header**, **sidebar**, and **admin** UIs read the same in-memory catalogue (create/delete/update refresh everyone).

## Identity (per deployed instance)

- **Talia user id** — The primary identifier for a person **after auth** within this Talia deployment (`talia_users` / app `taliaUserId`). **Role checks, admin tools, focus assignment (`assignedUserId`), and export/import** should use this id for instance-local semantics.
- **Focus export packs** (`FocusExport` JSON) may include `assignedUserId` from the source instance. On import, treat it as **opaque** unless you explicitly remap to a user that exists on the **target** instance; the default import path clears it for USER-type focuses when the checkbox is enabled.

Do not rely on a second long-lived identity layer for Talia features after the user is mapped to a Talia user for that instance.
