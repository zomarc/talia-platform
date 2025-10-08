// Netlify Function wrapper for Talia GraphQL Server
// This allows the GraphQL server to run as a serverless function on Netlify

import { ApolloServer } from '@apollo/server';
import { startServerAndCreateLambdaHandler } from '@as-integrations/aws-lambda';
import { typeDefs } from '../../talia-graphql-server/src/schema.js';
import { resolvers } from '../../talia-graphql-server/src/resolvers.js';

// Create Apollo Server instance
const server = new ApolloServer({
  typeDefs,
  resolvers,
  introspection: true, // Enable in production for debugging
});

// Create the Lambda handler
export const handler = startServerAndCreateLambdaHandler(server, {
  context: async ({ event }) => {
    // Extract user information from headers or event
    const userRole = event.headers['x-user-role'] || 'GUEST';
    const userId = event.headers['x-user-id'] || 'anonymous';
    
    return {
      user: {
        id: userId,
        role: userRole,
        email: event.headers['x-user-email'] || 'guest@celestyal.com'
      }
    };
  }
});

// For local development
export default handler;
