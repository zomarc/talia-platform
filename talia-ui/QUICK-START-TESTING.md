# 🚀 Quick Start: Testing New Components

## Easiest Way to Test

### Step 1: Uncomment TestPage in main.jsx

Open `talia-ui/src/main.jsx` and uncomment these lines:

```javascript
// LINE 6: Uncomment this
import TestPage from './components/TestPage.jsx'

// LINES 25-29: Uncomment this block
reactRoot.render(
  <StrictMode>
    <TestPage />
  </StrictMode>
);

// LINES 32-36: Comment out or remove this block
// reactRoot.render(
//   <StrictMode>
//     <AppWithAuth />
//   </StrictMode>
// );
```

### Step 2: Start Dev Server

```bash
cd talia-ui
npm run dev
```

### Step 3: Open in Browser

Visit: **http://localhost:5173**

You should see the TestPage with:
- ✨ Filter controls
- 📊 SailingTable component
- 🔄 Loading states
- ⚠️ Error handling
- 📝 Raw data display

## What You'll See

The TestPage demonstrates:
- **LoadingSpinner** when data is loading
- **ErrorMessage** if errors occur
- **SailingTableContainer** with real data
- **Filter inputs** to test filtering
- **Raw JSON** for debugging

## Test Features

### ✅ Loading State
Watch the spinner while data loads

### ✅ Error Handling  
Disconnect Supabase to see error message with retry button

### ✅ Filtering
Enter a sail code or ship name and click "Apply Filters"

### ✅ Refresh
Click "Refresh Data" to refetch

### ✅ Data Display
View the table with all columns and filters

## Console Output

Open DevTools Console (F12) to see:
- Data fetching logs
- Component lifecycle logs
- Any errors

## Expected Behavior

1. Page loads → Spinner appears
2. Data fetches → Spinner disappears  
3. Table renders → Sailing data visible
4. Apply filters → Data updates
5. Click refresh → Data refetches

## Switching Back

When done testing, revert `main.jsx`:

```javascript
// Comment out TestPage import
// import TestPage from './components/TestPage.jsx'

// Restore production render
reactRoot.render(
  <StrictMode>
    <AppWithAuth />
  </StrictMode>
);
```

## Alternative: Add to Dashboard

Instead of standalone test, you can also add the new component to your existing Dashboard:

```javascript
// In Dashboard.jsx, add this import:
import SailingTableContainer from './components/focus-panels/SailingTable';

// Then create a panel with it
api.addPanel({
  id: 'new-sailing-table',
  component: <SailingTableContainer theme={theme} />,
  title: 'New Sailing Table'
});
```

## Troubleshooting

### Spinner Never Stops
- Check Supabase is running: `http://localhost:54321`
- Check browser console for errors
- Check Network tab for failed requests

### "Module not found" Error
- Save all files
- Restart dev server
- Check file paths in imports

### Empty Table
- Check `master_sail` table has data in Supabase
- Check console for data fetch logs

## Quick Checklist

- [ ] Supabase running on localhost:54321
- [ ] Uncommented TestPage import in main.jsx
- [ ] Uncommented TestPage render in main.jsx
- [ ] Commented out AppWithAuth render
- [ ] Started dev server: `npm run dev`
- [ ] Opened browser: http://localhost:5173
- [ ] See TestPage with table
- [ ] Test filters and refresh button

## Next Steps After Testing

1. Compare with old `SimpleTable.jsx` (486 lines)
2. Notice the cleaner code organization
3. Try refactoring another component
4. Add the new patterns to your workflow

---

**Need Help?** Check `COMPONENT-TESTING.md` for more detailed instructions.

