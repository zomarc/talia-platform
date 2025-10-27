# InstantDB React API - Official Reference (v0.21.26)

## 📦 **Package Information**
- **Package**: `@instantdb/react@0.21.26`
- **Status**: ✅ **Current Stable Version**
- **Last Updated**: December 2024
- **Documentation**: https://instantdb.com/docs

## 🔧 **Installation & Setup**

```bash
npm install @instantdb/react@0.21.26
```

```javascript
import { init } from '@instantdb/react';

const db = init({
  appId: 'your-app-id-here'
});
```

## 🔐 **Authentication API**

### **Magic Code Authentication (Recommended)**
```javascript
// Send magic code to user's email
await db.auth.sendMagicCode({ 
  email: 'user@example.com' 
});

// Verify the magic code
await db.auth.signInWithMagicCode({ 
  email: 'user@example.com', 
  code: '123456' 
});
```

### **Token Authentication**
```javascript
// Sign in with a token
await db.auth.signInWithToken({ 
  token: 'your-token-here' 
});
```

### **OAuth Authentication**
```javascript
// Create OAuth authorization URL
const authUrl = await db.auth.createAuthorizationURL({ 
  provider: 'google' 
});

// Exchange OAuth code for session
await db.auth.exchangeOAuthCode({ 
  code: 'oauth-code-here' 
});

// Sign in with ID token (Google, etc.)
await db.auth.signInWithIdToken({
  clientName: 'your-client-name',
  idToken: 'id-token-here',
  nonce: 'your-nonce'
});
```

### **Sign Out**
```javascript
await db.auth.signOut();
```

## 📊 **Database API**

### **Reactive Queries (useQuery)**
```javascript
// For reactive data that updates in real-time
const { data, loading, error } = db.useQuery({
  users: { $: { where: { id: 'user-123' } } }
});

// Multiple collections
const { data, loading, error } = db.useQuery({
  users: {},
  posts: { $: { where: { userId: 'user-123' } } }
});
```

### **One-time Queries (queryOnce)**
```javascript
// For single requests that don't need real-time updates
const { data, error } = await db.queryOnce({
  users: { $: { where: { id: 'user-123' } } }
});

// Multiple collections
const { data, error } = await db.queryOnce({
  users: {},
  posts: { $: { where: { userId: 'user-123' } } }
});
```

### **Transactions**
```javascript
// Single operation
await db.transact([
  db.tx.users[userId].update({ name: 'New Name' })
]);

// Multiple operations
await db.transact([
  db.tx.users[userId].update({ name: 'New Name' }),
  db.tx.posts[postId].update({ title: 'New Title' })
]);

// Create new records
await db.transact([
  db.tx.users[newUserId].update({
    id: newUserId,
    name: 'John Doe',
    email: 'john@example.com'
  })
]);
```

## 🎣 **React Hooks**

### **Authentication Hooks**
```javascript
// Get authentication state
const { isLoading, user, error } = db.useAuth();

// Get current user data
const user = db.useUser();

// Get connection status
const { isOnline, isConnected } = db.useConnectionStatus();
```

### **Data Hooks**
```javascript
// Reactive query hook
const { data, loading, error } = db.useQuery({
  collection: { $: { where: { condition: 'value' } } }
});

// Local ID generation
const localId = db.useLocalId();
```

## 🏗️ **Schema Definition**

### **Basic Schema (instant.schema.ts)**
```typescript
import { i } from '@instantdb/react';

const schema = i.schema({
  entities: {
    users: i.entity({
      email: i.string().unique().indexed(),
      name: i.string(),
      role: i.string().indexed(),
      createdAt: i.date(),
      isActive: i.boolean().default(true)
    }),
    posts: i.entity({
      title: i.string(),
      content: i.string(),
      userId: i.string().indexed(),
      createdAt: i.date()
    })
  },
  links: {
    userPosts: {
      forward: {
        on: "posts",
        has: "one",
        label: "user",
        onDelete: "cascade"
      },
      reverse: {
        on: "users",
        has: "many",
        label: "posts"
      }
    }
  }
});

export default schema;
```

### **Field Types**
```typescript
// String fields
name: i.string()
email: i.string().unique().indexed()

// Number fields
age: i.number()
price: i.number().indexed()

// Boolean fields
isActive: i.boolean()
isPublished: i.boolean().default(false)

// Date fields
createdAt: i.date()
updatedAt: i.date()

// JSON fields
preferences: i.json()
metadata: i.json()

// Array fields
tags: i.array(i.string())
categories: i.array(i.string())
```

## 🔒 **Permissions (instant.perms.ts)**

```typescript
import type { InstantRules } from '@instantdb/react';

const rules: InstantRules = {
  users: {
    allow: {
      view: 'auth.id != null && (auth.id == data.id || data.isActive == true)',
      create: 'auth.id != null',
      update: 'auth.id == data.id',
      delete: 'auth.id == data.id'
    }
  },
  posts: {
    allow: {
      view: 'auth.id != null',
      create: 'auth.id != null && auth.id == data.userId',
      update: 'auth.id == data.userId',
      delete: 'auth.id == data.userId'
    }
  }
};

export default rules;
```

## 🚀 **Deployment Commands**

```bash
# Push schema to InstantDB
npx instant-cli@latest push schema

# Push permissions to InstantDB
npx instant-cli@latest push perms

# Check deployment status
npx instant-cli@latest status
```

## 🎯 **Best Practices**

### **1. Use useQuery for Reactive Data**
```javascript
// ✅ Good - for data that changes frequently
const { data, loading, error } = db.useQuery({
  messages: { $: { where: { roomId: currentRoom } } }
});
```

### **2. Use queryOnce for One-time Requests**
```javascript
// ✅ Good - for data that doesn't change often
const { data } = await db.queryOnce({
  user: { $: { where: { id: userId } } }
});
```

### **3. Handle Loading and Error States**
```javascript
const { data, loading, error } = db.useQuery({
  users: {}
});

if (loading) return <div>Loading...</div>;
if (error) return <div>Error: {error.message}</div>;
if (!data.users) return <div>No users found</div>;

return (
  <div>
    {data.users.map(user => (
      <div key={user.id}>{user.name}</div>
    ))}
  </div>
);
```

### **4. Use Transactions for Multiple Operations**
```javascript
// ✅ Good - atomic operations
await db.transact([
  db.tx.users[userId].update({ lastLogin: new Date() }),
  db.tx.sessions[sessionId].update({ isActive: true })
]);
```

## 🐛 **Common Issues & Solutions**

### **Issue: "db.query is not a function"**
**Solution**: Use `db.queryOnce()` for one-time queries or `db.useQuery()` for reactive queries.

### **Issue: "sendMagicCode is not a function"**
**Solution**: Ensure you're using the correct method name: `db.auth.sendMagicCode()`.

### **Issue: Authentication not working**
**Solution**: Check your app ID and ensure the schema/permissions are deployed.

### **Issue: Data not updating in real-time**
**Solution**: Use `db.useQuery()` instead of `db.queryOnce()` for reactive data.

## 📚 **Resources**

- **Official Docs**: https://instantdb.com/docs
- **React Guide**: https://instantdb.com/docs/react
- **Authentication**: https://instantdb.com/docs/auth
- **Schema Reference**: https://instantdb.com/docs/schema
- **Permissions**: https://instantdb.com/docs/permissions
- **GitHub**: https://github.com/instantdb/instant

---

**Version**: 0.21.26  
**Last Updated**: December 2024  
**Status**: ✅ **Current and Stable**
