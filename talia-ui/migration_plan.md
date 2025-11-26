# Talia UI and Server Migration Plan

## Summary of UI Migration (Completed)

The `talia-ui` application has been successfully migrated from InstantDB to a new architecture using Supabase and GraphQL.

- **Authentication:** Migrated from InstantDB to Supabase for user authentication (magic link sign-in).
- **Focus Management:** Refactored the focus management system to use a new `GraphQLFocusService`. This service will communicate with the `talia-server` via GraphQL to fetch and manage focus layouts.
- **Code Cleanup:** Removed all old InstantDB-related files, hooks, services, and dependencies. The `.gitignore` file has also been updated.

## Next Steps: Backend Implementation in `talia-server`

The next phase is to implement the backend for the focus management system in the `talia-server` project.

### Step 1: Define Supabase Table Schema

Create a `focuses` table in your Supabase database with the following schema. This will store the focus layouts.

```sql
CREATE TABLE focuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  type TEXT,
  is_standard BOOLEAN DEFAULT FALSE,
  assigned_roles TEXT[] NOT NULL,
  is_default BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_by UUID REFERENCES auth.users(id),
  layout_data JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Optional: Add a GIN index for faster searching on assigned_roles
CREATE INDEX idx_focuses_assigned_roles ON focuses USING GIN (assigned_roles);

-- RLS Policies
ALTER TABLE focuses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow users to view focuses assigned to their role"
ON focuses FOR SELECT
USING (
  (get_my_claim('role')::text = ANY(assigned_roles)) OR
  (get_my_claim('role')::text = 'admin')
);

CREATE POLICY "Allow admins to create focuses"
ON focuses FOR INSERT
WITH CHECK (get_my_claim('role')::text = 'admin');

CREATE POLICY "Allow admins to update focuses"
ON focuses FOR UPDATE
USING (get_my_claim('role')::text = 'admin');

CREATE POLICY "Allow admins to delete focuses"
ON focuses FOR DELETE
USING (get_my_claim('role')::text = 'admin');
```

### Step 2: Define GraphQL Schema

In your `talia-server` project, locate your GraphQL schema file (likely `src/api/schema.ts`) and add the following type definitions:

```graphql
type Focus {
  id: ID!
  name: String!
  description: String
  type: String
  isStandard: Boolean
  assignedRoles: [String!]!
  isDefault: Boolean
  isActive: Boolean
  createdBy: ID
  layoutData: JSON
  createdAt: String
  updatedAt: String
}

input FocusInput {
  name: String!
  description: String
  type: String
  isStandard: Boolean
  assignedRoles: [String!]!
  isDefault: Boolean
  isActive: Boolean
  layoutData: JSON
}

type Query {
  focusesByRole(role: String!): [Focus!]!
}

type Mutation {
  createFocus(focusData: FocusInput!): Focus
  updateFocus(focusId: ID!, updateData: FocusInput!): Focus
  deleteFocus(focusId: ID!): Boolean
}
```

### Step 3: Implement GraphQL Resolvers

In your `talia-server` project, locate your GraphQL resolvers file (likely `src/api/resolvers.ts`) and implement the logic for the queries and mutations defined above. These resolvers will interact with your Supabase database to perform the necessary CRUD operations on the `focuses` table.

When you start the new session, I will be ready to help you with the implementation of these resolvers.
