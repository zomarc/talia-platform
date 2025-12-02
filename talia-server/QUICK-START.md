# Quick Start Guide

## Development Mode (Recommended - No Compilation Needed!)

**Use this for development** - changes are picked up automatically without recompiling:

```bash
npm run dev
```

Or use the restart script:
```bash
npm run restart
# or
./restart.sh
```

## Production Mode (Requires Compilation)

Only use this when you need the compiled version:

```bash
npm start
```

## Why Dev Mode?

- ✅ **No compilation needed** - `tsx` runs TypeScript directly
- ✅ **Instant restarts** - just save and restart
- ✅ **Same functionality** - works exactly the same as compiled version
- ✅ **Faster development** - no waiting for TypeScript compilation

## Restarting the Server

### Simple restart (dev mode):
```bash
npm run restart
```

### Quick restart (background):
```bash
./restart-server-now.sh
```

### Manual restart:
1. Stop: `pkill -f "tsx src/index.ts"`
2. Start: `npm run dev`

## Available Scripts

- `npm run dev` - Start in dev mode (no compilation)
- `npm run restart` - Restart server (dev mode)
- `npm start` - Compile and start (production mode)
- `npm run compile` - Just compile TypeScript

