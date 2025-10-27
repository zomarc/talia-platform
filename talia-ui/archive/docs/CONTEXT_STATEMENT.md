# Dockview Enhanced Docking System - Context Statement

## ⚠️ MANDATORY READING BEFORE ANY CHANGES

**CRITICAL: Read the REFERENCE DOCUMENTATION section (lines 139-153) before making any code changes, especially:**
- **InstantDB 0.21.26**: Always use React client API, NOT server API
- **NEVER use `db.query()`** - this causes "function not found" errors
- Use `db.useQuery()` hooks for data fetching in React components (NOT `useQuery` imported separately)
- Use `db.transact()` for create/update/delete operations

## 📁 APPLICATION ENTRY POINT & STRUCTURE

### **CRITICAL: Correct File Structure**

**Main Entry Point Chain:**
```
main.jsx → AppWithAuth.jsx → Dashboard.jsx
```

**DO NOT CONFUSE THESE FILES:**

1. **`main.jsx`** - Application bootstrap
   - Imports: `AppWithAuth.jsx`
   - Creates React root and renders app

2. **`AppWithAuth.jsx`** - Authentication wrapper
   - Wraps app with `<AuthProvider>` and `<ThemeProvider>`
   - Imports: `Dashboard.jsx` (NOT `App.jsx`)
   - Conditionally shows `<LandingPage>` or `<Dashboard>`

3. **`Dashboard.jsx`** ✅ **PRIMARY WORKING FILE**
   - Uses `useTaliaFocusManagement` hook (Talia focus system)
   - Contains all Dockview configuration
   - Includes Sidebar with admin integration
   - **THIS IS THE ACTIVE DASHBOARD COMPONENT**

4. **`App.jsx`** ⚠️ **LEGACY FILE - NOT CURRENTLY USED**
   - Uses `useFocusManagement` hook (different system)
   - Uses Apollo Client for GraphQL
   - **DO NOT MODIFY THIS FILE**
   - Kept for reference only

**IMPORTANT:** When making changes to the dashboard, ALWAYS edit `Dashboard.jsx`, NOT `App.jsx`.

## 🏛️ DATA ARCHITECTURE & BACKEND SYSTEMS

### **CRITICAL: Understanding the Backend Architecture**

**Two Separate Backend Systems:**

1. **`talia-graphql-server`** ✅ **PRIMARY DATA SOURCE (FUTURE)**
   - **Location:** `/Users/russell/Work/AA-Celestyal/Dev/talia-graphql-server`
   - **Purpose:** Primary business data source for ALL dashboard data
   - **Port:** `http://localhost:4000/graphql` (local development)
   - **Status:** Separate Node.js/TypeScript project, linked for deployment
   - **Deployment:** Deploys to Netlify alongside talia-ui
   - **Data Provided:**
     - Ships, Sailings, Cabin Availability
     - KPIs, Revenue, Occupancy metrics
     - Exceptions, Itineraries, Groups
     - All business intelligence data
   - **Start Command:** `cd talia-graphql-server && npm start`
   - **Future:** This will be the ONLY data source for business data

2. **InstantDB** ⚠️ **TEMPORARY AUTH & FOCUS STORAGE**
   - **Purpose:** TEMPORARY solution for authentication and focus/user management ONLY
   - **App ID:** `1c2b040a-7bb2-4eb5-8490-ce5832e19dd0`
   - **Data Stored (Temporary):**
     - User authentication (magic code sign-in)
     - User mappings (InstantDB auth ID → Talia user ID)
     - Focus definitions and user preferences
     - User management data
   - **Usage:** `db.useQuery()`, `db.transact()`, `db.auth`
   - **Future:** Will be replaced with proper auth system (Okta, Auth0, or similar)

### **Development Workflow:**

**Local Development:**
```bash
# Terminal 1: Start GraphQL Server (PRIMARY DATA)
cd /Users/russell/Work/AA-Celestyal/Dev/talia-graphql-server
npm start
# Runs on http://localhost:4000/graphql

# Terminal 2: Start Talia UI (FRONTEND)
cd /Users/russell/Work/AA-Celestyal/Dev/talia-ui
npm run dev
# Runs on http://localhost:5173
```

**Production Deployment:**
- Both projects deploy together to Netlify
- GraphQL server becomes Netlify function
- InstantDB remains cloud-hosted (temporary)

### **IMPORTANT RULES:**

✅ **DO:**
- Use `talia-graphql-server` for ALL business data queries
- Use InstantDB ONLY for auth and focus/user management
- Keep both servers running during local development
- Test GraphQL endpoints: `curl http://localhost:4000/graphql`

❌ **DON'T:**
- Mix business data storage between GraphQL and InstantDB
- Use InstantDB for business data (ships, sailings, KPIs, etc.)
- Assume GraphQL server is always running (check it first)
- Store user business preferences in GraphQL (use InstantDB)

### **Migration Path:**

**Current State (Phase 1):**
- InstantDB: Auth + Focus/User Management
- GraphQL: Business Data

**Future State (Phase 2):**
- Proper Auth System (Okta/Auth0): Authentication
- GraphQL: Business Data + Focus/User Management
- InstantDB: Deprecated/Removed

## 🎯 CRITICAL SUCCESS FACTORS

### ✅ CURRENT WORKING STATE (DO NOT CHANGE)
The system is currently working correctly with the following configuration:

**Library Versions (LOCKED):**
- React: 19.1.1
- React-DOM: 19.1.1
- Dockview: 4.9.0
- dockview-core: (dependency of Dockview 4.9.0)
- Chart.js: 4.5.0
- Tabulator: 5.6.1
- Apollo Client: 4.0.3
- GraphQL: 16.11.0
- **InstantDB: 0.21.26** (React client API only - NEVER use server API)

**DO NOT:**
- Upgrade any of these libraries without explicit discussion
- Change import methods or CDN loading
- Modify the package.json versions

### 🚫 CRITICAL: NEVER INTERFERE WITH DOCKVIEW'S LAYOUT SYSTEM

**ABSOLUTELY FORBIDDEN - THESE CAUSE LAYOUT ISSUES:**
- ❌ Do NOT add `window.dispatchEvent(new Event('resize'))` calls
- ❌ Do NOT add MutationObserver for DOM manipulation
- ❌ Do NOT directly manipulate `.dv-view` element styles
- ❌ Do NOT call `api.layout()` manually or during panel operations
- ❌ Do NOT add custom resize event listeners (`window.addEventListener('resize')`)
- ❌ Do NOT add ResizeObserver that interferes with Dockview
- ❌ Do NOT force DOM reflows with `offsetHeight` or similar
- ❌ Do NOT call `forcePanelResize()` or similar functions
- ❌ Do NOT add panel close resize listeners
- ❌ Do NOT trigger layout on sidebar changes
- ❌ Do NOT manipulate panel positioning after creation

### 🎯 CRITICAL: ALWAYS USE NATIVE LIBRARY METHODS

**MANDATORY PRINCIPLE - USE NATIVE CAPABILITIES ONLY:**

**✅ Tabulator (5.6.1) - ALWAYS USE NATIVE METHODS:**
- ✅ Use `instanceRef.current.on("rowClick", callback)` AFTER table creation
- ✅ Use `instanceRef.current.on("rowSelectionChanged", callback)` AFTER table creation
- ✅ Use `instanceRef.current.on("cellClick", callback)` AFTER table creation
- ✅ Use `selectableRows: 1` in initial config
- ✅ Use `rowClick: (e, row) => { try { row?.select?.(); } catch {} }` in initial config
- ❌ Do NOT bypass Tabulator's native selection with manual click handlers
- ❌ Do NOT use manual DOM event listeners on table containers
- ❌ Do NOT use `selectableRowsRangeMode` or other non-standard configs

**✅ Chart.js (4.5.0) - ALWAYS USE NATIVE METHODS:**
- ✅ Use `chart.destroy()` before creating new charts
- ✅ Use unique chart IDs: `chart-${Date.now()}-${counter}-${random}`
- ✅ Use Chart.js built-in resize handling
- ✅ Use Chart.js event system for interactions
- ❌ Do NOT manually manipulate canvas elements
- ❌ Do NOT add custom resize listeners to charts

**✅ Dockview (4.9.0) - ALWAYS USE NATIVE METHODS:**
- ✅ Use `api.addPanel()` with proper position references
- ✅ Use `api.onReady()` for initialization
- ✅ Use Dockview's built-in panel management
- ✅ Use `api.fromJSON()` and `api.toJSON()` for layout persistence
- ❌ Do NOT manually manipulate panel DOM elements
- ❌ Do NOT add custom panel event listeners

**WHY THIS MATTERS:**
- Native methods are tested, stable, and performant
- Bypassing native methods causes compatibility issues
- Manual workarounds often break with library updates
- Native methods handle edge cases and optimizations
- The existing TablePanel works perfectly using native Tabulator methods

**🔧 PROVEN PATTERN - TABULATOR EVENT LISTENERS:**

**✅ CORRECT APPROACH (Like Existing TablePanel):**
```javascript
// 1. Create Tabulator instance with basic config
instanceRef.current = new TabCtor(tableRef.current, {
  data: data,
  columns: columns,
  selectableRows: 1,
  // Basic config only - NO callbacks here
});

// 2. Add event listeners AFTER table creation
instanceRef.current.on("rowClick", (e, row) => {
  console.log('Row clicked:', row?.getData());
  try { row?.select?.(); } catch {}
});

instanceRef.current.on("rowSelectionChanged", (selectedData) => {
  console.log('Selection changed:', selectedData);
  const rec = selectedData && selectedData[0];
  if (rec) {
    // Handle selection
  }
});
```

**❌ INCORRECT APPROACH (Causes Issues):**
```javascript
// DON'T put callbacks in initial config - they often don't fire
instanceRef.current = new TabCtor(tableRef.current, {
  data: data,
  columns: columns,
  selectableRows: 1,
  rowClick: (e, row) => { /* This may not fire */ },
  rowSelectionChanged: (selectedData) => { /* This may not fire */ }
});
```

**🎯 KEY LESSON LEARNED:**
- **Event listeners added AFTER table creation work reliably**
- **Callbacks in initial config often don't fire**
- **Always use the proven pattern from existing working components**

**RECENT FIXES (DECEMBER 2024):**
- ✅ REMOVED all `forcePanelResize` functions
- ✅ REMOVED all manual `api.layout()` calls
- ✅ REMOVED all ResizeObserver from panels
- ✅ REMOVED all resize event listeners
- ✅ REMOVED all panel close resize triggers
- ✅ REMOVED all sidebar resize layout triggers
- ✅ FIXED panels stacking in tabs issue
- ✅ FIXED constant resizing when selecting panels

**WHY THIS MATTERS:**
- Dockview has its own internal layout system
- Chart.js has its own resize handling
- Tabulator has its own resize handling
- Our interference causes black panels and layout issues
- The libraries know how to handle their own resizing

### ✅ WHAT WORKS (KEEP AS IS)

**Dockview Integration:**
- Use only the official DockviewApi events: `onDidAddPanel`, `onDidRemovePanel`, `onDidLayoutChange`, `onDidActivePanelChange`, `onDidMovePanel`
- Let Dockview handle all DOM management naturally
- Use `api.layout(width, height)` only when explicitly needed (not during moves)
- Trust Dockview's internal layout calculations

**Chart.js Integration:**
- Use unique chart IDs: `chart-${Date.now()}-${counter}-${random}`
- Call `chart.destroy()` before creating new charts
- Let Chart.js handle its own canvas management
- Use Chart.js built-in resize handling

**Tabulator Integration:**
- Use `instanceRef.current.redraw(true)` for resize
- Let Tabulator handle its own layout calculations
- Use built-in ResizeObserver within Tabulator components

### 🎯 CURRENT WORKING FEATURES

**Enhanced Docking:**
- ✅ Side-by-side docking works
- ✅ Stacked docking works
- ✅ Mixed layouts work
- ✅ Panel movement works without black panels
- ✅ Panel close resizing works

**Layout Presets:**
- ✅ Grid layout (2x2) works
- ✅ Horizontal layout works
- ✅ Vertical layout works
- ✅ Layout switching works

**Component Integration:**
- ✅ Tabulator tables display correctly
- ✅ Chart.js charts render properly
- ✅ GraphQL panels load data
- ✅ Theme system works
- ✅ Font scaling works

### 🔧 DEVELOPMENT PRINCIPLES

**When Adding New Features:**
1. **Test with current working state first** - Ensure existing functionality still works
2. **Use library APIs correctly** - Follow official documentation for each library
3. **ALWAYS use native library methods** - Never bypass or work around library APIs
4. **Follow proven patterns** - Use the same approach as existing working components
5. **Avoid DOM manipulation** - Let libraries handle their own DOM
6. **Test panel movement** - Ensure no black panel issues
7. **Test layout presets** - Ensure all presets still work
8. **Test component rendering** - Ensure all components display correctly

**🎯 MANDATORY: Native Library Methods Only**
- **Tabulator:** Use `instanceRef.current.on()` AFTER table creation, not callbacks in config
- **Chart.js:** Use Chart.js event system, not manual DOM listeners
- **Dockview:** Use Dockview API methods, not manual panel manipulation
- **InstantDB:** Use `db.useQuery()` and `db.transact()`, not server-side methods

**When Debugging Issues:**
1. **Check library versions first** - Ensure we're using correct versions
2. **Look for DOM interference** - Check for any direct DOM manipulation
3. **Check resize events** - Ensure we're not forcing resize events
4. **Test with manual resize** - If manual resize fixes it, we're interfering somewhere
5. **Use browser dev tools** - Check for console errors or warnings

### 📋 TESTING CHECKLIST

Before considering any feature complete:
- [ ] Panel movement works without black panels
- [ ] Layout presets (Grid, Horizontal, Vertical) all work
- [ ] Tabulator tables display and resize correctly
- [ ] Chart.js charts render and update correctly
- [ ] GraphQL panels load data correctly
- [ ] Theme switching works
- [ ] Font scaling works
- [ ] Sidebar resizing works
- [ ] Panel close resizing works
- [ ] No console errors or warnings

### 🚨 RED FLAGS (STOP IMMEDIATELY)

If you see any of these, STOP and revert:
- Black panels after moving panels
- Panels not displaying content after layout changes
- Console errors about "Canvas is already in use"
- Console errors about "Invalid grid element"
- Console errors about "Table Not Initialized"
- Any DOM manipulation of Dockview elements
- Any forced resize events


### 📚 REFERENCE DOCUMENTATION

**Always use official docs for current versions:**
- **talia-graphql-server**: Check `/talia-graphql-server/src/` for schema and resolvers
- **InstantDB 0.21.26**: https://instantdb.com/docs (CRITICAL - React client API ONLY, used for auth/focus management)
- Dockview 4.9.0: Check `node_modules/dockview-core/dist/esm/api/component.api.d.ts`
- Chart.js 4.5.0: https://www.chartjs.org/docs/4.5.0/
- Tabulator 5.6.1: http://tabulator.info/docs/5.6
- React 19.1.1: https://19.react.dev/

**⚠️ GRAPHQL SERVER (PRIMARY DATA SOURCE):**
- Base URL (local): `http://localhost:4000/graphql`
- Must be running for dashboard data to work
- Start command: `cd talia-graphql-server && npm start`
- Test: `curl http://localhost:4000/graphql -H "Content-Type: application/json" -d '{"query":"{ ships { Ship_Name } }"}'`
- Use Apollo Client for queries in React components
- All business data comes from here

**⚠️ INSTANTDB (TEMPORARY - AUTH & FOCUS ONLY):**
- Use `db.useQuery()` for data fetching (NOT `useQuery` imported separately)
- Use `db.transact()` for create/update/delete operations
- Use `db.id()` for generating UUIDs
- Use `db.auth` for authentication operations
- **NEVER use `db.query()` - this is server-side only**
- **ONLY use for:** Authentication, User Mappings, Focus Management, User Preferences
- **DO NOT use for:** Business data (ships, sailings, KPIs, etc.)
- Always refer to React client documentation, not server documentation
### 🎯 SUCCESS METRICS

The system is working correctly when:
1. **Panel movement is smooth** - No black panels, immediate visual feedback
2. **Layout presets work** - All three presets function correctly
3. **Components render properly** - Tables, charts, and GraphQL data display correctly
4. **No console errors** - Clean console with no warnings or errors
5. **Responsive behavior** - Panels resize correctly with browser and sidebar changes

### 🚨 MANDATORY CONTEXT LOADING

**BEFORE MAKING ANY CHANGES:**
1. **ALWAYS read this context_statement.md file first**
2. **ALWAYS check the current working state**
3. **NEVER add any layout manipulation code**
4. **NEVER add any resize event listeners**
5. **NEVER call api.layout() manually**

**CONTEXT LOADING BEHAVIOR:**
- I will automatically load this context file when working on this project
- You do NOT need to explicitly mention it in future conversations
- I will always check this file before making any changes
- I will respect all the prohibitions listed above
- I will maintain the current working state

**ABSOLUTE PROHIBITION:**
- **NEVER** repeat the layout manipulation mistakes that were just fixed
- **NEVER** add any code that interferes with Dockview's layout system
- **NEVER** add any resize event listeners or observers
- **NEVER** call api.layout() or similar layout methods
- **ALWAYS** let Dockview handle its own layout and resizing

---

**REMEMBER: The current state works perfectly. Don't fix what isn't broken. Trust the libraries to do their job. The layout issues are SOLVED - do not reintroduce them.**
