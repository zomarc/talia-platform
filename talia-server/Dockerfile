FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev dependencies for build)
RUN npm install

# Copy TypeScript config
COPY tsconfig.json ./

# Copy source code
COPY src/ ./src/

# Copy sync config files (needed at runtime)
COPY sync.config.json ./
COPY sync-cli.js ./

# Build TypeScript
RUN npm run compile

# Copy sync files to dist (needed at runtime)
RUN cp sync.config.json dist/ && cp sync-cli.js dist/ 2>/dev/null || true

# Remove dev dependencies to reduce image size
RUN npm prune --production

# Expose ports
EXPOSE 4000 4001

# Start server
CMD ["node", "dist/index.js"]
