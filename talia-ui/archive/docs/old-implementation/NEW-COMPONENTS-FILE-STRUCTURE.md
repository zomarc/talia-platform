# New Components File Structure
## Visual Guide to Component Organization

This document shows the recommended file structure for the three new components.

---

## Current Structure (Reference)

```
talia-ui/src/
├── components/
│   ├── focus-panels/
│   │   ├── BookingProfile/              # EXISTING
│   │   │   ├── index.jsx
│   │   │   └── BookingProfilePresenter.jsx
│   │   ├── SailingTable/                # EXISTING (Example)
│   │   │   ├── index.jsx
│   │   │   └── SailingTablePresenter.jsx
│   │   └── _TEMPLATE/                   # Template for new components
│   │       ├── index.jsx
│   │       └── TemplatePresenter.jsx
│   └── shared/
│       ├── LoadingSpinner.jsx
│       ├── ErrorMessage.jsx
│       └── index.js
├── services/
│   └── data/
│       ├── bookingProfileService.js     # EXISTING
│       ├── sailingsService.js
│       └── publishedRatesService.js
└── hooks/
    └── data/
        ├── useBookingProfile.js         # EXISTING
        ├── useSailingData.js
        └── usePublishedRatesData.js
```

---

## Component 1: Booking Profile Enhanced

### Structure (Enhance Existing)

```
components/focus-panels/BookingProfile/
├── index.jsx                           # EXISTING - Enhance
├── BookingProfilePresenter.jsx         # EXISTING - Enhance
├── BuildCurveChart.jsx                 # NEW - Sub-component
├── WeekComparisonTable.jsx             # NEW - Sub-component
└── YoYComparisonPanel.jsx              # NEW - Sub-component

services/data/
└── bookingProfileService.js            # EXISTING - Add new method
    └── fetchWithBuildCurves()         # NEW method

hooks/data/
└── useBookingProfile.js                # EXISTING - Add new hook
    └── useBookingProfileWithCurves()   # NEW hook
```

### File Responsibilities

**BuildCurveChart.jsx**
- Displays incremental build curves (W-12 to Sail)
- Shows Actual vs Target vs Previous Year
- Uses Chart.js (already in use)

**WeekComparisonTable.jsx**
- Table showing week-by-week breakdown
- Uses Tabulator (consistent with existing tables)
- Columns: Week, Actual, Target, Variance, % Complete

**YoYComparisonPanel.jsx**
- Side-by-side year comparison
- Highlights differences
- Shows trend indicators

---

## Component 2: Target Profile Editor

### Structure (New Component)

```
components/focus-panels/TargetProfileEditor/
├── index.jsx                           # Container component
├── TargetProfileEditorPresenter.jsx   # Presentational component
└── components/                         # Sub-components
    ├── TargetCurveBuilder.jsx         # Interactive curve editor
    ├── HistoricDataSelector.jsx        # Select historic sailings
    ├── TargetEditorForm.jsx            # Form for editing
    └── PreviewChart.jsx               # Preview target curve

services/data/
└── targetProfileService.js            # NEW service
    ├── fetchAll()
    ├── fetchById()
    ├── create()
    ├── update()
    ├── delete()
    └── generateFromHistoric()

hooks/data/
└── useTargetProfile.js                # NEW hook
    ├── useTargetProfiles()
    ├── useTargetProfile()
    └── useTargetProfileMutation()

contexts/                               # NEW context (optional)
└── TargetProfileEditorContext.jsx     # Editing state management
```

### File Responsibilities

**index.jsx (Container)**
- Handles data fetching
- Manages loading/error states
- Passes data to presenter

**TargetProfileEditorPresenter.jsx**
- Main UI layout
- Orchestrates sub-components
- Handles user interactions

**TargetCurveBuilder.jsx**
- Interactive chart for editing curves
- Drag-and-drop point editing
- Real-time validation

**HistoricDataSelector.jsx**
- Multi-select for historic sailings
- Filter by ship/package/season
- Preview selected curves

**TargetEditorForm.jsx**
- Form fields (name, description, etc.)
- Integration with curve builder
- Save/Cancel actions

**PreviewChart.jsx**
- Shows target vs actual (if available)
- Side-by-side comparison
- Export functionality

---

## Component 3: Departure Info Agent

### Structure (New Component)

```
components/focus-panels/DepartureInfoAgent/
├── index.jsx                           # Container component
├── DepartureInfoAgentPresenter.jsx    # Presentational component
└── components/                         # Sub-components
    ├── WeatherCard.jsx                 # Weather display
    ├── NewsFeed.jsx                    # News articles
    ├── PortInfoPanel.jsx               # Port information
    └── AIInsightsPanel.jsx             # AI-generated insights

services/data/
└── departureInfoService.js            # NEW service
    ├── fetchWeather()
    ├── fetchNews()
    ├── getAIInsights()
    └── fetchPortInfo()

hooks/data/
└── useDepartureInfo.js                # NEW hook
    └── useDepartureInfo()             # Fetches all data
```

### File Responsibilities

**index.jsx (Container)**
- Fetches weather, news, and insights
- Manages loading/error states
- Handles auto-refresh for weather

**DepartureInfoAgentPresenter.jsx**
- Main layout with grid of cards
- Orchestrates sub-components
- Handles refresh actions

**WeatherCard.jsx**
- Current conditions display
- 7-day forecast
- Temperature chart
- Auto-refresh every 30 minutes

**NewsFeed.jsx**
- List of relevant news articles
- Filter by date/relevance
- Pagination support
- Click to open in new tab

**PortInfoPanel.jsx**
- Port location and timezone
- Local attractions
- Transportation info
- Optional map integration

**AIInsightsPanel.jsx**
- AI-generated summary
- Actionable recommendations
- Confidence indicators
- Regenerate button

---

## Shared Components to Create

### New Shared Components

```
components/shared/
├── ChartContainer.jsx                  # NEW - Chart wrapper
├── EditableChart.jsx                  # NEW - Interactive chart
├── DataCard.jsx                        # NEW - Reusable card
└── FormField.jsx                      # NEW - Form input wrapper
```

### ChartContainer.jsx
- Wrapper for Chart.js
- Consistent styling
- Loading/error states
- Export functionality

### EditableChart.jsx
- Interactive chart for target curve builder
- Drag-and-drop point editing
- Validation feedback
- Based on Chart.js

### DataCard.jsx
- Reusable card component
- Consistent styling
- Expandable/collapsible
- Used for weather/news/insights

### FormField.jsx
- Standardized form input
- Validation display
- Label/error handling
- Consistent styling

---

## Service Layer Structure

### Existing Services (Reference)

```
services/data/
├── bookingProfileService.js           # EXISTING
├── sailingsService.js                 # EXISTING
└── publishedRatesService.js          # EXISTING
```

### New Services

```
services/data/
├── targetProfileService.js            # NEW
│   ├── fetchAll(filters)
│   ├── fetchById(id)
│   ├── create(input)
│   ├── update(id, input)
│   ├── delete(id)
│   └── generateFromHistoric(sailCodes, options)
│
└── departureInfoService.js            # NEW
    ├── fetchWeather(portCode, date)
    ├── fetchNews(location, limit)
    ├── getAIInsights(sailCode, portCode)
    └── fetchPortInfo(portCode)
```

---

## Hooks Structure

### Existing Hooks (Reference)

```
hooks/data/
├── useBookingProfile.js               # EXISTING
├── useSailingData.js                  # EXISTING
└── usePublishedRatesData.js           # EXISTING
```

### New Hooks

```
hooks/data/
├── useTargetProfile.js                # NEW
│   ├── useTargetProfiles(filters)
│   ├── useTargetProfile(id)
│   └── useTargetProfileMutation()
│
└── useDepartureInfo.js                # NEW
    └── useDepartureInfo(sailCode, portCode)
```

---

## Backend Structure (Reference)

### GraphQL Schema

```
talia-server/src/api/
├── schema.ts                          # Add new types/queries/mutations
└── resolvers.ts                       # Add new resolvers
```

### New Types to Add

```graphql
# Target Profile Types
type TargetProfile { ... }
type BuildCurvePoint { ... }
input TargetProfileInput { ... }

# Departure Info Types
type WeatherData { ... }
type WeatherForecast { ... }
type NewsArticle { ... }
type AIInsight { ... }
type DepartureInfo { ... }

# Enhanced Booking Profile
type BookingProfileWithCurves { ... }
```

### New Queries/Mutations

```graphql
# Queries
targetProfiles(filters: TargetProfileFilters): [TargetProfile!]!
targetProfile(id: ID!): TargetProfile
departureInfo(sailCode: String!, portCode: String!): DepartureInfo
bookingProfileWithCurves(sailCode: String!): BookingProfileWithCurves

# Mutations
createTargetProfile(input: TargetProfileInput!): TargetProfile!
updateTargetProfile(id: ID!, input: TargetProfileInput!): TargetProfile!
deleteTargetProfile(id: ID!): Boolean!
```

---

## Component Registration

### App.jsx / Dashboard.jsx

```javascript
// Import statements
import BookingProfileContainer from "./components/focus-panels/BookingProfile";
import TargetProfileEditor from "./components/focus-panels/TargetProfileEditor";
import DepartureInfoAgent from "./components/focus-panels/DepartureInfoAgent";

// Component registry
const panelComponent = {
  'booking-profile': BookingProfileContainer,
  'target-profile-editor': TargetProfileEditor,
  'departure-info-agent': DepartureInfoAgent,
  // ... other components
};
```

### Focus Layout Editor

```javascript
// components/focus-management/FocusLayoutEditor.jsx
const availableComponentTypes = [
  // ... existing types
  { id: 'target-profile-editor', name: 'Target Profile Editor', icon: '🎯' },
  { id: 'departure-info-agent', name: 'Departure Info Agent', icon: '🌤️' },
];
```

---

## Implementation Order

### Phase 1: Foundation
1. ✅ Review architecture documents
2. ✅ Set up GraphQL schema extensions
3. ✅ Create service layer stubs
4. ✅ Create hook stubs

### Phase 2: Booking Profile Enhanced
1. Extend `bookingProfileService.js`
2. Add GraphQL resolver
3. Create `BuildCurveChart.jsx`
4. Create `WeekComparisonTable.jsx`
5. Create `YoYComparisonPanel.jsx`
6. Integrate into existing presenter

### Phase 3: Target Profile Editor
1. Create `targetProfileService.js`
2. Add GraphQL mutations
3. Create all sub-components
4. Implement save/load functionality
5. Register component

### Phase 4: Departure Info Agent
1. Set up external API integrations (backend)
2. Create `departureInfoService.js`
3. Create all sub-components
4. Implement caching strategy
5. Register component

---

## File Naming Conventions

### Components
- **Container**: `index.jsx` (in component folder)
- **Presenter**: `{ComponentName}Presenter.jsx`
- **Sub-components**: `{SubComponentName}.jsx` (in `components/` subfolder)

### Services
- **Service file**: `{feature}Service.js`
- **Service class**: `{Feature}Service`
- **Export**: Singleton instance

### Hooks
- **Hook file**: `use{Feature}.js`
- **Hook function**: `use{Feature}()`
- **Multiple hooks**: Export all from same file

### GraphQL
- **Query**: `GET_{FEATURE}` (UPPERCASE with underscores)
- **Mutation**: `CREATE_{FEATURE}`, `UPDATE_{FEATURE}`, etc.

---

## Dependencies

### Existing Dependencies (Already Installed)
- React 19.1.1
- Apollo Client (@apollo/client)
- Chart.js (for charts)
- Tabulator (for tables)
- Dockview (for layout)

### New Dependencies (May Need)
- None required - all can use existing libraries

### External APIs (Backend Integration)
- Weather API (OpenWeatherMap, WeatherAPI.com, etc.)
- News API (NewsAPI.org, Google News API, etc.)
- AI/LLM API (OpenAI, Anthropic, etc.)

---

## Testing Structure

```
__tests__/                             # NEW (if adding tests)
├── components/
│   ├── BookingProfile/
│   │   └── BuildCurveChart.test.jsx
│   ├── TargetProfileEditor/
│   │   └── TargetCurveBuilder.test.jsx
│   └── DepartureInfoAgent/
│       └── WeatherCard.test.jsx
├── services/
│   ├── targetProfileService.test.js
│   └── departureInfoService.test.js
└── hooks/
    ├── useTargetProfile.test.js
    └── useDepartureInfo.test.js
```

---

## Summary

### Files to Create/Modify

**Component 1: Booking Profile Enhanced**
- ✅ Enhance 2 existing files
- ➕ Create 3 new sub-components
- ➕ Add 1 new service method
- ➕ Add 1 new hook

**Component 2: Target Profile Editor**
- ➕ Create 6 new component files
- ➕ Create 1 new service file
- ➕ Create 1 new hook file
- ➕ Create 1 optional context file

**Component 3: Departure Info Agent**
- ➕ Create 6 new component files
- ➕ Create 1 new service file
- ➕ Create 1 new hook file

**Shared Components**
- ➕ Create 4 new shared components

**Backend**
- ➕ Add GraphQL types
- ➕ Add GraphQL queries
- ➕ Add GraphQL mutations
- ➕ Add resolvers

**Total:**
- ~25 new files
- ~5 enhanced files
- ~1 backend schema update

---

## Questions?

Refer to:
- `COMPONENT-ARCHITECTURE-RECOMMENDATIONS.md` - Detailed architecture
- `NEW-COMPONENTS-INTEGRATION-GUIDE.md` - Integration steps
- `components/focus-panels/_TEMPLATE/` - Component template

