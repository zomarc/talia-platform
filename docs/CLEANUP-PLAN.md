# Code Cleanup Plan - Post InstantDB Migration

## Overview
This document outlines all old and redundant code that should be removed now that the migration from InstantDB to Supabase is complete and working.

## ✅ Completed Migration
- ✅ Authentication migrated to Supabase (email/password)
- ✅ Focus management using GraphQL → Supabase
- ✅ User management using GraphQL → Supabase
- ✅ All InstantDB packages removed from package.json
- ✅ Database backup created

## 🗑️ Files/Directories to Remove

### 1. Migration Scripts (No Longer Needed)
**Location**: `talia-ui/scripts/`
- ❌ `migrate-instantdb-to-supabase.js` - Failed migration attempt
- ❌ `migrate-instantdb-auth.js` - Failed migration attempt  
- ❌ `migrate-instantdb-browser.html` - Failed browser-based migration
- ❌ `recreate-focuses.js` - One-time script, no longer needed

**Action**: Delete these files as they were one-time migration scripts.

### 2. Legacy Auth Context (Redundant)
**Location**: `talia-ui/src/contexts/AuthContext.jsx`
- ⚠️ **Status**: Compatibility wrapper around `SupabaseAuthContext`
- ⚠️ **Usage**: Still used by some components via `useAuth()` hook
- **Action**: 
  - First: Audit all `useAuth()` imports and migrate to `useSupabaseAuth()`
  - Then: Delete `AuthContext.jsx` once all components are migrated

### 3. Mock Database Stub (No Longer Needed)
**Location**: `talia-ui/src/lib/db.js`
- ❌ Mock `db` object that provides `useQuery` hook
- **Action**: Delete this file - no components should be using it anymore

### 4. Clean User Service (Contains InstantDB References)
**Location**: `talia-ui/src/services/CleanUserService.js`
- ⚠️ Contains comments referencing InstantDB
- **Action**: 
  - Review if this service is still used
  - If unused: Delete
  - If used: Update comments to reference Supabase instead

### 5. Archive Documentation (Historical Reference)
**Location**: `talia-ui/archive/docs/`
- ⚠️ Contains InstantDB documentation and guides
- **Files**:
  - `INSTANTDB-IMPLEMENTATION-GUIDE.md`
  - `INSTANTDB-API-REFERENCE.md`
  - `INSTANTDB-OFFICIAL-API.md`
  - `CURRENT-STATE-SUMMARY.md` (may contain InstantDB references)
  - `TALIA-AUTH-PLAN.md` (may contain InstantDB references)
  - `CLEAN-USER-SYSTEM.md` (may contain InstantDB references)
- **Action**: 
  - Keep for historical reference OR
  - Move to `docs/archive/` if you want to preserve but not clutter

### 6. Migration Documentation (Keep for Reference)
**Location**: `docs/`
- ✅ **Keep these** - They document the migration process:
  - `INSTANTDB-MANUAL-MIGRATION.md`
  - `INSTANTDB-MIGRATION-GUIDE.md`
  - `INSTANTDB-MIGRATION-PLAN.md`
  - `INSTANTDB-MIGRATION-SUMMARY.md`
  - `MIGRATION-STATUS.md`
  - `PHASE-1-IMPLEMENTATION.md`
  - `SUPABASE-AUTH-MIGRATION-PLAN.md`

## 🔍 Code Audit Required

### Components Using `useAuth()` (from AuthContext)
**Found files still using `useAuth()`**:
- ✅ `talia-ui/src/components/focus-management/FocusSelector.jsx` - Uses `useAuth()`
- ✅ `talia-ui/src/components/focus-panels/SailingTable/SailingTablePresenter.jsx` - Uses `useAuth()`
- ✅ `talia-ui/src/components/FocusDemo.jsx` - Uses `useAuth()`
- ✅ `talia-ui/src/App.jsx` - Uses `useAuth()`

**Action**: Migrate these to `useSupabaseAuth()` before deleting `AuthContext.jsx`

### Components Using Mock `db` Object
**Found file using mock `db.js`**:
- ✅ `talia-ui/src/services/CleanUserService.js` - Imports `db` from `../lib/db`

**Action**: 
- Review `CleanUserService.js` to see if it's still used
- If used: Update to use Supabase/GraphQL instead
- If unused: Delete both `CleanUserService.js` and `db.js`

## 📋 Cleanup Steps (In Order)

### Phase 1: Safe Deletions (No Dependencies)
1. ✅ Delete migration scripts:
   ```bash
   rm talia-ui/scripts/migrate-instantdb-*.js
   rm talia-ui/scripts/migrate-instantdb-*.html
   rm talia-ui/scripts/recreate-focuses.js
   ```

2. ✅ Delete mock database stub:
   ```bash
   rm talia-ui/src/lib/db.js
   ```

### Phase 2: Audit and Migrate
3. ⚠️ Audit `useAuth()` usage:
   - Find all components using `useAuth` from `AuthContext`
   - Migrate to `useSupabaseAuth` from `SupabaseAuthContext`
   - Test each component after migration

4. ⚠️ Audit `CleanUserService.js`:
   - Check if still used
   - Update comments if used, delete if unused

### Phase 3: Remove Legacy Code
5. ⚠️ After Phase 2 is complete:
   - Delete `talia-ui/src/contexts/AuthContext.jsx`
   - Delete `talia-ui/src/services/CleanUserService.js` (if unused)

### Phase 4: Documentation Cleanup
6. ⚠️ Archive old documentation:
   - Move `talia-ui/archive/docs/INSTANTDB-*.md` to `docs/archive/` OR
   - Delete if not needed for historical reference

## 🧪 Testing After Cleanup

After each phase, verify:
- ✅ Application starts without errors
- ✅ Authentication works (login/logout)
- ✅ Focus management works (create, update, save, load)
- ✅ User management works (if applicable)
- ✅ No console errors related to missing modules

## 📝 Notes

- **Backup**: Database backup already created at `talia-server/backups/backup-*.json`
- **Git**: All changes committed in commit `a476786`
- **Status**: System is working correctly with Supabase + GraphQL

## 🎯 Priority

1. **High Priority** (Safe to delete now):
   - Migration scripts (`talia-ui/scripts/migrate-*.js`)
   - Mock database stub (`talia-ui/src/lib/db.js`)

2. **Medium Priority** (Requires audit first):
   - `AuthContext.jsx` (after migrating all `useAuth()` calls)
   - `CleanUserService.js` (after verifying usage)

3. **Low Priority** (Historical reference):
   - Archive documentation (can be moved/deleted later)

