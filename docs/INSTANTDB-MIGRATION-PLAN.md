# InstantDB Data Migration Plan

## 🎯 Goal
Migrate any existing InstantDB data to Supabase before removing InstantDB dependencies.

## 📊 Data Inventory

### What Exists in InstantDB Schema
1. **taliaUser** - User ID mappings (instantAuthId → taliaUserId)
2. **focus** - Focus definitions with layout data
3. **userFocusPreference** - User-specific focus preferences

### What Already Exists in Supabase
- ✅ `talia_users` table (1 row)
- ✅ `focuses` table (1 row)
- ✅ `user_focus_preferences` table (0 rows)

## 🔍 Step 1: Check if Data Exists

### Option A: Run Migration Script
```bash
cd talia-ui
node scripts/migrate-instantdb-to-supabase.js
```

**Expected Output**:
- If InstantDB is accessible: Will query and migrate data
- If InstantDB is not accessible: Will report and skip migration

### Option B: Manual Check
1. Check InstantDB Dashboard: https://instantdb.com/dash
2. Select app: Talia (`1c2b040a-7bb2-4eb5-8490-ce5832e19dd0`)
3. Check each entity type for data

### Option C: Check Supabase Tables
```sql
-- Check existing data
SELECT COUNT(*) FROM talia_users;
SELECT COUNT(*) FROM focuses;
SELECT COUNT(*) FROM user_focus_preferences;
```

## 📋 Migration Steps

### Step 1: Install InstantDB (if needed)
```bash
cd talia-ui
npm install @instantdb/react
```

### Step 2: Run Migration Script
```bash
node scripts/migrate-instantdb-to-supabase.js
```

### Step 3: Review Results
- Check migration statistics
- Verify data in Supabase tables
- Handle any errors or skipped items

### Step 4: Manual Reconciliation (if needed)
- Match InstantDB users with Supabase auth users by email
- Update `talia_users.created_by` for focuses
- Link user preferences to migrated focuses

## ✅ Success Criteria

Migration is complete when:
1. ✅ All focus definitions migrated (or confirmed none exist)
2. ✅ User preferences migrated (or can be recreated)
3. ✅ User mappings preserved (talia_user_id maintained)
4. ✅ No critical data loss

## 🚨 If No Data Exists

If InstantDB has no data or is not accessible:
- ✅ **No migration needed** - Start fresh with Supabase
- ✅ Proceed with removing InstantDB dependencies
- ✅ Users will be auto-created on first Supabase sign-in

## 📝 Next Steps

After migration (or confirming no migration needed):
1. Test application with Supabase data
2. Proceed with Phase 2: Remove InstantDB dependencies
3. Clean up InstantDB config files

