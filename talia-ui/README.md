# Talia UI

Revenue Management Interface - React frontend for Talia Platform.

## Quick Start

```bash
# Install dependencies
npm install

# Start development server (runs on port 5173)
npm run dev

# Build for production
npm run build
```

## Features

- **React 18**: Modern React with hooks
- **Vite**: Fast development and build tool
- **Dockview**: Tabbed panel layout system
- **Apollo Client**: GraphQL data fetching
- **Tabulator**: Advanced table rendering
- **InstantDB**: Focus management (archived)

## Architecture

### Active Components

- **src/components/**: React components
- **src/contexts/**: React contexts (Auth)
- **src/hooks/**: Custom React hooks
- **src/lib/**: Client libraries (Apollo, DB)
- **src/services/**: Business logic services
- **src/Dashboard.jsx**: Main dashboard layout
- **src/App.jsx**: Application entry point

### Archived Components

- **archive/docs/**: Superseded documentation
- **archive/experiments/**: Test HTML files and experiments

## Development

### Project Structure

```
talia-ui/
├── src/
│   ├── components/        # React components
│   │   ├── focus-panels/  # Panel components
│   │   └── admin/         # Admin components
│   ├── contexts/          # React contexts
│   ├── hooks/             # Custom hooks
│   ├── lib/               # Client libraries
│   ├── services/          # Business logic
│   ├── Dashboard.jsx      # Main layout
│   └── App.jsx            # Entry point
├── public/                # Static assets
├── dist/                  # Build output (generated)
└── package.json
```

### Key Components

- **Dashboard.jsx**: Main Dockview layout
- **SimpleTable**: Test component for Supabase direct queries
- **FocusPanel**: Panel base component
- **SailingByCabinCategory**: Cabin availability visualization

## GraphQL Integration

The UI connects to the GraphQL server on `http://localhost:4000/graphql`.

Apollo Client configuration is in `src/lib/apolloClient.js`.

## Local Data (Deprecated)

Historical JSON data files have been renamed with `.deprecated` extension:
- `local_data/*.json.deprecated`

Current data source is Supabase via GraphQL API.

## Build & Deploy

```bash
# Development
npm run dev

# Production build
npm run build

# Preview production build
npm run preview
```

## Scripts

- `npm run dev`: Start Vite dev server with HMR
- `npm run build`: Build for production
- `npm run preview`: Preview production build
- `npm run lint`: Run ESLint

## Troubleshooting

### Cannot connect to GraphQL server

Ensure `talia-server` is running on port 4000:
```bash
cd ../talia-server
npm start
```

### HMR not working

Clear Vite cache: `rm -rf node_modules/.vite`

### Build errors

Clear node_modules and reinstall:
```bash
rm -rf node_modules package-lock.json
npm install
```

## License

UNLICENSED
