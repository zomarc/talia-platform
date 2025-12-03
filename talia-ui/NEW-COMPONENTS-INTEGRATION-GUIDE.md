# New Components Integration Guide
## Quick Reference for Adding the Three New Components

This guide provides step-by-step instructions for integrating the three new components into the Talia UI system.

---

## Component Registration Pattern

Components are registered in two places:
1. **Import statements** in `App.jsx` or `Dashboard.jsx`
2. **Component registry** in Dockview panel creation

### Current Pattern (from App.jsx)

```javascript
// Import components
import KPICards from "./components/focus-panels/KPICards";
import OccupancyChart from "./components/focus-panels/OccupancyChart";
import BookingProfileContainer from "./components/focus-panels/BookingProfile";

// Use in panel creation
const panelComponent = {
  'kpi-cards': KPICards,
  'occupancy-chart': OccupancyChart,
  'booking-profile': BookingProfileContainer,
  // ... add new components here
};
```

---

## Component 1: Booking Profile Enhanced

### Integration Steps

#### 1. Enhance Existing Component (Recommended)

**File:** `components/focus-panels/BookingProfile/BookingProfilePresenter.jsx`

Add new sub-components:
```javascript
import BuildCurveChart from './BuildCurveChart';
import WeekComparisonTable from './WeekComparisonTable';
import YoYComparisonPanel from './YoYComparisonPanel';

// In BookingProfilePresenter component:
{/* Add after existing chart */}
<BuildCurveChart 
  data={data.buildCurves}
  previousYear={previousYear?.buildCurves}
  theme={theme}
/>
<WeekComparisonTable 
  buildCurves={data.buildCurves}
  theme={theme}
/>
```

#### 2. Extend Service Layer

**File:** `services/data/bookingProfileService.js`

```javascript
// Add new method
async fetchWithBuildCurves(sailCode, options = {}) {
  const { data } = await apolloClient.query({
    query: GET_BOOKING_PROFILE_WITH_CURVES,
    variables: { sailCode, ...options },
    fetchPolicy: 'network-only'
  });
  return data.bookingProfileWithCurves;
}
```

#### 3. Extend Hook

**File:** `hooks/data/useBookingProfile.js`

```javascript
export const useBookingProfileWithCurves = (sailCode, options = {}) => {
  // Similar to useBookingProfile but calls fetchWithBuildCurves
  const [data, setData] = useState(null);
  // ... implementation
};
```

#### 4. Update Container

**File:** `components/focus-panels/BookingProfile/index.jsx`

```javascript
const BookingProfileContainer = ({ sailCode, includeBuildCurves = false, ...props }) => {
  const { data, loading, error } = includeBuildCurves 
    ? useBookingProfileWithCurves(sailCode)
    : useBookingProfile(sailCode);
  
  // ... rest of component
};
```

**No registration needed** - component already exists and is used.

---

## Component 2: Target Profile Editor

### Integration Steps

#### 1. Create Component Structure

```bash
mkdir -p src/components/focus-panels/TargetProfileEditor/components
```

**Files to create:**
- `components/focus-panels/TargetProfileEditor/index.jsx`
- `components/focus-panels/TargetProfileEditor/TargetProfileEditorPresenter.jsx`
- `components/focus-panels/TargetProfileEditor/components/TargetCurveBuilder.jsx`
- `components/focus-panels/TargetProfileEditor/components/HistoricDataSelector.jsx`
- `components/focus-panels/TargetProfileEditor/components/TargetEditorForm.jsx`
- `components/focus-panels/TargetProfileEditor/components/PreviewChart.jsx`

#### 2. Create Service

**File:** `services/data/targetProfileService.js` (NEW)

```javascript
import { apolloClient } from '../../lib/apolloClient';
import { gql } from '@apollo/client';

const GET_TARGET_PROFILES = gql`
  query GetTargetProfiles($filters: TargetProfileFilters) {
    targetProfiles(filters: $filters) {
      id
      name
      sailCode
      buildCurves {
        weekLabel
        targetBookings
      }
    }
  }
`;

const CREATE_TARGET_PROFILE = gql`
  mutation CreateTargetProfile($input: TargetProfileInput!) {
    createTargetProfile(input: $input) {
      id
      name
    }
  }
`;

class TargetProfileService {
  async fetchAll(filters = {}) {
    const { data } = await apolloClient.query({
      query: GET_TARGET_PROFILES,
      variables: { filters },
      fetchPolicy: 'cache-and-network'
    });
    return data.targetProfiles;
  }

  async create(input) {
    const { data } = await apolloClient.mutate({
      mutation: CREATE_TARGET_PROFILE,
      variables: { input }
    });
    return data.createTargetProfile;
  }

  // ... other methods
}

export default new TargetProfileService();
```

#### 3. Create Hook

**File:** `hooks/data/useTargetProfile.js` (NEW)

```javascript
import { useState, useEffect } from 'react';
import targetProfileService from '../../services/data/targetProfileService';

export const useTargetProfiles = (filters = {}) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetch = async () => {
      try {
        const result = await targetProfileService.fetchAll(filters);
        setData(result);
      } catch (err) {
        setError(err);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [filters]);

  return { data, loading, error };
};

export const useTargetProfileMutation = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const create = async (input) => {
    setLoading(true);
    setError(null);
    try {
      return await targetProfileService.create(input);
    } catch (err) {
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { create, loading, error };
};
```

#### 4. Register Component

**File:** `App.jsx` or `Dashboard.jsx`

```javascript
// Add import
import TargetProfileEditor from "./components/focus-panels/TargetProfileEditor";

// Add to panel component registry
const panelComponent = {
  // ... existing components
  'target-profile-editor': TargetProfileEditor,
};
```

#### 5. Add to Focus Layout Editor

**File:** `components/focus-management/FocusLayoutEditor.jsx`

```javascript
const availableComponentTypes = [
  // ... existing types
  { id: 'target-profile-editor', name: 'Target Profile Editor', icon: '🎯' },
];
```

---

## Component 3: Departure Info Agent (Weather & News)

### Integration Steps

#### 1. Create Component Structure

```bash
mkdir -p src/components/focus-panels/DepartureInfoAgent/components
```

**Files to create:**
- `components/focus-panels/DepartureInfoAgent/index.jsx`
- `components/focus-panels/DepartureInfoAgent/DepartureInfoAgentPresenter.jsx`
- `components/focus-panels/DepartureInfoAgent/components/WeatherCard.jsx`
- `components/focus-panels/DepartureInfoAgent/components/NewsFeed.jsx`
- `components/focus-panels/DepartureInfoAgent/components/PortInfoPanel.jsx`
- `components/focus-panels/DepartureInfoAgent/components/AIInsightsPanel.jsx`

#### 2. Create Service

**File:** `services/data/departureInfoService.js` (NEW)

```javascript
import { apolloClient } from '../../lib/apolloClient';
import { gql } from '@apollo/client';

const GET_DEPARTURE_INFO = gql`
  query GetDepartureInfo($sailCode: String!, $portCode: String!) {
    departureInfo(sailCode: $sailCode, portCode: $portCode) {
      weather {
        temperature
        condition
        forecast {
          date
          high
          low
        }
      }
      news {
        title
        source
        publishedAt
        url
      }
      insights {
        type
        summary
        recommendations
      }
    }
  }
`;

class DepartureInfoService {
  async fetch(sailCode, portCode) {
    const { data } = await apolloClient.query({
      query: GET_DEPARTURE_INFO,
      variables: { sailCode, portCode },
      fetchPolicy: 'cache-first', // Cache weather/news data
      fetchPolicy: {
        nextFetchPolicy: 'cache-first',
        refetchWritePolicy: 'merge'
      }
    });
    return data.departureInfo;
  }
}

export default new DepartureInfoService();
```

#### 3. Create Hook

**File:** `hooks/data/useDepartureInfo.js` (NEW)

```javascript
import { useState, useEffect } from 'react';
import departureInfoService from '../../services/data/departureInfoService';

export const useDepartureInfo = (sailCode, portCode) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!sailCode || !portCode) {
      setLoading(false);
      return;
    }

    const fetch = async () => {
      try {
        const result = await departureInfoService.fetch(sailCode, portCode);
        setData(result);
      } catch (err) {
        setError(err);
      } finally {
        setLoading(false);
      }
    };

    fetch();

    // Refresh weather every 30 minutes
    const interval = setInterval(fetch, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, [sailCode, portCode]);

  return { data, loading, error };
};
```

#### 4. Register Component

**File:** `App.jsx` or `Dashboard.jsx`

```javascript
// Add import
import DepartureInfoAgent from "./components/focus-panels/DepartureInfoAgent";

// Add to panel component registry
const panelComponent = {
  // ... existing components
  'departure-info-agent': DepartureInfoAgent,
};
```

#### 5. Add to Focus Layout Editor

**File:** `components/focus-management/FocusLayoutEditor.jsx`

```javascript
const availableComponentTypes = [
  // ... existing types
  { id: 'departure-info-agent', name: 'Departure Info Agent', icon: '🌤️' },
];
```

---

## Backend Integration Requirements

### GraphQL Schema Updates

**File:** `talia-server/src/api/schema.ts`

Add the following types and queries:

```graphql
# Target Profile Types
type TargetProfile {
  id: ID!
  name: String!
  description: String
  sailCode: String
  buildCurves: [BuildCurvePoint!]!
  createdBy: ID!
  createdAt: String!
  updatedAt: String!
}

type BuildCurvePoint {
  weekLabel: String!
  weeksUntilSailing: Int!
  targetBookings: Int!
  targetGuests: Int!
}

# Departure Info Types
type WeatherData {
  location: String!
  temperature: Float!
  condition: String!
  forecast: [WeatherForecast!]!
}

type NewsArticle {
  title: String!
  source: String!
  publishedAt: String!
  url: String!
}

type AIInsight {
  type: String!
  summary: String!
  recommendations: [String!]!
}

type DepartureInfo {
  weather: WeatherData
  news: [NewsArticle!]!
  insights: [AIInsight!]!
}

# Queries
type Query {
  targetProfiles(filters: TargetProfileFilters): [TargetProfile!]!
  targetProfile(id: ID!): TargetProfile
  departureInfo(sailCode: String!, portCode: String!): DepartureInfo
  bookingProfileWithCurves(sailCode: String!): BookingProfileWithCurves
}

# Mutations
type Mutation {
  createTargetProfile(input: TargetProfileInput!): TargetProfile!
  updateTargetProfile(id: ID!, input: TargetProfileInput!): TargetProfile!
  deleteTargetProfile(id: ID!): Boolean!
}
```

### Resolver Implementation

**File:** `talia-server/src/api/resolvers.ts`

Add resolvers for:
- `targetProfiles` - Query all target profiles
- `targetProfile` - Query single target profile
- `createTargetProfile` - Create new target profile
- `updateTargetProfile` - Update existing target profile
- `deleteTargetProfile` - Delete target profile
- `departureInfo` - Fetch weather, news, and AI insights
- `bookingProfileWithCurves` - Enhanced booking profile with build curves

---

## Testing Checklist

### Component 1: Booking Profile Enhanced
- [ ] Build curves display correctly
- [ ] Week comparison table shows accurate data
- [ ] Year-on-year comparison works
- [ ] Chart updates when sail code changes
- [ ] Loading states display properly
- [ ] Error handling works

### Component 2: Target Profile Editor
- [ ] Can create new target profile
- [ ] Can edit existing target profile
- [ ] Can delete target profile
- [ ] Historic data selector works
- [ ] Curve builder allows drag-and-drop editing
- [ ] Preview chart shows correct data
- [ ] Validation prevents invalid curves
- [ ] Save/load functionality works

### Component 3: Departure Info Agent
- [ ] Weather data displays correctly
- [ ] News feed loads articles
- [ ] AI insights generate properly
- [ ] Port info displays
- [ ] Auto-refresh works for weather
- [ ] Caching works correctly
- [ ] Error handling for API failures
- [ ] Loading states display

---

## Common Patterns to Follow

### 1. Container/Presenter Pattern
```javascript
// Container (index.jsx)
const ComponentContainer = ({ sailCode, theme }) => {
  const { data, loading, error } = useComponentData(sailCode);
  
  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage error={error} />;
  
  return <ComponentPresenter data={data} theme={theme} />;
};

// Presenter (ComponentPresenter.jsx)
const ComponentPresenter = ({ data, theme }) => {
  // Pure UI rendering
};
```

### 2. Service Layer Pattern
```javascript
class ComponentService {
  async fetch(params) {
    const { data } = await apolloClient.query({
      query: GET_DATA,
      variables: params,
      fetchPolicy: 'network-only'
    });
    return data.result;
  }
}
```

### 3. Hook Pattern
```javascript
export const useComponentData = (params) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Fetch data
  }, [params]);

  return { data, loading, error, refetch };
};
```

### 4. Error Handling
```javascript
try {
  const result = await service.fetch(params);
  setData(result);
} catch (err) {
  console.error('[Component] Error:', err);
  setError(err);
} finally {
  setLoading(false);
}
```

---

## Next Steps

1. **Review architecture recommendations** in `COMPONENT-ARCHITECTURE-RECOMMENDATIONS.md`
2. **Set up backend GraphQL schema** extensions
3. **Create component stubs** using `_TEMPLATE` folder
4. **Implement service layer** for each component
5. **Create hooks** for data fetching
6. **Build UI components** following Container/Presenter pattern
7. **Register components** in App.jsx
8. **Test integration** with existing focus system

---

## Questions?

Refer to:
- `COMPONENT-ARCHITECTURE-RECOMMENDATIONS.md` - Detailed architecture
- `COMPONENT-ARCHITECTURE-REVIEW.md` - Current architecture analysis
- `IMPLEMENTATION-GUIDE.md` - Implementation patterns
- `components/focus-panels/_TEMPLATE/` - Component template

