# Push Schema to InstantDB

## Current Schema

The schema is defined in `instant.schema.ts`:

```typescript
{
  entities: {
    userMappings: {
      instantAuthId: string (unique, indexed)
      taliaUserId: integer (unique, indexed)
      email: string (indexed)
      createdAt: date
    }
  }
}
```

## How to Push Schema

### Option 1: Use InstantDB CLI (Interactive)

```bash
cd /Users/russell/Work/AA-Celestyal/Dev/talia-ui
npx instant-cli init
# Select: Import an existing app
# Select: Talia (1c2b040a-7bb2-4eb5-8490-ce5832e19dd0)

# Then push the schema
npx instant-cli push schema
```

### Option 2: Use InstantDB Dashboard (Web)

1. Go to: https://instantdb.com/dash
2. Select app: **Talia** (`1c2b040a-7bb2-4eb5-8490-ce5832e19dd0`)
3. Go to **Schema** tab
4. Copy the schema from `instant.schema.ts`
5. Paste and apply

### Option 3: Auto-create on First Write

The schema will be created automatically when we first write data using `db.transact()`:

```javascript
const entityId = db.id();
await db.transact([
  db.tx.userMappings[entityId].update({
    instantAuthId: "...",
    taliaUserId: 1000,
    email: "user@example.com",
    createdAt: new Date()
  })
]);
```

## Recommended Approach

For development, **Option 3** is easiest - just start using the schema and InstantDB will create the tables automatically on first write.

For production, use **Option 1** or **Option 2** to explicitly define and version the schema.
