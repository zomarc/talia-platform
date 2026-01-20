import dotenv from 'dotenv';
import { ApolloServer } from '@apollo/server';
import { startStandaloneServer } from '@apollo/server/standalone';
import express from 'express';
import cors from 'cors';
import { typeDefs } from './api/schema.js';
import { resolvers } from './api/resolvers.js';
import { syncEventEmitter } from './services/sync-event-emitter.js';

// Load environment variables from .env file
dotenv.config();

async function startServer() {
  // Create Apollo Server
  const server = new ApolloServer({ 
    typeDefs, 
    resolvers,
    // Enable GraphQL Playground in development
    introspection: true
  });

  // Start standalone server for GraphQL
  // Note: CORS is handled by Apollo Server v5 automatically
  const { url } = await startStandaloneServer(server, {
    listen: { port: 4000 },
    context: async ({ req }) => {
      // In a real app, you would extract user information from the request
      // For now, we'll return a mock user context
      return {
        user: {
          id: '1',
          role: 'ADMIN',
          email: 'admin@celestyal.com'
        }
      };
    }
  });

  // Create Express app for SSE endpoint (on same port via proxy or separate port)
  // For now, use port 4001 to avoid conflicts
  const app = express();
  
  // CORS middleware
  app.use(cors({
    origin: '*',
    credentials: true
  }));
  
  app.use(express.json());

  // SSE endpoint for sync events
  app.get('/api/sync/stream/:tableName', (req, res) => {
    const { tableName } = req.params;
    
    // Set headers for SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Cache-Control');

    // Send initial connection message
    res.write(`data: ${JSON.stringify({ type: 'connected', tableName, timestamp: new Date().toISOString() })}\n\n`);

    // Subscribe to sync events for this table
    const eventHandler = (event) => {
      // DEBUG: Log all events to see what's being received
      console.log(`[SSE DEBUG] Event received for tableName=${tableName}:`, {
        eventTableName: event.tableName,
        eventType: event.type,
        matches: event.tableName === tableName
      });
      
      if (event.tableName === tableName) {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      } else {
        console.log(`[SSE DEBUG] Event tableName mismatch: expected ${tableName}, got ${event.tableName}`);
      }
    };

    syncEventEmitter.subscribe(tableName, eventHandler);

    // Handle client disconnect
    req.on('close', () => {
      syncEventEmitter.off(`sync-${tableName}`, eventHandler);
      res.end();
    });

    // Keep connection alive with periodic ping
    const keepAliveInterval = setInterval(() => {
      res.write(`: keepalive\n\n`);
    }, 30000); // Every 30 seconds

    req.on('close', () => {
      clearInterval(keepAliveInterval);
    });
  });

  // SSE endpoint for btop terminal
  // Executes btop on the host via docker exec (requires docker socket access)
  app.get('/api/btop/stream', (req, res) => {
    // Set headers for SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Cache-Control');

    // Import child_process
    import('child_process').then(({ spawn }) => {
      // Try to execute btop via docker exec on host
      // This assumes docker socket is accessible or we're in a privileged container
      // Alternative: Use docker exec to run in a container with btop installed
      // For now, try to execute directly - if btop is installed in container
      let btopProcess;

      // Check if we're in Docker (check for /.dockerenv)
      import('fs').then((fs) => {
        const isDocker = fs.existsSync('/.dockerenv');
        
        if (isDocker) {
          // In Docker: Use docker run to execute btop with host process access
          // This runs btop in a container with access to host's process tree
          console.log('Running btop via docker (Dockerized environment)...');
          
          // Run btop in alpine container with host PID namespace to see host processes
          // Use -t flag to allocate a TTY (btop requires it), but don't use -i (interactive)
          // stdin is ignored, so we don't need -i
          // Set COLUMNS and LINES environment variables for proper terminal size
          btopProcess = spawn('docker', [
            'run', '--rm', '-t',
            '--pid', 'host',
            '--network', 'host',
            '--env', 'TERM=xterm-256color',
            '--env', 'LANG=en_US.UTF-8',
            '--env', 'LC_ALL=en_US.UTF-8',
            '--env', 'COLUMNS=120',
            '--env', 'LINES=30',
            'alpine:latest',
            'sh', '-c', 'apk add --no-cache btop > /dev/null 2>&1 && export LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 COLUMNS=120 LINES=30 && exec btop --force-utf'
          ], {
            env: { ...process.env, TERM: 'xterm-256color', LANG: 'en_US.UTF-8', LC_ALL: 'en_US.UTF-8', COLUMNS: '120', LINES: '30' },
            stdio: ['ignore', 'pipe', 'pipe']
          });
        } else {
          // Not in Docker (local dev): Execute btop using script to create a pseudo-TTY
          // btop requires a TTY, so we use 'script' to create one
          console.log('Running btop directly (local environment)...');
          // macOS script command format: script [-q] file command
          // -q: quiet mode (suppress start/stop messages)
          // The output file is required but we capture stdout/stderr via pipes
          // For macOS, we need to detect and use the correct format
          btopProcess = spawn('script', [
            '-q',
            '/dev/null',
            'btop', '--force-utf'
          ], {
            env: { ...process.env, TERM: 'xterm-256color', LANG: 'en_US.UTF-8', LC_ALL: 'en_US.UTF-8' },
            stdio: ['ignore', 'pipe', 'pipe']
          });
        }

        // Stream stdout to client
        btopProcess.stdout.on('data', (data) => {
          res.write(`data: ${JSON.stringify({ type: 'output', data: data.toString() })}\n\n`);
        });

        // Stream stderr to client
        btopProcess.stderr.on('data', (data) => {
          const errorText = data.toString();
          res.write(`data: ${JSON.stringify({ type: 'output', data: errorText })}\n\n`);
        });

        btopProcess.on('error', (error) => {
          console.error('btop process error:', error);
          // If btop not found, provide helpful message
          if (error.message.includes('ENOENT') || error.message.includes('spawn')) {
            const errorMsg = isDocker 
              ? 'btop not found. In Dockerized environments, btop runs via docker run with host access.'
              : 'btop not found. Please install btop on your local machine.';
            res.write(`data: ${JSON.stringify({ type: 'error', message: errorMsg })}\n\n`);
          } else {
            res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
          }
        });

        btopProcess.on('close', (code) => {
          res.write(`data: ${JSON.stringify({ type: 'closed', code })}\n\n`);
          res.end();
        });

        // Handle client disconnect
        req.on('close', () => {
          if (btopProcess) {
            btopProcess.kill();
          }
          res.end();
        });
      }).catch((fsError) => {
        // Fallback: try executing btop directly
        const btopProcess = spawn('btop', [], {
          env: { ...process.env, TERM: 'xterm-256color' },
          stdio: ['ignore', 'pipe', 'pipe']
        });

        btopProcess.stdout.on('data', (data) => {
          res.write(`data: ${JSON.stringify({ type: 'output', data: data.toString() })}\n\n`);
        });

        btopProcess.stderr.on('data', (data) => {
          res.write(`data: ${JSON.stringify({ type: 'output', data: data.toString() })}\n\n`);
        });

        btopProcess.on('error', (error) => {
          res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
        });

        req.on('close', () => {
          btopProcess.kill();
          res.end();
        });
      });
    }).catch((error) => {
      console.error('Error setting up btop stream:', error);
      res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
      res.end();
    });
  });

  // Start Express server for SSE on port 4001
  const SSE_PORT = 4001;
  app.listen(SSE_PORT, () => {
    console.log(`🚀  Talia GraphQL Server ready at: ${url}`);
    console.log(`🎮  GraphQL Playground: ${url}`);
    console.log(`📡  SSE Stream endpoint: http://localhost:${SSE_PORT}/api/sync/stream/:tableName`);
    console.log(`📚  Enhanced with Focus Management & Role-based Access`);
    console.log(`🔐  Current user: admin@celestyal.com (ADMIN)`);
    console.log(`🔄  Running in watch mode - changes will auto-reload`);
  });
}

startServer().catch((error) => {
  console.error('❌ Failed to start server:', error);
  process.exit(1);
});
