# What Is on Main / Staging vs What May Be Missing

## Current state (main @ 7b54f13, pushed to staging)

**On main right now:**

- **Hide Sidebar button** – Present in [talia-ui/src/Dashboard.jsx](talia-ui/src/Dashboard.jsx) (toolbar: "◀ Hide Sidebar" / "☰ Show Sidebar"), same as pre-merge.
- **Unified styling** – theme.css, components.css, dashboard.css, tabulator-theme.css, Chart.js config, single theme.
- **Local Tabulator** – tabulator-tables@6.3.1, midnight theme from npm, no CDN.
- **VoyageReport** – Component and presenter under focus-panels.
- **Data types lib** – lib/dataTypes (formatters, types, column builders).
- **Dashboard sidebar** – CSS classes (dashboard-sidebar, dashboard-section, dashboard-btn, etc.), no inline style objects.
- **DataManagementPage** – Import fixed to `admin/data-management/index.js`.

So the "Hide Sidebar" button and the merged feature work are in the **source** on main. If staging does not show them, the cause is likely **staging build/deploy**, not missing code on main.

---

## What was lost in the merge (4d822bf → feature/unified-styling-tabulator-npm)

When we merged `feature/unified-styling-tabulator-npm` into main we resolved conflicts with **theirs** (feature branch). That dropped some things that existed on main at 4d822bf:

| Item | Pre-merge main (4d822bf) | Current main |
|------|--------------------------|--------------|
| **BtopTerminal** | Direct import at top of Dashboard | Only via `require()` inside components map (still works) |
| **DirectSourceRequest** | Direct import at top of Dashboard | Not in components map at all – **missing** |
| **DevRoleSelector** | Comment: "Dev Role Selector is now integrated into ModeSelector dropdown" (handled in main.jsx) | Imported in Dashboard and rendered there |
| **Sidebar section behaviour** | Accordion: opening one section closed the others | Simple toggle: each section opens/closes independently |
| **Focus section layout** | `flex: '1'` / `'0 0 auto'`, `overflow: 'hidden'`, `dashboard-section--focus` | Simpler flex, no overflow, class `dashboard-section--expanded` |
| **TablePanel / ChartPanel / InfoPanel** | Inline styles + theme/font from useTheme | CSS classes (talia-report, talia-chart, dashboard-panel) |

So the only **real functional regressions** from the merge are:

1. **DirectSourceRequest** – No longer imported or in the Dockview components map; that panel type is missing.
2. **Sidebar accordion** – Old “open one, close others” behaviour was replaced by “toggle each section independently”.

“Hide panels” (if you mean something other than “Hide Sidebar”) and “date improvements” do not appear in the diff between 4d822bf and main; they may never have been on main and might live on another branch (e.g. ui-development, 2025-11-10-ejy7-j0gBI) or in another worktree.

---

## Why staging might not show recent developments

1. **Staging not rebuilt/redeployed** – Staging may still be serving an old UI build (e.g. previous Docker image or dist). Redeploy staging from current main and ensure the UI build runs (e.g. `npm run build` in talia-ui) and the resulting assets are what gets served.
2. **Caching** – Browser or CDN cache for the staging URL can show an old bundle. Hard refresh or incognito.
3. **Wrong branch deployed** – Confirm the deployment pipeline is building from `main` at 7b54f13 (or later), not an older branch/tag.

---

## What has been done (concise)

1. **Worktree smb** – All UI work (unified CSS, local Tabulator, VoyageReport, data types, Dashboard CSS refactor) was committed to `feature/unified-styling-tabulator-npm` and pushed.
2. **Merge to main** – That branch was merged into main (conflicts resolved with “theirs”). Main gained the unified styling and refactor but lost DirectSourceRequest and the old sidebar accordion behaviour as above.
3. **DataManagementPage** – Import path fixed on main and committed (7b54f13); build succeeds.
4. **Staging** – Same commits as main are “pushed to staging” in the sense that main is the source; if the staging **site** doesn’t show the new UI, the fix is to **rebuild and redeploy** staging from current main and clear caches as needed.

---

## If “hide panels” and “date improvements” are still missing

- **Hide Sidebar** – Already on main (toolbar button). If you mean a different “hide panels” (e.g. Dockview panel/tab visibility), that may be on another branch; we can search that branch and plan a small merge or cherry-pick.
- **Date improvements** – Not identified in the 4d822bf↔main diff. Need a hint (e.g. “date filter in sidebar”, “date column formatting”, “date picker in X screen”) or the branch/PR where they were added so we can bring them onto main and into the next staging deploy.

Once staging is redeployed from current main, you should see Hide Sidebar, unified theme, VoyageReport, and the new sidebar styling. Restoring DirectSourceRequest and the accordion behaviour (and any “hide panels” / date work from other branches) can be done as follow-up changes on main and then redeployed to staging.
