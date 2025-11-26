# InstantDB to Supabase Migration Guide

## 📋 Overview

This guide helps migrate existing data from InstantDB to Supabase before removing InstantDB dependencies.

## 🔍 Data to Migrate

### 1. taliaUser Mappings
**InstantDB Entity**: `taliaUser`
- `taliaUserId` (number) → Maps to `talia_users.talia_user_id`
- `instantAuthId` (string) → Maps to `talia_users.id` (Supabase auth.users.id)

**Supabase Table**: `talia_users`
- `id` (UUID, FK to auth.users.id)
- `talia_user_id` (bigint, unique)
- `email` (text, unique)

**Migration Notes**:
- Requires matching email addresses between InstantDB auth and Supabase auth
- Users must sign in with Supabase auth first to create `auth.users` record
- Then `talia_users` record can be created with matching `talia_user_id`

### 2. Focus Definitions
**InstantDB Entity**: `focus`
- `name`, `description`, `type`, `isStandard`, `assignedRoles`, `isDefault`, `isActive`
- `createdBy` (taliaUserId) → Maps to `focuses.created_by` (UUID)
- `layoutData` (JSON) → Maps to `focuses.layout_data` (JSONB)
- `createdAt`, `updatedAt` → Maps to `focuses.created_at`, `focuses.updated_at`

**Supabase Table**: `focuses`
- All fields map directly
- `created_by` needs UUID (from `talia_users.id` based on `taliaUserId`)

### 3. User Focus Preferences
**InstantDB Entity**: `userFocusPreference`
- `taliaUserId` (number) → Maps to `user_focus_preferences.user_id` (UUID)
- `focusId` (string) → Maps to `user_focus_preferences.focus_id` (UUID)
- `isFavorite`, `lastUsed`, `customLayout`

**Supabase Table**: `user_focus_preferences`
- All fields map directly
- Requires both `user_id` and `focus_id` to be UUIDs

---

## 🚀 Migration Methods

### Method 1: Automated Script (If InstantDB is Accessible)

**Prerequisites**:
- InstantDB is still connected and accessible
- `@instantdb/react` package is installed
- InstantDB app ID is configured

**Run Migration**:
```bash
cd talia-ui
node scripts/migrate-instantdb-to-supabase.js
```

**What it does**:
1. Connects to InstantDB
2. Queries all entities (taliaUser, focus, userFocusPreference)
3. Migrates data to Supabase tables
4. Reports migration statistics

### Method 2: Manual Export/Import (If InstantDB is Not Accessible)

**Step 1: Export from InstantDB Dashboard**
1. Go to https://instantdb.com/dash
2. Select app: **Talia** (`1c2b040a-7bb2-4eb5-8490-ce5832e19dd0`)
3. Navigate to each entity type (taliaUser, focus, userFocusPreference)
4. Export data as JSON

**Step 2: Transform Data**
Use the provided transformation script or manually map:
- InstantDB entity IDs → Supabase UUIDs
- taliaUserId → Match with Supabase talia_users.talia_user_id
- Focus names → Match with Supabase focuses.name

**Step 3: Import to Supabase**
Use Supabase SQL Editor or API to insert data:
```sql
-- Example: Insert focus
INSERT INTO focuses (name, description, type, is_standard, assigned_roles, layout_data)
VALUES ('Performance', 'Performance dashboard', 'standard', true, ARRAY['ADMIN', 'MANAGER'], '{}');
```

### Method 3: Check Existing Data First

**Check Supabase Tables**:
```sql
-- Check existing users
SELECT * FROM talia_users;

-- Check existing focuses
SELECT * FROM focuses;

-- Check existing preferences
SELECT * FROM user_focus_preferences;
```

**If tables are empty**: No migration needed, start fresh
**If tables have data**: Verify data integrity, may need to merge

---

## 📝 Migration Checklist

### Pre-Migration
- [ ] Check if InstantDB is accessible
- [ ] Check if InstantDB has any data
- [ ] Verify Supabase tables exist
- [ ] Backup Supabase data (if any)

### Migration Steps
- [ ] Migrate taliaUser mappings (if any)
- [ ] Migrate focus definitions
- [ ] Migrate user focus preferences
- [ ] Verify data integrity
- [ ] Test application with migrated data

### Post-Migration
- [ ] Verify all data migrated correctly
- [ ] Test user sign-in with Supabase auth
- [ ] Verify focus loading works
- [ ] Verify user preferences work
- [ ] Remove InstantDB dependencies

---

## ⚠️ Important Notes

### User ID Mapping
- **taliaUserId** (bigint) must be preserved
- Users need to sign in with Supabase auth to get `auth.users.id`
- Then `talia_users` record is created/updated with matching `talia_user_id`

### Focus Migration
- Focus names should be unique
- `created_by` field requires UUID from `talia_users.id`
- If `created_by` taliaUserId doesn't exist, set to `NULL` or admin user

### Preference Migration
- Requires both user and focus to exist in Supabase
- Map `taliaUserId` → `talia_users.id` (UUID)
- Map `focusId` (name) → `focuses.id` (UUID)

---

## 🔧 Troubleshooting

### InstantDB Not Accessible
- **Solution**: Use Method 2 (Manual Export/Import)
- Or check if InstantDB app is still active
- Verify InstantDB credentials/config

### Missing User Mappings
- **Solution**: Users will be auto-created on first Supabase sign-in
- `talia_user_id` will be auto-assigned
- Existing preferences may need manual linking

### Focus ID Mismatch
- **Solution**: Focus IDs change from InstantDB string IDs to Supabase UUIDs
- Use focus names for matching
- Update any hardcoded focus IDs

---

## 📊 Migration Script Output

The migration script will output:
```
🚀 Starting InstantDB → Supabase Migration
============================================================
InstantDB App ID: 1c2b040a-7bb2-4eb5-8490-ce5832e19dd0
Supabase URL: http://127.0.0.1:54321
============================================================

📋 Migrating taliaUser mappings...
   Found X taliaUser mappings
   ✅ Migrated: X
   ⏭️  Skipped: X (already exists)
   ❌ Errors: X

📋 Migrating focus definitions...
   Found X focus definitions
   ✅ Migrated: X
   ⏭️  Skipped: X (already exists)
   ❌ Errors: X

📋 Migrating user focus preferences...
   Found X user focus preferences
   ✅ Migrated: X
   ⏭️  Skipped: X (already exists or missing dependencies)
   ❌ Errors: X

📊 Migration Summary
============================================================
Total Found: X
Total Migrated: X
============================================================
```

---

## ✅ Success Criteria

Migration is successful when:
1. ✅ All focus definitions migrated to Supabase
2. ✅ All user preferences migrated (or can be recreated)
3. ✅ User mappings preserved (talia_user_id maintained)
4. ✅ Application works with Supabase data
5. ✅ No data loss

---

## 🎯 Next Steps After Migration

1. **Test Application**: Verify all features work with Supabase data
2. **Remove InstantDB**: Delete InstantDB config files and dependencies
3. **Update Documentation**: Remove InstantDB references
4. **Clean Up**: Remove unused InstantDB code

