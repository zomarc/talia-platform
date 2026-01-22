# Next Steps - Talia UI Development

## Current Status ✅

### Completed
- ✅ CSS architecture established (theme.css, components.css, dashboard.css)
- ✅ Tabulator integrated via npm with standard midnight theme
- ✅ Chart.js configured with global theme defaults
- ✅ Dev components (DataTypesValidation, DevRoleSelector) styled externally
- ✅ Supabase initialization fixed (graceful handling of missing env vars)
- ✅ Development server running and accessible

### Known Issues (Working but Needs Attention)
- ⚠️ Supabase uses placeholder client when env vars missing (app works but Supabase features disabled)
- ⚠️ Some inline styles remain in Dashboard.jsx and App.jsx (non-critical)

---

## Immediate Next Steps (Priority Order)

### 1. **Complete Inline Style Migration** (High Priority)
**Goal:** Remove all remaining inline styles from core components

**Tasks:**
- [ ] Review `Dashboard.jsx` for remaining inline styles
  - Sidebar styles (if any remain)
  - Main content area styles
  - Button and form element styles
- [ ] Review `App.jsx` for inline styles
- [ ] Update components to use CSS classes from `dashboard.css` or `components.css`
- [ ] Test visual consistency after changes

**Files to Update:**
- `src/Dashboard.jsx`
- `src/App.jsx`
- Any other components with inline styles

**Reference:**
- See `STYLING-GUIDE.md` for guidelines
- See `VoyageReport` component as example

---

### 2. **Supabase Configuration** (Medium Priority)
**Goal:** Properly configure Supabase or make it optional

**Options:**
- **Option A:** Add `.env` file with Supabase credentials (if Supabase is needed)
- **Option B:** Make Supabase completely optional (lazy load, feature flags)
- **Option C:** Remove Supabase if not needed

**Current State:**
- App works without Supabase (uses placeholder client)
- Supabase features are disabled when env vars missing
- Console warning appears (non-blocking)

**Decision Needed:**
- Is Supabase required for this application?
- If yes, add `.env` file with credentials
- If no, consider removing Supabase dependency or making it truly optional

---

### 3. **Component Style Audit** (Medium Priority)
**Goal:** Ensure all components follow external styling pattern

**Tasks:**
- [ ] Audit all focus-panel components for inline styles
- [ ] Audit chart components (ensure using `chartConfig.js`)
- [ ] Audit admin components
- [ ] Create CSS classes for any missing patterns
- [ ] Update components to use external styles

**Components to Review:**
- `MasterVoyagePerformanceSummary`
- `BookingProfilePresenter`
- Other focus-panel components
- Admin components

---

### 4. **Documentation Cleanup** (Low Priority)
**Goal:** Archive outdated docs, consolidate active documentation

**Tasks:**
- [ ] Review all `.md` files in root directory
- [ ] Archive outdated documentation to `archive/docs/`
- [ ] Consolidate overlapping documentation
- [ ] Update `README.md` with current architecture

**Files to Review:**
- Multiple architecture/component guides (may have overlap)
- Old implementation guides
- Testing guides

---

## Development Workflow

### Running the Application
```bash
cd talia-ui
npm run dev
```
Server runs on: `http://localhost:5173`

### Making Style Changes
1. **Theme Variables:** Edit `src/styles/theme.css`
2. **Component Classes:** Edit `src/styles/components.css`
3. **Dashboard Classes:** Edit `src/styles/dashboard.css`
4. **Dev Components:** Edit `src/styles/dev-components.css`
5. **Never:** Use inline styles or CSS injection

### Adding New Components
1. Follow `STYLING-GUIDE.md` principles
2. Use CSS classes from `components.css` or create new ones
3. Use CSS variables from `theme.css` for colors/spacing
4. Reference `VoyageReport` as example
5. See `COMPONENT-CREATION-GUIDE.md` in focus-panels folder

---

## Technical Debt

### Known Issues
1. **Supabase Placeholder Client**
   - Currently uses placeholder when env vars missing
   - Should be properly configured or made optional
   - Status: Working but needs decision

2. **Remaining Inline Styles**
   - Some components still have inline styles
   - Non-critical but should be migrated for consistency
   - Status: Low priority, app works fine

3. **Documentation Overlap**
   - Multiple guides covering similar topics
   - Should be consolidated
   - Status: Low priority

---

## Architecture Decisions

### Styling System
- ✅ **Single theme** (no theme switching)
- ✅ **CSS variables** for all colors/spacing
- ✅ **External CSS classes** (no inline styles)
- ✅ **Library standard themes** (no overrides)

### Library Integration
- ✅ **Tabulator:** npm package, midnight theme, no overrides
- ✅ **Chart.js:** npm package, global config via `chartConfig.js`
- ✅ **Dockview:** Uses standard theming

### Component Structure
- ✅ **Container/Presenter pattern** for data/UI separation
- ✅ **Shared libraries** for formatters, column configs
- ✅ **BEM-style CSS naming** (`.talia-*`, `.dashboard-*`, `.dev-*`)

---

## Questions to Resolve

1. **Supabase:** Required or optional? If required, need `.env` file.
2. **Inline Styles:** Complete migration now or later?
3. **Documentation:** Consolidate now or as-needed?

---

## Success Criteria

- [ ] All components use external CSS (no inline styles)
- [ ] Supabase properly configured or removed
- [ ] Documentation consolidated and up-to-date
- [ ] Visual consistency across entire application
- [ ] Development workflow smooth and clear

---

## Notes

- Current state is **functional** - app runs and works
- Supabase issue is **non-blocking** - app continues without it
- Style migration is **ongoing** - most critical parts done
- Focus on **stability** and **consistency** going forward
