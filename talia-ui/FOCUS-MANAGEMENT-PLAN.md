# Focus Management Development Plan

## 🎯 Today's Objectives

### **1. Focus Management System**
- **User Custom Focus Creation**: Allow users to create personal layouts
- **Focus Templates**: Predefined focus templates for different roles
- **Focus Sharing**: Ability to share custom focuses (future)
- **Focus Persistence**: Save and restore user-created focuses

### **2. GraphQL Server Integration**
- **Connect to existing GraphQL server**: Integrate with deployed GraphQL project
- **Data Fetching**: Replace mock data with real GraphQL queries
- **Role-based Data Filtering**: Apply user role filters in GraphQL queries
- **Real-time Updates**: Implement GraphQL subscriptions for live data

---

## 🏗️ Focus Management Architecture

### **Focus Types**
1. **Standard Focuses**: Admin-defined, role-specific layouts
2. **User Focuses**: Custom layouts created by users
3. **Template Focuses**: Reusable focus templates
4. **Shared Focuses**: User-created focuses shared with team

### **Focus Components**
- **Focus Builder**: Drag-and-drop interface for creating focuses
- **Focus Library**: Browse available focuses by role
- **Focus Settings**: Configure focus properties and permissions
- **Focus Preview**: Preview focus before saving

### **Data Structure**
```javascript
const focus = {
  id: 'unique-id',
  name: 'Focus Name',
  description: 'Focus description',
  type: 'standard' | 'user' | 'template' | 'shared',
  role: 'admin' | 'manager' | 'user' | 'guest',
  components: [
    {
      id: 'component-id',
      type: 'chart' | 'table' | 'kpi',
      position: { x: 0, y: 0, width: 6, height: 4 },
      settings: { /* component-specific settings */ }
    }
  ],
  createdBy: 'user-id',
  createdAt: 'timestamp',
  updatedAt: 'timestamp'
}
```

---

## 🔌 GraphQL Integration Plan

### **Current State**
- **Mock Data**: Currently using hardcoded data in components
- **InstantDB**: Using for authentication and user management
- **GraphQL Server**: Separate project, needs integration

### **Integration Steps**
1. **GraphQL Client Setup**: Configure Apollo Client for GraphQL server
2. **Data Queries**: Replace mock data with GraphQL queries
3. **Role-based Filtering**: Apply user role filters in queries
4. **Real-time Updates**: Implement subscriptions for live data
5. **Error Handling**: Graceful fallback to mock data if GraphQL fails

### **GraphQL Schema Requirements**
```graphql
type Query {
  # Focus management
  focuses(role: String): [Focus]
  focus(id: ID!): Focus
  
  # Component data
  sailings(filters: SailingFilters): [Sailing]
  kpis(role: String): [KPI]
  occupancyData(filters: DateFilters): [OccupancyData]
  revenueData(filters: DateFilters): [RevenueData]
  exceptions(role: String): [Exception]
}

type Mutation {
  createFocus(input: FocusInput!): Focus
  updateFocus(id: ID!, input: FocusInput!): Focus
  deleteFocus(id: ID!): Boolean
}

type Subscription {
  dataUpdated(role: String): DataUpdate
}
```

---

## 📋 Development Tasks

### **Phase 1: Focus Management Foundation**
- [ ] Create FocusBuilder component
- [ ] Implement focus data structure
- [ ] Add focus CRUD operations
- [ ] Create focus library interface
- [ ] Add focus persistence to InstantDB

### **Phase 2: GraphQL Integration**
- [ ] Set up Apollo Client
- [ ] Configure GraphQL server connection
- [ ] Replace mock data with GraphQL queries
- [ ] Implement role-based data filtering
- [ ] Add error handling and fallbacks

### **Phase 3: Advanced Features**
- [ ] Focus templates system
- [ ] Focus sharing capabilities
- [ ] Real-time data updates
- [ ] Advanced focus customization

---

## 🚀 Getting Started

### **1. Focus Management**
- Start with basic focus CRUD operations
- Implement focus builder interface
- Add focus persistence

### **2. GraphQL Server**
- Get GraphQL server URL and schema
- Set up Apollo Client configuration
- Test basic queries

### **3. Integration**
- Gradually replace mock data
- Implement role-based filtering
- Add real-time updates

---

## 📁 File Structure
```
src/
├── components/
│   ├── focus/
│   │   ├── FocusBuilder.jsx
│   │   ├── FocusLibrary.jsx
│   │   ├── FocusSettings.jsx
│   │   └── FocusPreview.jsx
│   └── ...
├── graphql/
│   ├── queries/
│   ├── mutations/
│   └── subscriptions/
├── hooks/
│   ├── useFocus.js
│   └── useGraphQL.js
└── ...
```

---

## 🎯 Success Criteria
- [ ] Users can create custom focuses
- [ ] GraphQL server integrated and working
- [ ] Real data flowing through components
- [ ] Role-based data filtering working
- [ ] Focus persistence working
- [ ] No breaking changes to existing functionality
