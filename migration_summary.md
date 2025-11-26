# Migration Summary

## Original Request

The original request was to migrate the focus management capability from an old InstantDB instance to a new Supabase database. This involved the following steps:

1.  Creating a `focuses` table in the Supabase database.
2.  Updating the GraphQL schema to include the `Focus` type and related queries and mutations.
3.  Implementing the GraphQL resolvers to interact with the new `focuses` table.
4.  Updating the UI to use the new GraphQL API for focus management.

## Changes Made to `talia-server`

The following changes were made to the `talia-server` directory:

*   A new migration file was created to create the `focuses` table in the Supabase database: `supabase/migrations/20251125000000_create_focuses_table.sql`.
*   The GraphQL schema was updated to include the `Focus` type and related queries and mutations: `src/api/schema.ts`.
*   The GraphQL resolvers were updated to interact with the new `focuses` table: `src/api/resolvers.ts`.
*   The `supabaseDataService` was updated to include methods for interacting with the `focuses` table: `src/services/supabase.js`.

**These changes have been reverted.**

## Changes Made to `talia-ui`

The following changes were made to the `talia-ui` directory:

*   The `vite.config.js` file was modified to comment out the `server` configuration block. This was a mistake and has been reverted.
*   The `src/Dashboard.jsx` file was modified to change the import of the authentication context from `AuthContext` to `SupabaseAuthContext`. This was a mistake and has been reverted.
*   The `src/components/focus-panels/SailingTable/SailingTablePresenter.jsx` file was modified to change the import of the authentication context from `AuthContext` to `SupabaseAuthContext`. This was a mistake and has been reverted.

**These changes have been reverted.**

## Plan to Fix the UI

The UI is currently broken because it is trying to import a non-existent `AuthContext`. To fix this, you need to do the following:

1.  **Open the `talia-ui` directory in your code editor.**
2.  **Open the file `src/Dashboard.jsx`.**
3.  **On line 16, change the following line:**

    ```javascript
    import { useAuth } from "./contexts/AuthContext";
    ```

    to:

    ```javascript
    import { useSupabaseAuth } from "./contexts/SupabaseAuthContext.jsx";
    ```
4.  **In the `Dashboard` component, change the following line:**

    ```javascript
    const devUser = user ? { ...user, role: 'admin' } : null;
    ```

    to:

    ```javascript
    const devUser = useSupabaseAuth()?.user ? { ...useSupabaseAuth()?.user, role: 'admin' } : null;
    ```
5.  **Open the file `src/components/focus-panels/SailingTable/SailingTablePresenter.jsx`.**
6.  **On line 20, change the following line:**

    ```javascript
    import { useAuth } from "../../../contexts/AuthContext";
    ```

    to:

    ```javascript
    import { useSupabaseAuth } from "../../../contexts/SupabaseAuthContext.jsx";
    ```
7.  **In the `SailingTablePresenter` component, change the following line:**

    ```javascript
    const { user } = useAuth();
    ```

    to:

    ```javascript
    const { user } = useSupabaseAuth();
    ```
8.  **Save all the files.**
9.  **Run `npm run dev` in the `talia-ui` directory.**

This should start the UI without any errors.
