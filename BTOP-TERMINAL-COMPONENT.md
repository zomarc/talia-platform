# Btop Terminal Component

**Date**: January 20, 2025

## Overview

A terminal component has been added to display `btop` system monitor in the Talia UI. This allows you to view real-time system monitoring (CPU, memory, network, processes) from the staging server directly in the web interface.

## Implementation

### Frontend Component
- **Location**: `talia-ui/src/components/focus-panels/BtopTerminal/index.jsx`
- **Technology**: Uses `@xterm/xterm` for terminal emulation
- **Streaming**: Connects via Server-Sent Events (SSE) to `/api/btop/stream`

### Backend SSE Endpoint
- **Location**: `talia-server/src/index.ts`
- **Endpoint**: `/api/btop/stream` (port 4001)
- **Method**: Executes `btop` on staging server host via Docker
- **Access**: Uses Docker socket to run btop in a container with host process access

### Docker Configuration
- **Docker Socket**: Mounted read-only in GraphQL server container
- **Docker CLI**: Installed in GraphQL server container
- **Execution**: Runs btop in an Alpine container with `--pid host` to see host processes

## Usage

### Accessing the Component

1. **Via Test Mode**:
   - Open the UI
   - Click "🧪 TEST MODE" button
   - Select "BtopTerminal" from component selector

2. **Via Dockview** (if implemented):
   - Can be added as a panel in any Dockview layout

### Component Features

- **Real-time Updates**: Streams btop output continuously
- **ANSI Support**: Fully supports btop's color output
- **Responsive**: Adjusts to container size
- **Connection Status**: Shows connection indicator
- **Error Handling**: Displays errors if connection fails

## Technical Details

### How It Works

1. **UI Component**:
   - Initializes xterm.js terminal
   - Connects to `/api/btop/stream` via EventSource (SSE)
   - Displays streamed output in real-time

2. **Backend Endpoint**:
   - Receives SSE connection request
   - Executes `docker run` with Alpine image
   - Installs btop in container
   - Runs btop with `--pid host` to see host processes
   - Streams output to client via SSE

3. **Docker Execution**:
   ```bash
   docker run --rm -i --tty --pid host --network host \
     --env TERM=xterm-256color \
     alpine:latest \
     sh -c 'apk add --no-cache btop && exec btop'
   ```

### Network Flow

```
Browser → UI Container (nginx) → GraphQL Server (Docker) → Docker Socket → Host System (btop)
```

## Requirements

### Staging Server
- Docker socket accessible (`/var/run/docker.sock`)
- GraphQL server container has Docker CLI installed
- btop installed on host (already installed ✅)

### Container Configuration
- Docker socket mounted: `/var/run/docker.sock:/var/run/docker.sock:ro`
- Docker CLI installed in GraphQL server container

## Testing

1. **Verify endpoint is accessible**:
   ```bash
   curl -N http://192.168.1.120:4001/api/btop/stream
   ```

2. **Check Docker socket access**:
   ```bash
   ssh zomarc@192.168.1.120 "docker run --rm alpine:latest echo 'Docker works'"
   ```

3. **Test from UI**:
   - Open UI in browser
   - Navigate to Test Mode
   - Select BtopTerminal component
   - Should see btop interface loading

## Notes

- **Security**: Docker socket is mounted read-only
- **Performance**: Container is created/destroyed per connection
- **Resource Usage**: Each connection spawns a new Alpine container
- **Terminal Size**: Automatically adjusts to container dimensions

## Troubleshooting

### "btop not found" error
- Verify btop is installed: `ssh zomarc@192.168.1.120 "which btop"`
- Check Docker can pull Alpine images

### Connection fails
- Verify GraphQL server is running: `docker compose ps graphql-server`
- Check SSE endpoint: `curl http://localhost:4001/api/btop/stream`
- Check nginx proxy configuration

### Terminal not displaying
- Check browser console for errors
- Verify xterm.js is installed: `npm list @xterm/xterm`
- Check SSE connection in Network tab

---

**Status**: ✅ Implemented and ready for testing
