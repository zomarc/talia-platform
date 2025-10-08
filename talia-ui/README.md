# Talia UI - Business Intelligence Dashboard

A modern, role-based business intelligence dashboard built with React, Dockview, and InstantDB.

## 🚀 Features

- **Role-Based Access Control**: Admin, Manager, User, and Guest roles with different permissions
- **Magic Code Authentication**: Secure email-based authentication system
- **Dynamic Focus Management**: Customizable dashboard layouts and components
- **Real-time Data**: Live updates and real-time business metrics
- **Responsive Design**: Modern, mobile-friendly interface
- **Component Library**: Charts, tables, KPI cards, and more

## 🏗️ Architecture

### **User Management**
- **Authentication**: Magic code email authentication (SSO ready)
- **Roles**: Admin, Manager, User, Guest with granular permissions
- **Personalization**: Theme, style, and layout preferences

### **Focus System**
- **Standard Focuses**: Admin-defined, role-specific layouts
- **User Focuses**: Custom layouts created by users
- **Components**: Charts, tables, widgets with role-based data filtering
- **Layouts**: Drag-and-drop interface with Dockview

### **Data Integration**
- **InstantDB**: User management and authentication
- **GraphQL**: Real-time data fetching and subscriptions
- **Role-based Filtering**: Data access controlled by user roles

## 🛠️ Tech Stack

- **Frontend**: React 19, Vite
- **Layout**: Dockview 4.9.0
- **Database**: InstantDB
- **Charts**: Chart.js
- **Tables**: Tabulator
- **GraphQL**: Apollo Client
- **Deployment**: Netlify

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn

### Installation
```bash
# Clone the repository
git clone https://github.com/rbryer/talia-ui.git
cd talia-ui

# Install dependencies
npm install

# Start development server
npm run dev
```

### Environment Setup
1. Set up InstantDB project
2. Configure GraphQL server endpoint
3. Set up authentication credentials

## 📁 Project Structure

```
src/
├── components/          # React components
│   ├── focus-panels/   # Dashboard panel components
│   ├── LandingPage.jsx # Authentication page
│   └── UserProfile.jsx # User management
├── contexts/           # React contexts
│   └── AuthContext.jsx # Authentication context
├── data/              # Data configuration
│   └── focusLayouts.js # Focus layout definitions
├── lib/               # Utilities and configurations
│   └── db.js          # Database configuration
└── main.jsx           # Application entry point
```

## 🔧 Development

### Available Scripts
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

### Branching Strategy
- `main` - Production releases
- `development` - Integration branch
- `feature/*` - Feature development
- `hotfix/*` - Critical fixes

## 🚀 Deployment

The application is deployed on Netlify at [taliahub.com](https://taliahub.com).

### Deployment Process
1. Push to `development` branch
2. Netlify automatically builds and deploys
3. Test on staging environment
4. Merge to `main` for production release

## 📋 Roadmap

- [ ] **Focus Management**: User custom focus creation
- [ ] **GraphQL Integration**: Real-time data connections
- [ ] **Advanced Analytics**: More chart types and metrics
- [ ] **SSO Integration**: Enterprise authentication
- [ ] **Mobile App**: React Native version
- [ ] **API Documentation**: Comprehensive API docs

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is proprietary software. All rights reserved.

## 🆘 Support

For support and questions, please contact the development team.

---

**Talia UI** - Empowering business intelligence through modern, role-based dashboards.