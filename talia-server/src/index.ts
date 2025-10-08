import { ApolloServer } from '@apollo/server';
import { startStandaloneServer } from '@apollo/server/standalone';
import { typeDefs } from './schema.js';
import { resolvers } from './resolvers.js';

async function startServer() {
  const server = new ApolloServer({ 
    typeDefs, 
    resolvers,
    // Enable GraphQL Playground in development
    introspection: true,
    plugins: [
      {
        async requestDidStart() {
          return {
            async willSendResponse(requestContext) {
              // Add CORS headers for development
              if (requestContext.response.http) {
                requestContext.response.http.headers.set('Access-Control-Allow-Origin', '*');
                requestContext.response.http.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
                requestContext.response.http.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
              }
            }
          };
        }
      }
    ]
  });

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

  console.log(`🚀  Talia GraphQL Server ready at: ${url}`);
  console.log(`🎮  GraphQL Playground: ${url}`);
  console.log(`📚  Enhanced with Focus Management & Role-based Access`);
  console.log(`🔐  Current user: admin@celestyal.com (ADMIN)`);
}

startServer().catch((error) => {
  console.error('❌ Failed to start server:', error);
  process.exit(1);
});