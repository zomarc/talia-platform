# Manual InstantDB to Supabase Migration Guide

## 🔍 Current Situation

The automated migration script cannot access InstantDB data because:
- InstantDB React client doesn't expose `adminAPI` for backend queries
- Data needs to be exported manually from InstantDB dashboard

## 📋 Step-by-Step Manual Migration

### Step 1: Check InstantDB Dashboard for Data

1. **Open InstantDB Dashboard**
   - Go to: https://instantdb.com/dash
   - Sign in with your InstantDB account
   - Select app: **Talia** (`1c2b040a-7bb2-4eb5-8490-ce5832e19dd0`)

2. **Check Each Entity Type**
   - Navigate to **Data** or **Tables** section
   - Check for:
     - `taliaUser` entities
     - `focus` entities  
     - `userFocusPreference` entities

### Step 2: Export Data from InstantDB

**Option A: Export via Dashboard**
1. In InstantDB dashboard, select each entity type
2. Use export functionality (if available)
3. Export as JSON or CSV

**Option B: Use InstantDB CLI**
```bash
# Install InstantDB CLI
npm install -g instant-cli

# Login to InstantDB
npx instant-cli@latest login

# Export data (if CLI supports export)
npx instant-cli@latest export --app 1c2b040a-7bb2-4eb5-8490-ce5832e19dd0
```

**Option C: Manual Copy**
1. View data in InstantDB dashboard
2. Copy JSON data manually
3. Save to files for import

### Step 3: Transform Data for Supabase

#### taliaUser → talia_users

**InstantDB Format**:
```json
{
  "id": "uuid",
  "taliaUserId": 1000,
  "instantAuthId": "auth_123"
}
```

**Supabase Format**:
```sql
INSERT INTO talia_users (id, talia_user_id, email, created_at)
VALUES (
  'uuid-from-supabase-auth',  -- Must match auth.users.id
  1000,                        -- Preserve taliaUserId
  'user@example.com',         -- Get from auth.users.email
  NOW()
);
```

**Note**: Requires matching email between InstantDB auth and Supabase auth

#### focus → focuses

**InstantDB Format**:
```json
{
  "id": "focus-uuid",
  "name": "Performance",
  "description": "Performance dashboard",
  "type": "standard",
  "isStandard": true,
  "assignedRoles": ["ADMIN", "MANAGER"],
  "isDefault": false,
  "isActive": true,
  "createdBy": 1000,
  "layoutData": {...},
  "createdAt": "2024-01-01T00:00:00Z",
  "updatedAt": "2024-01-01T00:00:00Z"
}
```

**Supabase Format**:
```sql
INSERT INTO focuses (
  name, description, type, is_standard, assigned_roles,
  is_default, is_active, created_by, layout_data, created_at, updated_at
)
VALUES (
  'Performance',
  'Performance dashboard',
  'standard',
  true,
  ARRAY['ADMIN', 'MANAGER'],
  false,
  true,
  'uuid-from-talia_users-id',  -- Map createdBy (taliaUserId) to UUID
  '{"components": []}'::jsonb,
  '2024-01-01T00:00:00Z',
  '2024-01-01T00:00:00Z'
);
```

#### userFocusPreference → user_focus_preferences

**InstantDB Format**:
```json
{
  "id": "pref-uuid",
  "taliaUserId": 1000,
  "focusId": "focus-uuid-or-name",
  "isFavorite": true,
  "lastUsed": "2024-01-01T00:00:00Z",
  "customLayout": {...}
}
```

**Supabase Format**:
```sql
INSERT INTO user_focus_preferences (
  user_id, focus_id, is_favorite, last_used, custom_layout
)
VALUES (
  'uuid-from-talia_users-id',  -- Map taliaUserId to UUID
  'uuid-from-focuses-id',      -- Map focusId to UUID
  true,
  '2024-01-01T00:00:00Z',
  '{}'::jsonb
);
```

### Step 4: Import to Supabase

**Using Supabase SQL Editor**:
1. Open Supabase Studio: http://127.0.0.1:54323
2. Go to **SQL Editor**
3. Run INSERT statements for each entity
4. Verify data in **Table Editor**

**Using Supabase API**:
```javascript
// Example using Supabase client
const { data, error } = await supabase
  .from('focuses')
  .insert({
    name: 'Performance',
    description: 'Performance dashboard',
    // ... other fields
  });
```

### Step 5: Verify Migration

```sql
-- Check migrated data
SELECT COUNT(*) FROM talia_users;
SELECT COUNT(*) FROM focuses;
SELECT COUNT(*) FROM user_focus_preferences;

-- Verify specific records
SELECT * FROM talia_users ORDER BY talia_user_id;
SELECT * FROM focuses ORDER BY name;
SELECT * FROM user_focus_preferences;
```

## 🎯 Quick Migration Script (If You Have JSON Data)

If you've exported data from InstantDB as JSON, you can use this script:

```javascript
// migrate-from-json.js
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const supabase = createClient(
  'http://127.0.0.1:54321',
  'your-service-role-key'
);

// Load exported JSON files
const taliaUsers = JSON.parse(readFileSync('taliaUsers.json', 'utf-8'));
const focuses = JSON.parse(readFileSync('focuses.json', 'utf-8'));
const preferences = JSON.parse(readFileSync('preferences.json', 'utf-8'));

// Migrate focuses
for (const focus of focuses) {
  // Transform and insert
  await supabase.from('focuses').insert({
    name: focus.name,
    // ... map other fields
  });
}

// Similar for other entities
```

## ✅ Migration Checklist

- [ ] Checked InstantDB dashboard for existing data
- [ ] Exported data from InstantDB (JSON/CSV/manual)
- [ ] Transformed data to Supabase format
- [ ] Mapped taliaUserId to Supabase UUIDs
- [ ] Mapped focus IDs (names) to Supabase UUIDs
- [ ] Imported data to Supabase
- [ ] Verified data integrity
- [ ] Tested application with migrated data

## 🚨 Important Notes

1. **User IDs**: `talia_user_id` must be preserved - users need to sign in with Supabase auth first
2. **Focus IDs**: Focus IDs change from InstantDB string IDs to Supabase UUIDs - use names for matching
3. **Created By**: Map `createdBy` (taliaUserId) to `talia_users.id` (UUID)
4. **Timestamps**: Convert InstantDB dates to ISO strings for Supabase

## 📞 Need Help?

If you encounter issues:
1. Check Supabase logs for errors
2. Verify foreign key constraints
3. Ensure UUIDs match between tables
4. Check data types match Supabase schema

