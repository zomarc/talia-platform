# InstantDB API Reference for Talia UI

## 📦 **Current Version**
- **Installed**: `@instantdb/react@0.21.26`
- **Expected**: `0.21.26`
- **Last Updated**: December 2024

## 🔧 **Configuration**

### **Project ID**
```javascript
const INSTANTDB_CONFIG = {
  appId: '1c2b040a-7bb2-4eb5-8490-ce5832e19dd0',
  expectedVersion: '0.21.26',
  requiredMethods: ['sendMagicCode', 'signInWithMagicCode', 'signOut'],
  documentationUrl: 'https://instantdb.com/docs/auth'
};
```

## 🔐 **Authentication API**

### **Available Methods**
```javascript
// Magic Code Authentication
db.auth.sendMagicCode({ email: 'user@example.com' })
db.auth.signInWithMagicCode({ email: 'user@example.com', code: '123456' })

// Token Authentication
db.auth.signInWithToken({ token: 'your-token' })

// OAuth (if configured)
db.auth.createAuthorizationURL({ provider: 'google' })
db.auth.exchangeOAuthCode({ code: 'oauth-code' })

// Sign Out
db.auth.signOut()
```

### **React Hooks**
```javascript
// Authentication state
const { isLoading, user, error } = db.useAuth()

// User data
const user = db.useUser()

// Connection status
const { isOnline, isConnected } = db.useConnectionStatus()
```

## 📊 **Database API**

### **Querying Data**
```javascript
// React hook for queries (for reactive data)
const { data, loading, error } = db.useQuery({
  users: { $: { where: { id: 'user-123' } } }
})

// One-time query (for single requests)
const result = await db.queryOnce({
  users: { $: { where: { id: 'user-123' } } }
})

// Note: db.query() does not exist - use db.queryOnce() for one-time queries
```

### **Transactions**
```javascript
// Single transaction
await db.transact([
  db.tx.users[userId].update({ name: 'New Name' })
])

// Multiple operations
await db.transact([
  db.tx.users[userId].update({ name: 'New Name' }),
  db.tx.layouts[layoutId].update({ name: 'Updated Layout' })
])
```

## 🏗️ **Schema Definition**

### **Current Schema (instant.schema.ts)**
```typescript
const schema = i.schema({
  entities: {
    users: i.entity({
      email: i.string().unique().indexed(),
      name: i.string(),
      role: i.string().indexed(),
      preferences: i.json(),
      createdAt: i.date(),
      lastLogin: i.date(),
      isActive: i.boolean().default(true)
    }),
    roles: i.entity({
      name: i.string().unique().indexed(),
      displayName: i.string(),
      permissions: i.json(),
      description: i.string(),
      createdAt: i.date()
    }),
    layouts: i.entity({
      userId: i.string().indexed(),
      focusId: i.string().indexed(),
      name: i.string(),
      layout: i.json(),
      isDefault: i.boolean().default(false),
      isShared: i.boolean().default(false),
      createdAt: i.date(),
      updatedAt: i.date()
    }),
    sessions: i.entity({
      userId: i.string().indexed(),
      token: i.string().unique().indexed(),
      expiresAt: i.date(),
      createdAt: i.date(),
      lastActivity: i.date()
    })
  },
  links: {
    userLayouts: {
      forward: { on: "layouts", has: "one", label: "user", onDelete: "cascade" },
      reverse: { on: "users", has: "many", label: "layouts" }
    },
    userSessions: {
      forward: { on: "sessions", has: "one", label: "user", onDelete: "cascade" },
      reverse: { on: "users", has: "many", label: "sessions" }
    }
  }
});
```

## 🔒 **Permissions (instant.perms.ts)**

### **Current Rules**
```typescript
const rules: InstantRules = {
  users: {
    allow: {
      view: 'auth.id != null && (auth.id == data.id || data.isActive == true)',
      create: 'auth.id != null',
      update: 'auth.id == data.id || (auth.id != null && data.role == "admin")',
      delete: 'auth.id == data.id || (auth.id != null && data.role == "admin")'
    }
  },
  roles: {
    allow: {
      view: 'auth.id != null',
      create: 'auth.id != null && data.role == "admin"',
      update: 'auth.id != null && data.role == "admin"',
      delete: 'auth.id != null && data.role == "admin"'
    }
  },
  layouts: {
    allow: {
      view: 'auth.id != null && (auth.id == data.userId || data.isShared == true)',
      create: 'auth.id != null && auth.id == data.userId',
      update: 'auth.id != null && auth.id == data.userId',
      delete: 'auth.id != null && auth.id == data.userId'
    }
  },
  sessions: {
    allow: {
      view: 'auth.id != null && auth.id == data.userId',
      create: 'auth.id != null && auth.id == data.userId',
      update: 'auth.id != null && auth.id == data.userId',
      delete: 'auth.id != null && auth.id == data.userId'
    }
  }
};
```

## 🚀 **Deployment Commands**

### **Push Schema**
```bash
npx instant-cli@latest push schema
```

### **Push Permissions**
```bash
npx instant-cli@latest push perms
```

### **Check Status**
```bash
npx instant-cli@latest status
```

## 🔍 **Validation & Debugging**

### **API Validation**
The app includes comprehensive validation:

1. **Version Check**: Compares installed vs expected version
2. **Method Validation**: Ensures required methods exist
3. **Runtime Checks**: Validates API before each call
4. **Error Logging**: Detailed error messages with solutions

### **Console Logs**
Look for these logs in the browser console:

```
🔧 Initializing InstantDB...
📦 Project ID: 1c2b040a-7bb2-4eb5-8490-ce5832e19dd0
📦 InstantDB version check:
   Installed: 0.21.26
   Expected:  0.21.26
✅ Version matches expected version
✅ InstantDB initialized successfully
🔐 Available auth methods: ['sendMagicCode', 'signInWithMagicCode', 'signOut', ...]
📚 Documentation: https://instantdb.com/docs/auth
```

## 🐛 **Troubleshooting**

### **Common Issues**

1. **"sendMagicCode is not a function"**
   - **Cause**: Wrong InstantDB version or API change
   - **Solution**: Check version and update if needed

2. **"InstantDB auth not available"**
   - **Cause**: InstantDB not properly initialized
   - **Solution**: Check project ID and network connection

3. **"Missing required auth methods"**
   - **Cause**: API has changed or version mismatch
   - **Solution**: Update to correct version or check documentation

### **Version Updates**

When InstantDB updates:

1. **Update package**: `npm install @instantdb/react@latest`
2. **Check new version**: `npm list @instantdb/react`
3. **Update config**: Change `expectedVersion` in `src/lib/db.js`
4. **Test API**: Verify all methods still work
5. **Update docs**: Update this reference file

## 📚 **Resources**

- **Official Docs**: https://instantdb.com/docs
- **Auth Guide**: https://instantdb.com/docs/auth
- **React Guide**: https://instantdb.com/docs/react
- **API Reference**: https://instantdb.com/docs/api
- **Upstream**: InstantDB product documentation and SDK references

## 🔄 **Migration Notes**

### **From Previous Versions**
- `db.auth.signIn()` → `db.auth.sendMagicCode()`
- `db.auth.verifyCode()` → `db.auth.signInWithMagicCode()`
- Authentication flow remains the same
- React hooks unchanged

### **Breaking Changes**
- Method names changed in v0.21.x
- Some OAuth methods added
- Enhanced error handling
- Better TypeScript support

---

**Last Updated**: December 2024  
**Maintained By**: Talia UI Development Team  
**Status**: ✅ **Current and Validated**
