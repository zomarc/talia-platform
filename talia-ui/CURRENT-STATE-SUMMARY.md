# Talia UI - Current State Summary

**Date:** January 3, 2025  
**Branch:** `feature/focus-management`  
**Status:** 🟡 Architecture Implemented, Ready for Testing

---

## 🎯 What We're Building

A **clean user mapping architecture** that separates authentication from business logic, making it easy to replace the auth system (InstantDB) in the future.

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     InstantDB (Temporary)                    │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Auth System: Authenticates users, provides authId   │   │
│  └──────────────────┬───────────────────────────────────┘   │
│                     │                                         │
│  ┌──────────────────▼───────────────────────────────────┐   │
│  │  userMappings Table (InstantDB storage)              │   │
│  │  • instantAuthId → taliaUserId mapping               │   │
│  │  • Email, createdAt                                  │   │
│  └──────────────────┬───────────────────────────────────┘   │
└────────────────────┼─────────────────────────────────────────┘
                     │
                     │ Mapping Layer (No Dependencies)
                     │
┌────────────────────▼─────────────────────────────────────────┐
│                   Talia Internal System                      │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Talia Users (In-Memory, will move to DB)            │   │
│  │  • taliaUserId: 1000, 1001, 1002...                  │   │
│  │  • Email, name, role, isActive                       │   │
│  └──────────────────┬───────────────────────────────────┘   │
│                     │                                         │
│  ┌──────────────────▼───────────────────────────────────┐   │
│  │  Talia Focuses (In-Memory, will move to DB)          │   │
│  │  • taliaFocusId: 100, 101, 102...                    │   │
│  │  • Name, description, componentLayout                │   │
│  │  • createdByTaliaUserId (uses Talia user IDs)        │   │
│  └──────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
```

---

## ✅ What's Implemented

### 1. **InstantDB Schema** (`instant.schema.ts`)
```typescript
{
  entities: {
    userMappings: {
      instantAuthId: string (unique, indexed)  // InstantDB auth ID
      taliaUserId: integer (unique, indexed)   // Talia internal ID
      email: string (indexed)                  // For reference
      createdAt: date
    }
  }
}
```

### 2. **Services Layer**

**`UserMappingService.js`**
- Creates mapping between InstantDB auth ID → Talia user ID
- Stores mapping in InstantDB `userMappings` table
- Uses `db.id()` for UUID entity keys (InstantDB requirement)
- Generates sequential Talia user IDs (1000, 1001, 1002...)

**`TaliaUserService.js`**
- Manages Talia internal user system (in-memory)
- Handles user roles: admin, manager, user, guest
- No dependency on InstantDB
- First user auto-assigned admin role

**`TaliaFocusService.js`**
- Manages Talia focus layouts (in-memory)
- Uses Talia user IDs (not InstantDB IDs)
- Provides standard focuses based on user role

### 3. **React Hook** (`useTaliaFocusManagement.js`)
- Integrates all services
- When user signs in:
  1. Gets InstantDB auth ID from `useAuth()`
  2. Creates/retrieves mapping via `UserMappingService`
  3. Creates/retrieves Talia user via `TaliaUserService`
  4. Loads focuses via `TaliaFocusService`
- All business logic uses Talia user IDs only

### 4. **Admin Components**

**`AdminDashboard.jsx`**
- Main admin interface with tabs
- Only accessible to admin role

**`UserMappingTable.jsx`**
- Displays InstantDB → Talia mapping
- Queries `userMappings` table from InstantDB
- Shows the separation visually

**`TaliaUserTable.jsx`**
- Displays Talia internal users
- Edit user roles
- Shows business logic uses Talia IDs

---

## 🔄 Current Flow

### User Sign-In Flow
```
1. User clicks "Sign in with email"
   ↓
2. InstantDB authenticates → returns instantAuthId
   ↓
3. UserMappingService.getOrCreateMapping(instantAuthId, email)
   ↓
4. If new user:
   - Generates taliaUserId: 1000
   - Creates mapping in InstantDB
   - Console: "✅ Created mapping: InstantDB xxx → Talia User 1000"
   ↓
5. TaliaUserService.createTaliaUser(taliaUserId, email, role)
   - First user gets role: 'admin'
   - Console: "✅ Created Talia user: 1000 (email) with role: admin"
   ↓
6. Business logic uses taliaUserId from here on
```

---

## 🚧 What's NOT Done Yet

### 1. **Schema Not Pushed to InstantDB**
- Schema defined in `instant.schema.ts`
- **Not yet pushed to InstantDB**
- Will auto-create on first write OR
- Can be pushed via InstantDB CLI/Dashboard

### 2. **Admin Dashboard Not Integrated**
- Components created but not added to main navigation
- Need to add route/panel to access it

### 3. **No Proper Querying**
- Currently always creates new mapping (no lookup)
- Need to implement InstantDB queries to check existing mappings
- Services have TODO comments for this

### 4. **In-Memory Storage**
- Talia users stored in memory (Map)
- Talia focuses stored in memory (hardcoded)
- Will be lost on page refresh
- Need to move to proper database later

---

## 🧪 How to Test

### Start Dev Server
```bash
cd /Users/russell/Work/AA-Celestyal/Dev/talia-ui
npm run dev
# Currently running on: http://localhost:5174/
```

### Testing Steps
1. **Open main app:** http://localhost:5174/
2. **Sign in with email** (use any email)
3. **Check browser console** for:
   - `✅ Created mapping: InstantDB xxx → Talia User 1000`
   - `✅ Created Talia user: 1000 (email) with role: admin`
4. **Open InstantDB dashboard:**  
   https://instantdb.com/dash?app=1c2b040a-7bb2-4eb5-8490-ce5832e19dd0
5. **Check for `userMappings` table** (should be created on first sign-in)
6. **Verify mapping entry** shows your instantAuthId → taliaUserId

---

## 📋 Next Steps

### Immediate (To See It Working)
1. ✅ **Test sign-in flow** - Create first user mapping
2. ✅ **Verify InstantDB table** - Check `userMappings` created
3. ✅ **Check console logs** - Confirm mapping and user creation

### Short-Term (To Make It Functional)
1. 🔲 **Implement proper querying**
   - Use InstantDB `useQuery()` to check existing mappings
   - Don't create duplicate mappings
2. 🔲 **Integrate admin dashboard**
   - Add to main navigation/sidebar
   - Create route to access it
3. 🔲 **Test with multiple users**
   - Verify sequential Talia user IDs (1000, 1001, 1002...)
   - Test role assignments

### Medium-Term (To Make It Complete)
1. 🔲 **Move Talia data to proper storage**
   - Store Talia users in database (not InstantDB)
   - Store Talia focuses in database
2. 🔲 **Implement focus management**
   - Create/edit/delete focuses
   - Assign focuses to roles
3. 🔲 **User preferences**
   - Save default focus per user
   - Save favorite focuses

### Long-Term (Future Architecture)
1. 🔲 **Replace InstantDB**
   - Switch to different auth system
   - Only need to update `UserMappingService`
   - All business logic remains unchanged
2. 🔲 **Move to GraphQL backend**
   - Talia users via GraphQL
   - Talia focuses via GraphQL
   - Keep mapping in auth system

---

## 🎯 Key Benefits of This Architecture

✅ **Clean Separation**
- Auth system (InstantDB) completely separate from business logic
- Can replace InstantDB without touching business logic

✅ **Simple Mapping**
- One table: `userMappings`
- One purpose: Map auth ID → Talia user ID

✅ **Numerical IDs**
- Talia uses simple numerical IDs (1000+)
- Easy to work with, easy to understand

✅ **No Dependencies**
- Business logic never uses InstantDB auth IDs
- Always uses Talia user IDs

✅ **Easy to Replace**
- Change auth system: Update `UserMappingService` only
- Change database: Update storage layer only
- Business logic unchanged

---

## 📝 Key Files

### Schema & Config
- `instant.schema.ts` - InstantDB schema definition
- `instant.config.json` - InstantDB app configuration
- `PUSH-SCHEMA.md` - Instructions for pushing schema

### Services
- `src/services/UserMappingService.js` - Auth → Talia mapping
- `src/services/TaliaUserService.js` - Talia user management
- `src/services/TaliaFocusService.js` - Talia focus management

### React Integration
- `src/hooks/useTaliaFocusManagement.js` - Main React hook
- `src/contexts/AuthContext.jsx` - InstantDB auth context

### Admin UI
- `src/components/admin/AdminDashboard.jsx` - Admin interface
- `src/components/admin/UserMappingTable.jsx` - Mapping visualization
- `src/components/admin/TaliaUserTable.jsx` - User management

### Documentation
- `CURRENT-STATE-SUMMARY.md` - This file
- `CONTEXT_STATEMENT.md` - Project overview
- `FOCUS-MANAGEMENT-PLAN.md` - Focus system plan

---

## 🐛 Known Issues

1. **No proper querying** - Always creates new mapping (TODO)
2. **Admin dashboard not accessible** - Not integrated in UI
3. **In-memory storage** - Data lost on refresh
4. **Schema not pushed** - Will auto-create or needs manual push

---

## ✨ Status: Ready for First Test

The architecture is implemented and ready for testing. Start the dev server, sign in, and watch the console logs to see the mapping creation in action!

**Dev Server:** http://localhost:5174/  
**InstantDB Dashboard:** https://instantdb.com/dash?app=1c2b040a-7bb2-4eb5-8490-ce5832e19dd0
