# Testing the New Components

## Quick Test in Browser

I've created a dedicated **TestPage** component that you can access to test the new architecture components in isolation.

### Option 1: Add Test Route (Recommended)

Add the test page to your routing. Modify `main.jsx` or `App.jsx` to include the test page:

```javascript
// In your main routing file, add:
import TestPage from './components/TestPage';

// Add route
<Route path="/test" element={<TestPage />} />
```

Then access at: **http://localhost:5173/test**

### Option 2: Quick Standalone File

I've created `src/components/TestPage.jsx` which you can render directly. To test immediately:

```javascript
// Temporarily modify main.jsx
import TestPage from './components/TestPage';

reactRoot.render(
  <StrictMode>
    <TestPage />
  </StrictMode>
);
```

Then restart your dev server and visit: **http://localhost:5173**

### Option 3: Add to Dashboard as a Panel

You can also add the new component as a panel in your Dashboard:

```javascript
// In Dashboard.jsx
import SailingTableContainer from './components/focus-panels/SailingTable';

// In your panel creation code:
api.addPanel({
  id: 'test-sailing-table',
  component: 'sailing-table-test',
  title: 'New Sailing Table'
});
```

## What You'll See in Test Page

The TestPage demonstrates:

1. **LoadingSpinner** - Shows while data loads
2. **ErrorMessage** - Shows if errors occur with retry button
3. **SailingTableContainer** - The new refactored table
4. **Filter Controls** - Test filtering
5. **Raw Data Display** - Debug view of fetched data

## Features You Can Test

### 1. Data Fetching
- Automatic loading state
- Error handling with retry
- Empty state handling

### 2. Filtering
- Sail code filter
- Ship name filter
- Real-time updates

### 3. Component Behavior
- Refresh functionality
- Loading states
- Error recovery
- Data updates

## Console Logging

Open browser DevTools to see:
- Data fetching logs
- Component lifecycle logs
- Error messages (if any)

## Expected Behavior

### On Page Load:
1. ✅ LoadingSpinner appears
2. ✅ Data fetches from Supabase
3. ✅ LoadingSpinner disappears
4. ✅ SailingTableContainer renders with data

### On Filter Apply:
1. ✅ LoadingSpinner appears briefly
2. ✅ Data refreshes with filters
3. ✅ Table updates with filtered data

### On Error:
1. ✅ ErrorMessage displays
2. ✅ Error details shown
3. ✅ Retry button available
4. ✅ Retry fetches data again

## Troubleshooting

### "Cannot find module" errors
- Make sure all files are saved
- Restart the dev server

### "Loading..." forever
- Check that Supabase is running on localhost:54321
- Check browser console for errors
- Verify network tab shows requests

### Empty table
- Check that `master_sail` table has data
- Verify filters aren't too restrictive
- Check browser console for errors

## Next Steps After Testing

1. Compare with `SimpleTable.jsx` (the old version)
2. Notice the code organization improvements
3. Try refactoring another component using these patterns
4. Consider adding more tests

## Development Tips

### Hot Reload Testing
The components support hot reload, so:
- Changes to components update instantly
- No need to refresh browser
- Console errors appear immediately

### Debugging
```javascript
// Add in your components
console.log('[Component] Data:', data);
console.log('[Component] Loading:', loading);
console.log('[Component] Error:', error);
```

### Performance Monitoring
Open DevTools > Performance tab to monitor:
- Data fetch times
- Re-render counts
- Memory usage

## Examples

### Testing Individual Hook
```javascript
import { useSailingData } from './hooks/data/useSailingData';

function TestHook() {
  const { data, loading, error } = useSailingData();
  
  return (
    <div>
      {loading && <p>Loading...</p>}
      {error && <p>Error: {error.message}</p>}
      {data && <p>Records: {data.length}</p>}
    </div>
  );
}
```

### Testing Service Directly
```javascript
import sailingsService from './services/data/sailingsService';

// In browser console or test
const data = await sailingsService.fetch({ limit: 10 });
console.log('Fetched:', data);
```

