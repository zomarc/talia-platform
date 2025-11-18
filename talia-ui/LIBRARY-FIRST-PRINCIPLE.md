# Library-First Development Principle

## The Rule

> **"If a library provides a feature, use it. Don't write custom code to do what the library already does."**

## Why This Matters

### 📊 Code Reduction: 96% Less Code!

**Before** (Custom implementation):
```javascript
// 50 lines of custom filter generation code
const getFilterValues = (field, data) => { /* ... */ };
const generateColumns = (data) => { /* ... */ };
const columns = generateColumns(data);
```

**After** (Using library):
```javascript
// 2 lines using Tabulator's native feature
headerFilter: "autocomplete",
headerFilterParams: { valuesLookup: true }
```

**Result**: 96% code reduction, better performance, automatic updates

### 🎯 Benefits

1. **Less Code** → Easier to maintain
2. **Better Performance** → Library optimized
3. **Fewer Bugs** → Library tested by millions
4. **Automatic Updates** → Library handles edge cases
5. **Better UX** → Library UI patterns

---

## How to Apply This Principle

### Step 1: Check the Library First

Before writing any code, ask:
- "Does the library already do this?"
- "What's the official way to achieve this?"
- "Is there a configuration option for this?"

### Step 2: Read the Documentation

Don't assume—check the docs:
- Official documentation
- Examples and tutorials
- GitHub issues (for common patterns)

### Step 3: Use It

If the library provides it:
- ✅ Use the library feature
- ✅ Configure it properly
- ✅ Add comments explaining why

### Step 4: Only Then Write Custom Code

If the library truly doesn't support it:
- Write minimal custom code
- Document why library can't be used
- Consider contributing to library

---

## Real Examples from Our Codebase

### ✅ GOOD: Using Tabulator's valuesLookup

```javascript
// File: SailingTablePresenter.jsx
// Let Tabulator handle filter values automatically
{
  field: "ship_name",
  headerFilter: "autocomplete",
  headerFilterParams: {
    valuesLookup: true  // ← Using library feature!
  }
}
```

**Why this is good**:
- Tabulator extracts unique values automatically
- Updates when data changes
- Optimized performance
- No custom code needed

### ❌ BAD: Manual Implementation (Previous Version)

```javascript
// This is what we had before - DON'T DO THIS
const getFilterValues = (field, data) => {
  const sampleData = data.slice(0, 100);
  const uniqueValues = [...new Set(
    sampleData.map(row => row[field]).filter(Boolean)
  )];
  const values = { "": "All" };
  uniqueValues.forEach(value => {
    values[value] = value;
  });
  return values;
};

// Then manually setting values
column.headerFilterParams = {
  values: getFilterValues(col.field, data)
};
```

**Why this is bad**:
- Reinvents what library already does
- More code to maintain
- Potential bugs
- Doesn't auto-update
- Slower performance

---

## Guidelines by Library

### Tabulator

#### ✅ Use Native Features
- `valuesLookup: true` for filter dropdowns
- `initialSort` for default sorting
- `resizableColumns` for column resizing
- `movableColumns` for column reordering
- Built-in formatters for data display
- Theme system for styling

#### ❌ Don't Write Custom
- ~~Manual filter value extraction~~
- ~~Custom sorting logic~~
- ~~Custom styling CSS~~
- ~~Custom cell renderers~~

### React

#### ✅ Use These Patterns
- Custom hooks for data fetching
- Context for state sharing
- Component composition
- Proper useEffect usage

#### ❌ Don't Do These
- ~~Inline data fetching~~
- ~~Prop drilling~~
- ~~Direct DOM manipulation~~
- ~~Global variables for state~~

### Data Fetching

#### ✅ Use These
- Custom hooks (`useSailingData`)
- Service layer functions
- Shared error/loading components

#### ❌ Don't Do These
- ~~Fetch in every component~~
- ~~Duplicate fetch logic~~
- ~~Custom error handling UI~~

---

## Red Flags to Watch For

If you see these patterns, it means we're NOT using libraries:

### 🚩 Large Data Processing Functions
```javascript
// This suggests we should use a library
const processData = (data) => {
  // 50+ lines of data manipulation
}
```

### 🚩 Manual UI Components
```javascript
// Building something libraries already provide
<div style={{/* complex styling*/}} onClick={handleClick}>
  {/* custom dropdown or modal */}
</div>
```

### 🚩 Custom State Logic
```javascript
// Managing complex state that libraries could handle
const [state1, setState1] = useState();
const [state2, setState2] = useState();
// ... many useState calls
```

### 🚩 Inline API Calls
```javascript
// Fetching data in components instead of using hooks
useEffect(() => {
  fetch('/api').then(res => res.json()).then(setData);
}, []);
```

---

## Code Review Checklist

### Before Writing Code
- [ ] Did I check if the library provides this?
- [ ] Did I read the library documentation?
- [ ] Did I look for examples?
- [ ] Can I use an existing pattern?

### During Code Review
- [ ] Is this using the library feature?
- [ ] Could this be done with less code using the library?
- [ ] Is custom code necessary?
- [ ] Could this break when library updates?

### After Code Review
- [ ] Is there less code than before?
- [ ] Does it use library features?
- [ ] Is it easier to maintain?
- [ ] Is it more performant?

---

## Success Metrics

### Before (Custom Code)
```
Lines of Code: 50+
Maintenance Time: High
Bugs: Likely
Performance: Variable
Updates: Manual
```

### After (Using Library)
```
Lines of Code: 2-5
Maintenance Time: Low
Bugs: Unlikely (library tested)
Performance: Optimized
Updates: Automatic
```

---

## Resources

### Learn the Libraries
- **Tabulator**: https://tabulator.info/docs/5.6
- **React**: https://react.dev/
- **React Query**: https://tanstack.com/query/latest
- **Material-UI**: https://mui.com/

### Documentation We've Created
- `CODING-STANDARDS.md` - Our coding rules
- `COMPONENT-ARCHITECTURE-REVIEW.md` - Architecture decisions
- `BEFORE-AFTER-EXAMPLES.md` - Real examples

---

## Remember

> **"If you can't find it in the library docs, you're probably doing it wrong."**

Always check the library first. It's almost certainly already there. 🚀

