import { ApolloServer } from '@apollo/server';
import { startStandaloneServer } from '@apollo/server/standalone';
import express from 'express';
import cors from 'cors';
import { typeDefs } from './api/schema.js';
import { resolvers } from './api/resolvers.js';
import { syncEventEmitter } from './services/sync-event-emitter.js';

async function startServer() {
  // Create Apollo Server
  const server = new ApolloServer({ 
    typeDefs, 
    resolvers,
    // Enable GraphQL Playground in development
    introspection: true
  });

  // Start standalone server for GraphQL
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
      if (event.tableName === tableName) {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
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

  // Start Express server for SSE on port 4001
  const SSE_PORT = 4001;
  app.listen(SSE_PORT, () => {
    console.log(`🚀  Talia GraphQL Server ready at: ${url}`);
    console.log(`🎮  GraphQL Playground: ${url}`);
    console.log(`📡  SSE Stream endpoint: http://localhost:${SSE_PORT}/api/sync/stream/:tableName`);
    console.log(`📚  Enhanced with Focus Management & Role-based Access`);
    console.log(`🔐  Current user: admin@celestyal.com (ADMIN)`);
  });
}

startServer().catch((error) => {
  console.error('❌ Failed to start server:', error);
  process.exit(1);
});
