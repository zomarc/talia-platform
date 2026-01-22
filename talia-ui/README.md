# Talia UI

Modern React application for Talia data visualization and management.

## Quick Start

```bash
cd talia-ui
npm install
npm run dev
```

Server runs on: `http://localhost:5173`

## Current Status

✅ **Working State:**
- CSS architecture established (external styles, no inline styles)
- Tabulator integrated via npm with standard midnight theme
- Chart.js configured with global theme defaults
- Dev components styled and functional
- Supabase gracefully handles missing env vars (app works without it)

⚠️ **Known Issues:**
- Supabase uses placeholder client when env vars missing (non-blocking)
- Some inline styles remain in Dashboard.jsx (low priority)

## Documentation

### Active Documentation
- **[NEXT-STEPS.md](./NEXT-STEPS.md)** - Development roadmap and immediate next steps
- **[STYLING-GUIDE.md](./STYLING-GUIDE.md)** - Complete styling system guidelines
- **[STYLING-STATUS.md](./STYLING-STATUS.md)** - Current styling migration status
- **[COMPONENT-STANDARDS.md](./src/components/COMPONENT-STANDARDS.md)** - Component development standards
- **[COMPONENT-CREATION-GUIDE.md](./src/components/focus-panels/COMPONENT-CREATION-GUIDE.md)** - Guide for creating new focus panels

### Archived Documentation
See [ARCHIVE-REFERENCE.md](./ARCHIVE-REFERENCE.md) for archived documentation.

## Architecture

### Styling System
- **Single theme** via CSS variables (`src/styles/theme.css`)
- **External CSS classes** (no inline styles)
- **Library standard themes** (Tabulator midnight, Chart.js via config)
- **BEM-style naming** (`.talia-*`, `.dashboard-*`, `.dev-*`)

### Key Libraries
- **Tabulator** (`tabulator-tables@6.3.1`) - Tables with midnight theme
- **Chart.js** - Charts with global theme config
- **Dockview** - Layout management
- **React** - UI framework

### Component Structure
- **Container/Presenter pattern** for data/UI separation
- **Shared libraries** for formatters, column configs, data types
- **Focus panels** for data visualization components

## Development

### Making Changes

1. **Style Changes:**
   - Edit `src/styles/theme.css` for theme variables
   - Edit `src/styles/components.css` for component classes
   - Edit `src/styles/dashboard.css` for Dashboard-specific styles
   - **Never use inline styles**

2. **Adding Components:**
   - Follow `STYLING-GUIDE.md` principles
   - Use CSS classes from `components.css`
   - Reference `VoyageReport` component as example
   - See `COMPONENT-CREATION-GUIDE.md` for focus panels

3. **Environment Variables:**
   - Create `.env` file with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` if using Supabase
   - App works without Supabase (uses placeholder client)

## Project Structure

```
talia-ui/
├── src/
│   ├── components/        # React components
│   │   ├── focus-panels/ # Data visualization panels
│   │   ├── dev/          # Development-only components
│   │   └── shared/       # Shared UI components
│   ├── lib/              # Shared libraries
│   │   ├── tabulatorConfig.js  # Tabulator configuration
│   │   ├── chartConfig.js      # Chart.js configuration
│   │   └── dataTypes/          # Data type definitions
│   ├── styles/           # CSS files
│   │   ├── theme.css           # CSS variables (single source of truth)
│   │   ├── components.css      # Reusable component classes
│   │   ├── dashboard.css       # Dashboard-specific styles
│   │   └── dev-components.css # Dev component styles
│   └── main.jsx          # Application entry point
├── archive/              # Archived documentation and files
└── NEXT-STEPS.md         # Development roadmap
```

## Next Steps

See [NEXT-STEPS.md](./NEXT-STEPS.md) for:
- Immediate priorities
- Known issues and resolutions
- Development workflow
- Technical debt

## License

[Your License Here]
