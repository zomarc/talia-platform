# InstantDB Migration Summary

## 🔍 Current Situation

**Problem**: InstantDB React client (`@instantdb/react`) doesn't support backend queries in Node.js:
- `queryOnce()` fails with: "We can't run `queryOnce` on the backend. Use adminAPI.query instead"
- `adminAPI` is undefined in Node.js (only available in browser contexts)
- InstantDB CLI doesn't support data export/query commands

**Your Data**: You mentioned InstantDB had:
- Multiple focus definitions
- Multiple users
- Was working until an hour ago

## ✅ Options to Migrate Data

### Option 1: Browser-Based Migration (Recommended)
I've created a browser-based migration tool:
- **File**: `talia-ui/scripts/migrate-instantdb-browser.html`
- **How to use**:
  1. Open the HTML file in your browser
  2. Click "Start Migration"
  3. It will query InstantDB using the browser client (which supports `queryOnce`)
  4. Data will be migrated to Supabase

**To run**:
```bash
cd talia-ui
# Open in browser:
open scripts/migrate-instantdb-browser.html
# Or serve it:
python3 -m http.server 8080
# Then open: http://localhost:8080/scripts/migrate-instantdb-browser.html
```

### Option 2: Manual Export from InstantDB Dashboard
1. Go to https://instantdb.com/dash
2. Sign in and select your app
3. Navigate to each entity type (taliaUser, focus, userFocusPreference)
4. Export data as JSON
5. Use the manual migration guide: `docs/INSTANTDB-MANUAL-MIGRATION.md`

### Option 3: Recreate Data in Supabase
Since you're in development:
- Focus definitions can be recreated via GraphQL
- Users will be auto-created on first Supabase sign-in
- Preferences will be recreated as users interact with focuses

## 🎯 Recommendation

**Since you're in development and the data can be recreated**, I recommend:

1. **Try the browser-based migration tool first** (Option 1) - it's the easiest
2. **If that doesn't work**, proceed with recreating the data in Supabase
3. **Remove InstantDB dependencies** once migration is complete or data is recreated

The application is already set up to work with Supabase, so you can continue development even if migration isn't perfect.

## 📝 Next Steps

1. Try the browser migration tool
2. If successful, verify data in Supabase
3. If not, recreate focus definitions manually
4. Proceed with removing InstantDB dependencies

Would you like me to help you run the browser migration tool, or proceed with recreating the data?

