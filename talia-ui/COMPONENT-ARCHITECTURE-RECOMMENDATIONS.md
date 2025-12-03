# Component Architecture Recommendations
## New Components Structure Plan

### Overview
This document provides architectural recommendations for adding three new components to the Talia UI:
1. **Booking Profile with Incremental Build Curves** - Enhanced booking visualization with week-by-week progression
2. **Target Profile Creator/Editor** - Dynamic target profile management based on historic data
3. **AI Agent for Weather & News** - Weather data and local news for departures

---

## Current Architecture Summary

### ✅ Established Patterns
- **Container/Presenter Pattern**: Data fetching separated from UI rendering
- **Service Layer**: `services/data/` for API abstraction
- **Custom Hooks**: `hooks/data/` for reusable data fetching logic
- **Shared Components**: `components/shared/` for common UI elements
- **GraphQL Integration**: Apollo Client for data fetching
- **Theme System**: Consistent theming across components

### 📁 Current Structure
```
talia-ui/src/
├── components/
│   ├── focus-panels/          # Main data visualization panels
│   │   ├── BookingProfile/   # Existing booking profile
│   │   ├── SailingTable/     # Example of Container/Presenter pattern
│   │   └── _TEMPLATE/        # Template for new components
│   └── shared/               # Reusable UI components
├── services/
│   └── data/                 # Data service layer
├── hooks/
│   └── data/                 # Custom data fetching hooks
└── config/                   # Configuration files
```

---

## Component 1: Booking Profile with Incremental Build Curves

### Purpose
Display incremental booking build curves for a sailing with year-on-year comparisons, showing week-by-week progression (W-12, W-10, W-8, W-6, W-4, W-2, Sail).

### Recommended Structure

```
components/focus-panels/BookingProfileEnhanced/
├── index.jsx                          # Container component
├── BookingProfileEnhancedPresenter.jsx # Presentational component
└── components/                        # Sub-components
    ├── BuildCurveChart.jsx           # Chart for incremental curves
    ├── WeekComparisonTable.jsx       # Table showing week-by-week data
    └── YoYComparisonPanel.jsx       # Year-on-year comparison section
```

### Architecture Decisions

#### Option A: Enhance Existing Component (Recommended)
**Pros:**
- Reuses existing `BookingProfile` infrastructure
- Maintains consistency with current implementation
- Less code duplication

**Implementation:**
- Extend `BookingProfilePresenter.jsx` with new build curve visualization
- Add new data points to `BookingProfileService` for incremental week data
- Create sub-components for chart and table views

#### Option B: New Separate Component
**Pros:**
- Clear separation of concerns
- Can be used independently
- Easier to maintain separately

**Implementation:**
- Create new `BookingProfileEnhanced` component
- Share service layer with existing `BookingProfileService`
- Create new hook `useBookingProfileEnhanced`

### Recommended Approach: **Option A with Sub-components**

**File Structure:**
```javascript
// components/focus-panels/BookingProfile/
├── index.jsx                          # Existing container (enhance)
├── BookingProfilePresenter.jsx       # Existing presenter (enhance)
├── BuildCurveChart.jsx              # NEW: Chart component
├── WeekComparisonTable.jsx           # NEW: Table component
└── YoYComparisonPanel.jsx           # NEW: Comparison panel
```

### Service Layer Extension

**File:** `services/data/bookingProfileService.js`

Add new method:
```javascript
/**
 * Fetch booking profile with incremental build curves
 * @param {string} sailCode - Sail code
 * @param {Object} options - { includeComparison, previousYearSailCode, weekIntervals }
 * @returns {Promise<Object>} Booking profile with incremental data
 */
async fetchWithBuildCurves(sailCode, options = {}) {
  // Fetch data with week-by-week breakdown
  // Returns: { currentYear: {...}, previousYear: {...}, buildCurves: [...] }
}
```

### Hook Extension

**File:** `hooks/data/useBookingProfile.js`

Add new hook:
```javascript
/**
 * Hook for booking profile with build curves
 * @param {string} sailCode
 * @param {Object} options
 * @returns {Object} { data, loading, error, refetch }
 */
export const useBookingProfileWithCurves = (sailCode, options = {}) => {
  // Similar to useBookingProfile but calls fetchWithBuildCurves
}
```

### GraphQL Schema Extension

**File:** `talia-server/src/api/schema.ts`

Add to BookingProfile type:
```graphql
type BookingProfile {
  # ... existing fields ...
  buildCurves: [BuildCurvePoint!]!  # NEW
}

type BuildCurvePoint {
  weekLabel: String!      # "W-12", "W-10", etc.
  weeksUntilSailing: Int!
  bookings: Int!
  guests: Int!
  percentageOfTarget: Float
  actualVsTarget: Float
}
```

### Component Implementation Notes

1. **BuildCurveChart.jsx**
   - Use Chart.js (already in use)
   - Display multiple lines: Actual, Target, Previous Year
   - X-axis: Week labels (W-12 to Sail)
   - Y-axis: Booking percentage or count
   - Interactive tooltips showing exact values

2. **WeekComparisonTable.jsx**
   - Use Tabulator (consistent with existing tables)
   - Columns: Week, Actual Bookings, Target Bookings, Variance, % Complete
   - Sortable and filterable
   - Color coding for variance (green/red)

3. **YoYComparisonPanel.jsx**
   - Side-by-side comparison cards
   - Highlight differences
   - Show trend indicators

---

## Component 2: Target Profile Creator/Editor

### Purpose
Dynamic editing of target profiles based on historic data. Allows users to create, edit, and manage target booking curves.

### Recommended Structure

```
components/focus-panels/TargetProfileEditor/
├── index.jsx                          # Container component
├── TargetProfileEditorPresenter.jsx   # Presentational component
└── components/                        # Sub-components
    ├── TargetCurveBuilder.jsx        # Interactive curve builder
    ├── HistoricDataSelector.jsx      # Select historic data as baseline
    ├── TargetEditorForm.jsx          # Form for editing targets
    └── PreviewChart.jsx              # Preview of target curve
```

### Architecture Decisions

This is a **new feature** requiring:
- New service for target profile CRUD operations
- New GraphQL mutations for create/update/delete
- State management for editing workflow
- Validation logic for target curves

### Service Layer

**File:** `services/data/targetProfileService.js` (NEW)

```javascript
class TargetProfileService {
  /**
   * Fetch all target profiles
   */
  async fetchAll(filters = {}) { }

  /**
   * Fetch single target profile
   */
  async fetchById(id) { }

  /**
   * Create new target profile from historic data
   */
  async createFromHistoric(data) { }

  /**
   * Update target profile
   */
  async update(id, data) { }

  /**
   * Delete target profile
   */
  async delete(id) { }

  /**
   * Generate target profile from historic sailings
   */
  async generateFromHistoric(sailCodes, options = {}) { }
}
```

### Hook

**File:** `hooks/data/useTargetProfile.js` (NEW)

```javascript
export const useTargetProfile = (id) => { }
export const useTargetProfiles = (filters) => { }
export const useTargetProfileMutation = () => { }
```

### GraphQL Schema Extension

**File:** `talia-server/src/api/schema.ts`

```graphql
type TargetProfile {
  id: ID!
  name: String!
  description: String
  sailCode: String
  shipCode: String
  packageType: String
  seasonCode: String
  buildCurves: [BuildCurvePoint!]!
  basedOnHistoric: [String!]!  # Sail codes used as baseline
  createdBy: ID!
  createdAt: String!
  updatedAt: String!
}

input TargetProfileInput {
  name: String!
  description: String
  sailCode: String
  shipCode: String
  packageType: String
  seasonCode: String
  buildCurves: [BuildCurvePointInput!]!
  basedOnHistoric: [String!]
}

input BuildCurvePointInput {
  weekLabel: String!
  weeksUntilSailing: Int!
  targetBookings: Int!
  targetGuests: Int!
}

type Mutation {
  createTargetProfile(input: TargetProfileInput!): TargetProfile!
  updateTargetProfile(id: ID!, input: TargetProfileInput!): TargetProfile!
  deleteTargetProfile(id: ID!): Boolean!
  generateTargetProfileFromHistoric(sailCodes: [String!]!, options: JSON): TargetProfile!
}
```

### Component Implementation Notes

1. **TargetCurveBuilder.jsx**
   - Interactive chart where users can drag points
   - Visual editor for week-by-week targets
   - Real-time preview
   - Validation (e.g., targets should increase over time)

2. **HistoricDataSelector.jsx**
   - Multi-select for historic sailings
   - Filter by ship, package, season
   - Preview of selected historic curves
   - "Generate from Average" button

3. **TargetEditorForm.jsx**
   - Form fields: Name, Description, Sail Code, etc.
   - Integration with curve builder
   - Save/Cancel actions

4. **PreviewChart.jsx**
   - Shows target curve vs. actual (if sail code exists)
   - Side-by-side comparison
   - Export functionality

### State Management

Consider using React Context for editing state:
```javascript
// contexts/TargetProfileEditorContext.jsx
export const TargetProfileEditorProvider = ({ children }) => {
  const [editingProfile, setEditingProfile] = useState(null);
  const [isDirty, setIsDirty] = useState(false);
  // ... editing state
}
```

---

## Component 3: AI Agent for Weather & News

### Purpose
Display weather data and local news for departure ports and destinations.

### Recommended Structure

```
components/focus-panels/DepartureInfoAgent/
├── index.jsx                          # Container component
├── DepartureInfoAgentPresenter.jsx   # Presentational component
└── components/                        # Sub-components
    ├── WeatherCard.jsx               # Weather display
    ├── NewsFeed.jsx                  # News articles
    ├── PortInfoPanel.jsx             # Port information
    └── AIInsightsPanel.jsx           # AI-generated insights
```

### Architecture Decisions

This component requires:
- External API integration (weather service, news API)
- AI/LLM integration for insights
- Caching strategy (weather/news don't change frequently)
- Real-time updates for weather

### Service Layer

**File:** `services/data/departureInfoService.js` (NEW)

```javascript
class DepartureInfoService {
  /**
   * Fetch weather for departure port
   */
  async fetchWeather(portCode, date) { }

  /**
   * Fetch local news for port/destination
   */
  async fetchNews(location, limit = 10) { }

  /**
   * Get AI insights for departure
   */
  async getAIInsights(sailCode, portCode) { }

  /**
   * Fetch port information
   */
  async fetchPortInfo(portCode) { }
}
```

### Hook

**File:** `hooks/data/useDepartureInfo.js` (NEW)

```javascript
export const useDepartureInfo = (sailCode, portCode) => {
  // Fetch weather, news, and insights
  // Returns: { weather, news, insights, loading, error }
}
```

### External API Integration

**Options:**
1. **Weather API**: OpenWeatherMap, WeatherAPI.com, or similar
2. **News API**: NewsAPI.org, Google News API, or similar
3. **AI/LLM**: OpenAI API, Anthropic Claude, or similar

**Recommendation:**
- Create a backend proxy endpoint in `talia-server` to:
  - Hide API keys
  - Cache responses
  - Aggregate data
  - Provide consistent interface

### GraphQL Schema Extension

**File:** `talia-server/src/api/schema.ts`

```graphql
type WeatherData {
  location: String!
  date: String!
  temperature: Float!
  condition: String!
  humidity: Float!
  windSpeed: Float!
  forecast: [WeatherForecast!]!
}

type WeatherForecast {
  date: String!
  high: Float!
  low: Float!
  condition: String!
  precipitation: Float
}

type NewsArticle {
  title: String!
  source: String!
  publishedAt: String!
  url: String!
  snippet: String
}

type AIInsight {
  type: String!  # "weather", "news", "general"
  summary: String!
  recommendations: [String!]!
  confidence: Float
}

type DepartureInfo {
  sailCode: String!
  portCode: String!
  portName: String!
  departureDate: String!
  weather: WeatherData
  news: [NewsArticle!]!
  insights: [AIInsight!]!
  portInfo: PortInfo
}

type Query {
  departureInfo(sailCode: String!, portCode: String!): DepartureInfo
}
```

### Component Implementation Notes

1. **WeatherCard.jsx**
   - Current conditions
   - 7-day forecast
   - Visual weather icons
   - Temperature chart
   - Auto-refresh every 15-30 minutes

2. **NewsFeed.jsx**
   - List of relevant news articles
   - Filter by date, relevance
   - Click to open in new tab
   - "Load more" pagination

3. **PortInfoPanel.jsx**
   - Port location, timezone
   - Local attractions
   - Transportation info
   - Map integration (optional)

4. **AIInsightsPanel.jsx**
   - AI-generated summary of weather + news
   - Actionable recommendations
   - Confidence indicators
   - "Regenerate" button

### Caching Strategy

- **Weather**: Cache for 15-30 minutes
- **News**: Cache for 1-2 hours
- **AI Insights**: Cache for 1 hour (can be regenerated on demand)

---

## Implementation Priority & Phases

### Phase 1: Foundation (Week 1-2)
1. ✅ Review and approve architecture
2. ✅ Set up GraphQL schema extensions
3. ✅ Create service layer stubs
4. ✅ Create hook stubs

### Phase 2: Booking Profile Enhanced (Week 2-3)
1. Extend `BookingProfileService` with build curves
2. Add GraphQL resolver for build curves
3. Create `BuildCurveChart` component
4. Create `WeekComparisonTable` component
5. Integrate into existing `BookingProfilePresenter`

### Phase 3: Target Profile Editor (Week 3-5)
1. Create `TargetProfileService`
2. Add GraphQL mutations
3. Create `TargetCurveBuilder` component
4. Create `HistoricDataSelector` component
5. Create `TargetEditorForm` component
6. Implement save/load functionality

### Phase 4: AI Agent (Week 5-7)
1. Set up external API integrations (backend)
2. Create `DepartureInfoService`
3. Create `WeatherCard` component
4. Create `NewsFeed` component
5. Create `AIInsightsPanel` component
6. Implement caching strategy

---

## Shared Components to Create

### New Shared Components Needed

1. **`components/shared/ChartContainer.jsx`**
   - Wrapper for Chart.js with consistent styling
   - Loading/error states
   - Export functionality

2. **`components/shared/EditableChart.jsx`**
   - Interactive chart for target curve builder
   - Drag-and-drop point editing
   - Validation feedback

3. **`components/shared/DataCard.jsx`**
   - Reusable card component for weather/news/insights
   - Consistent styling
   - Expandable/collapsible

4. **`components/shared/FormField.jsx`**
   - Standardized form input
   - Validation display
   - Label/error handling

---

## Testing Strategy

### Unit Tests
- Service layer functions
- Hook logic
- Utility functions

### Component Tests
- Container components (data fetching)
- Presenter components (UI rendering)
- Sub-components (isolated functionality)

### Integration Tests
- Full component workflows
- API integration
- GraphQL queries/mutations

---

## Performance Considerations

1. **Lazy Loading**: Load components on demand
2. **Data Caching**: Use Apollo Client cache effectively
3. **Chart Optimization**: Limit data points for large datasets
4. **API Rate Limiting**: Implement for external APIs
5. **Debouncing**: For interactive editors (target curve builder)

---

## Accessibility Considerations

1. **Keyboard Navigation**: All interactive elements
2. **Screen Reader Support**: ARIA labels
3. **Color Contrast**: Meet WCAG standards
4. **Focus Management**: Clear focus indicators

---

## Documentation Requirements

For each component:
1. **README.md** in component folder
2. **Usage examples** in code comments
3. **Props documentation** (JSDoc)
4. **Integration guide** for other developers

---

## Questions to Resolve

1. **Target Profile Storage**: Database table or JSON storage?
2. **Weather API**: Which service? Budget considerations?
3. **News API**: Which service? Filtering criteria?
4. **AI Integration**: Which LLM? Cost considerations?
5. **User Permissions**: Who can create/edit target profiles?
6. **Data Retention**: How long to keep historic target profiles?

---

## Next Steps

1. **Review this document** with team
2. **Resolve questions** above
3. **Prioritize components** based on business needs
4. **Set up development environment** for new components
5. **Create initial component stubs** using `_TEMPLATE`
6. **Begin Phase 1 implementation**

---

## References

- **Existing Architecture**: `COMPONENT-ARCHITECTURE-REVIEW.md`
- **Implementation Guide**: `IMPLEMENTATION-GUIDE.md`
- **Template Component**: `components/focus-panels/_TEMPLATE/`
- **Library-First Principle**: `LIBRARY-FIRST-PRINCIPLE.md`

