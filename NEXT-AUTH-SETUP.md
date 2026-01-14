# Authentication Setup for taliahub.com - COMPLETE ✅

## Overview

Gateway-level authentication via ngrok basic auth has been configured for taliahub.com. This provides temporary protection during development and will be removed when SSO is implemented.

## Current Implementation

### 1. Gateway-Level Authentication (ngrok)

**Status**: ✅ Configured

**Location**: `~/.ngrok2/ngrok-taliahub.yml` (on MiniPC)

**Configuration**:
- **Username**: `talia`
- **Password**: `dev2025tal` (minimum 8 characters required by ngrok)
- **Type**: Basic HTTP Authentication
- **Scope**: All requests to `https://taliahub.com`

**Note**: This is temporary for development. Will be removed when SSO is implemented.

**To change credentials**:
```bash
ssh zomarc@192.168.1.120
nano ~/.ngrok2/ngrok-taliahub.yml
# Update basic_auth line: - "username:password"
sudo systemctl restart ngrok-taliahub
```

### 2. Application-Level Authentication (Supabase)

**Status**: ✅ Operational

**Flow**:
1. User passes ngrok basic auth (gateway level)
2. User sees Supabase login form
3. User signs in with email/password
4. System creates/updates `talia_users` record
5. User is authenticated and can access application

**User Mapping** (Critical for SSO):
- `talia_users.id` (UUID) → Maps to Supabase `auth.users.id` (will map to SSO provider)
- `talia_users.talia_user_id` (bigint) → Used by application logic
- `talia_users.email` (unique) → User identifier

### 3. Application Roles

**Status**: ✅ Managed In-Memory

**Roles Available**:
- `ADMIN` - Full system access
- `MANAGER` - Advanced features
- `USER` - Standard access
- `GUEST` - Read-only access

**How Roles Are Assigned**:
- Default: `USER`
- `admin@talia.dev` → `ADMIN` (hardcoded for development)
- Roles managed in-memory/application-level (not in database)

**Testing Different Roles**:
1. **Via Admin Panel**: Use `TaliaUserTable` component to view users
2. **Via Code**: Modify `SupabaseAuthContext.jsx` line ~112 to change role assignment logic
3. **Via Email**: Sign in as `admin@talia.dev` to get ADMIN role

**Role Management**:
- Roles are not persisted in database
- Managed via `TaliaUserService.js` (in-memory)
- Easy to test/change in development
- Will be preserved for future SSO integration

## User Mapping Structure

The `talia_users` table preserves the mapping structure needed for future SSO:

```sql
talia_users:
  - id (UUID) → FK to auth.users.id (will map to SSO provider)
  - talia_user_id (bigint, unique) → Application's primary identifier
  - email (text, unique) → User identifier
  - last_login_at (timestamp) → Last login tracking
```

**Why This Matters**:
- When SSO is implemented, `talia_users.id` will map to SSO provider's user identifier
- `talia_user_id` will continue to be used by all application logic
- No changes needed to application code when SSO is added

## Testing

### Test Gateway Auth
```bash
# Should prompt for username/password (401 without auth, 200 with auth)
curl -u talia:dev2025tal https://taliahub.com
```

### Test Application Auth
1. Access https://taliahub.com
2. Enter ngrok credentials: `talia` / `dev2025tal`
3. Enter Supabase credentials (email/password)
4. Verify user is created in `talia_users` table
5. Verify role is assigned correctly

### Test Role Changes
1. Sign in as different users
2. Check role assignment in browser console
3. Verify role-based UI access works correctly

## Future SSO Integration

When SSO is implemented:
1. ✅ Remove ngrok basic auth (gateway-level protection no longer needed)
2. ✅ SSO provider will authenticate users
3. ✅ `talia_users.id` will map to SSO provider's user identifier
4. ✅ `talia_user_id` continues to be used by application logic
5. ✅ Roles continue to be managed within Talia application

## Files Modified

1. ✅ `~/.ngrok2/ngrok-taliahub.yml` (MiniPC) - Added basic_auth
2. ✅ `talia-ui/src/contexts/SupabaseAuthContext.jsx` - Removed commented code
3. ✅ `talia-ui/src/graphql/queries.js` - Deleted (unused)
4. ✅ `talia-ui/src/lib/apolloClient.js` - Cleaned up
5. ✅ `talia-ui/src/services/TaliaUserService.js` - Removed role TODO

## Security Notes

- **Gateway Auth**: Temporary basic auth provides gateway-level protection
- **Application Auth**: Supabase auth provides user-specific authentication
- **User Mapping**: Preserved for future SSO integration
- **Roles**: Managed in-memory, easy to test in development

---

**Status**: ✅ Complete - Ready for development and testing
