#!/usr/bin/env node
/**
 * Generate Supabase JWT tokens for service_role and anon keys
 * Uses the JWT secret from docker-compose.staging.yml
 */

const jwt = require('jsonwebtoken');

// JWT secret from docker-compose.staging.yml
const JWT_SECRET = 'your-super-secret-jwt-token-with-at-least-32-characters-long';

// Generate service role JWT
const serviceRoleToken = jwt.sign(
  {
    role: 'service_role',
    iss: 'supabase',
    aud: 'authenticated'
  },
  JWT_SECRET,
  {
    expiresIn: '1y' // Long expiration for service role
  }
);

// Generate anon JWT
const anonToken = jwt.sign(
  {
    role: 'anon',
    iss: 'supabase',
    aud: 'authenticated'
  },
  JWT_SECRET,
  {
    expiresIn: '1y'
  }
);

console.log('Service Role Key (JWT):');
console.log(serviceRoleToken);
console.log('\nAnon Key (JWT):');
console.log(anonToken);
console.log('\nAdd these to docker-compose.staging.yml:');
console.log(`SUPABASE_SERVICE_ROLE_KEY: ${serviceRoleToken}`);
console.log(`SUPABASE_ANON_KEY: ${anonToken}`);
