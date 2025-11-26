# Supabase Auth & Focus Management Migration Plan

## 🎯 Goal
Migrate from InstantDB to Supabase for authentication, user management, and focus management. Create a simple authentication screen for development/testing while retaining user IDs for future SSO integration.

## 📊 Current State Analysis

### ✅ Already in Supabase
- **User Management**: `talia_users` table exists with:
  - `id` (UUID, FK to `auth.users.id`)
  - `talia_user_id` (bigint, unique, auto-incrementing from 1000)
  - `email` (unique)
  - Timestamps

- **Focus Management**: Tables exist:
  - `focuses` - Focus definitions with layout data
  - `user_focus_preferences` - User-specific focus preferences
  - `focus_groups` - Focus grouping

- **Auth Context**: `SupabaseAuthContext` already implemented
- **Landing Page**: Already uses Supabase `signInWithEmail` (magic link)

### ❌ Still Using InstantDB
- `instant.schema.ts`, `instant.config.json`, `instant.perms.ts` files exist
- `src/lib/db.js` is a stub (mock InstantDB interface)
- `src/services/CleanUserService.js` references InstantDB
- Some components may still reference InstantDB

### ⚠️ Needs Migration
- Focus management uses GraphQL service (could migrate to direct Supabase queries)
- Magic link auth (needs simple email/password for dev)

---

## 📋 Migration Steps

### Phase 1: Simple Authentication Screen (Development Access)
**Goal**: Replace magic link with simple email/password authentication for development/testing

#### Step 1.1: Create Simple Auth Component
- [ ] Create `src/components/SimpleAuth.jsx`
  - Email input
  - Password input (for development - can be simple like "dev123")
  - Submit button
  - Error handling
  - Development mode indicator

#### Step 1.2: Update SupabaseAuthContext
- [ ] Add `signInWithPassword(email, password)` method
- [ ] Add development mode flag
- [ ] For development: Allow simple password check or auto-create users
- [ ] Keep `signInWithEmail` for production (magic link)

#### Step 1.3: Update LandingPage
- [ ] Replace magic link form with simple email/password form
- [ ] Add development mode toggle/indicator
- [ ] Keep user ID retention logic (talia_user_id mapping)

#### Step 1.4: Test Simple Auth
- [ ] Test login with email/password
- [ ] Verify user creation in `talia_users` table
- [ ] Verify `talia_user_id` assignment
- [ ] Test session persistence

---

### Phase 2: Remove InstantDB Dependencies
**Goal**: Remove all InstantDB references and ensure everything uses Supabase

#### Step 2.1: Remove InstantDB Files
- [ ] Delete `instant.schema.ts`
- [ ] Delete `instant.config.json`
- [ ] Delete `instant.perms.ts`
- [ ] Remove `@instantdb/react` from package.json (if present)

#### Step 2.2: Update Services
- [ ] Remove `src/services/CleanUserService.js` (or migrate to Supabase)
- [ ] Update `src/lib/db.js` to use Supabase instead of mock
- [ ] Remove any InstantDB imports/references

#### Step 2.3: Update Components
- [ ] Search for all InstantDB references
- [ ] Update `UserMappingTable.jsx` to use Supabase `talia_users` table
- [ ] Remove InstantDB-specific code

#### Step 2.4: Verify No InstantDB Dependencies
- [ ] Search codebase for "instant", "InstantDB", "@instantdb"
- [ ] Remove all references
- [ ] Test application loads without InstantDB

---

### Phase 3: Verify GraphQL Resolvers Use Supabase
**Goal**: Ensure GraphQL resolvers query Supabase (not InstantDB) for all data

#### Step 3.1: Verify Focus Management Resolvers
- [ ] Check `talia-server/src/api/resolvers.ts` - Focus queries should use `supabaseDataService`
- [ ] Verify `focusesByRole` resolver queries Supabase `focuses` table
- [ ] Verify `createFocus`, `updateFocus`, `deleteFocus` mutations use Supabase
- [ ] Verify focus preferences resolvers use Supabase

#### Step 3.2: Verify User Management Resolvers
- [ ] Check `taliaUser` query uses `supabaseDataService.getTaliaUserByEmail()`
- [ ] Verify user creation/update resolvers use Supabase `talia_users` table
- [ ] Ensure GraphQL context includes Supabase user ID

#### Step 3.3: Update GraphQL Context
- [ ] Update `talia-server/src/index.ts` context function
- [ ] Extract user from Supabase auth token (instead of mock user)
- [ ] Pass real user context to resolvers
- [ ] Ensure user role comes from Supabase `talia_users.role`

#### Step 3.4: Keep GraphQL as Data Access Layer
- [x] ✅ **Architecture**: UI → GraphQL → Supabase (correct - already implemented)
- [x] ✅ UI components use GraphQL queries/mutations (already correct)
- [x] ✅ GraphQL resolvers query Supabase (already implemented)
- [x] ✅ No direct Supabase queries from UI components (architecture enforced)

---

### Phase 4: User Management Consolidation
**Goal**: Ensure all user management is in Supabase `talia_users` table

#### Step 4.1: Verify User Creation Flow
- [ ] Ensure `SupabaseAuthContext.getOrCreateTaliaUser()` works correctly
- [ ] Verify `talia_user_id` auto-increment logic
- [ ] Test user creation on first login
- [ ] Test existing user login (uses existing `talia_user_id`)

#### Step 4.2: Add User Role Management
- [ ] Add `role` column to `talia_users` table (if not exists)
  ```sql
  ALTER TABLE talia_users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user';
  ```
- [ ] Add `name` column to `talia_users` table (if not exists)
  ```sql
  ALTER TABLE talia_users ADD COLUMN IF NOT EXISTS name TEXT;
  ```
- [ ] Update `getOrCreateTaliaUser()` to handle roles
- [ ] Add role assignment logic (default to 'user', allow admin override)

#### Step 4.3: Update User Context
- [ ] Ensure `AuthContext` provides user with `taliaUserId`, `role`, `name`
- [ ] Update components that use user data
- [ ] Test role-based access control

---

### Phase 5: Testing & Validation
**Goal**: Ensure everything works end-to-end

#### Step 5.1: Authentication Testing
- [ ] Test simple email/password login
- [ ] Test user creation (new user gets `talia_user_id`)
- [ ] Test existing user login (uses existing `talia_user_id`)
- [ ] Test session persistence
- [ ] Test logout

#### Step 5.2: Focus Management Testing
- [ ] Test loading focuses for different roles
- [ ] Test creating new focus (admin only)
- [ ] Test updating focus (admin only)
- [ ] Test deleting focus (admin only)
- [ ] Test favorite toggling
- [ ] Test custom layout saving

#### Step 5.3: User Management Testing
- [ ] Test user creation flow
- [ ] Test user role assignment
- [ ] Test user preferences
- [ ] Verify `talia_user_id` consistency

#### Step 5.4: Integration Testing
- [ ] Test full flow: Login → Load Focuses → Use Focus → Logout
- [ ] Test with multiple users
- [ ] Test role-based access
- [ ] Verify data persistence

---

## 🗄️ Database Schema Updates

### Required Migrations

#### 1. Add Role Column to talia_users
```sql
ALTER TABLE talia_users 
ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user' CHECK (role IN ('admin', 'manager', 'user', 'guest'));
```

#### 2. Add Name Column to talia_users
```sql
ALTER TABLE talia_users 
ADD COLUMN IF NOT EXISTS name TEXT;
```

#### 3. Create Indexes (if needed)
```sql
CREATE INDEX IF NOT EXISTS idx_talia_users_email ON talia_users(email);
CREATE INDEX IF NOT EXISTS idx_talia_users_role ON talia_users(role);
CREATE INDEX IF NOT EXISTS idx_focuses_assigned_roles ON focuses USING GIN(assigned_roles);
```

---

## 📁 File Changes Summary

### Files to Create
- `src/components/SimpleAuth.jsx` - Simple email/password auth component

### Files to Update
- `src/components/LandingPage.jsx` - Replace magic link with simple auth
- `src/contexts/SupabaseAuthContext.jsx` - Add password auth method
- `talia-server/src/index.ts` - Update GraphQL context to use Supabase auth
- `src/lib/db.js` - Remove stub (no longer needed)

### Files to Verify (No Changes Needed)
- `src/services/GraphQLFocusService.js` - ✅ Already uses GraphQL (correct)
- `src/services/FocusPreferencesService.js` - ✅ Already uses GraphQL (correct)
- `src/hooks/useTaliaFocusManagement.js` - ✅ Already uses GraphQL services (correct)
- `talia-server/src/api/resolvers.ts` - ✅ Already uses Supabase (correct)

### Files to Delete
- `instant.schema.ts`
- `instant.config.json`
- `instant.perms.ts`
- `src/services/CleanUserService.js` (or migrate to Supabase)

### Files to Review
- `src/components/admin/UserMappingTable.jsx` - Update to use Supabase
- Any components importing InstantDB or `db.js`

---

## 🔐 Development Authentication Strategy

### Simple Password Auth (Development Only)
For development/testing, we'll use a simple approach:

1. **Email-based login**: User enters email
2. **Simple password check**: For development, accept any password or specific dev password
3. **Auto-create users**: If user doesn't exist, create them automatically
4. **Role assignment**: Default to 'user', allow admin override via database

### Production Ready (Future)
- Keep Supabase password auth ready
- Can easily switch to SSO later (user IDs already preserved)
- Magic link option still available via `signInWithEmail`

---

## ✅ Success Criteria

1. ✅ No InstantDB dependencies remain
2. ✅ Simple email/password authentication works
3. ✅ User management fully in Supabase `talia_users` table
4. ✅ **GraphQL remains as data access layer** (UI → GraphQL → Supabase)
5. ✅ GraphQL resolvers query Supabase (not InstantDB)
6. ✅ `talia_user_id` preserved for all users
7. ✅ Role-based access control works
8. ✅ GraphQL context uses Supabase auth user
9. ✅ All existing functionality preserved
10. ✅ Ready for SSO integration (user IDs maintained)

---

## 🚀 Implementation Order

1. **Phase 1** - Simple Auth (enables testing)
2. **Phase 2** - Remove InstantDB (cleanup)
3. **Phase 3** - Verify GraphQL Resolvers Use Supabase (validation)
4. **Phase 4** - User Management Enhancement (add role/name columns)
5. **Phase 5** - Testing (validation)

**Note**: Focus management already uses GraphQL → Supabase (correct architecture, no changes needed)

---

## 📝 Notes

- **Architecture**: UI always uses GraphQL for data access. GraphQL is the middleware layer that queries Supabase (or other future data sources)
- **User ID Retention**: The `talia_user_id` (bigint) is preserved throughout migration, ensuring future SSO integration works seamlessly
- **Development Mode**: Simple password auth is for development only. Production can use password auth, magic links, or SSO
- **Backward Compatibility**: Existing users in `talia_users` table will continue to work
- **Focus Data**: Existing focus data in Supabase tables is preserved
- **GraphQL Context**: GraphQL server context should extract user from Supabase auth token, not use mock user
- **No Direct Supabase Queries**: UI components should never query Supabase directly - always use GraphQL

