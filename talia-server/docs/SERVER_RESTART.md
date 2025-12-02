# Server Restart Functionality

## Overview

The Talia GraphQL server now supports restarting from the UI via a GraphQL mutation.

## Implementation

### GraphQL Mutation

```graphql
mutation {
  restartServer
}
```

### How It Works

1. **UI Request**: User clicks "Restart Server" button in Data Management page
2. **GraphQL Mutation**: UI sends `restartServer` mutation
3. **Server Response**: Server responds with `true` and schedules restart
4. **Graceful Shutdown**: Server waits 2 seconds for response to be sent, then exits with code 0
5. **Auto-Restart**: If using `npm run start:watch`, server automatically restarts

## Usage

### Manual Restart (Current)
```bash
cd talia-server
npm start
```

### Auto-Restart Mode (Recommended for Development)
```bash
cd talia-server
npm run start:watch
```

This uses the `restart-server.sh` script which automatically restarts the server when it exits with code 0.

### Development Mode with Auto-Reload
```bash
cd talia-server
npm run dev:watch
```

This uses nodemon to watch for file changes and automatically recompile and restart.

## UI Integration

The restart button is located in the **Data Management** page under **Server Status**:

- **When Server is Online**: Shows "🔄 Restart Server" button
- **When Server is Offline**: Shows "▶️ Start Server" button (manual start required)

## Notes

- The restart mutation gives a 2-second delay to ensure the GraphQL response is sent before shutdown
- For production, consider using a process manager like PM2 for more robust restart handling
- The `restart-server.sh` script handles automatic restarts when server exits normally

## Troubleshooting

If restart doesn't work:
1. Check server logs: `tail -f /tmp/talia-server.log`
2. Verify server is running: `ps aux | grep "node.*dist/index.js"`
3. Check GraphQL endpoint: `curl http://localhost:4000/graphql`
4. Use manual restart: `npm start` in `talia-server` directory

