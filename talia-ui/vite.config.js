import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Base path for deployment - set via environment variable or default to root
  // For celestyal path: VITE_BASE_PATH=/celestyal
  base: process.env.VITE_BASE_PATH || '/',
  // Build configuration
  build: {
    // Disable chunk size warnings - not needed for development
    chunkSizeWarningLimit: Infinity,
    // Minification only happens in production builds (npm run build)
    // Dev mode (npm run dev) does NOT minify
  },
  server: {
    host: true, // Allow external connections
    allowedHosts: [
      'proud-books-brake.loca.lt',
      'petite-baths-shave.loca.lt',
      'taliahub.com',
      'www.taliahub.com',
      'talia.ngrok.dev',
      'kelley-resistless-sniffingly.ngrok-free.dev',
      '*.ngrok-free.dev',
      '*.ngrok-free.app',
      '*.ngrok.io',
      '*.ngrok.app',
      '*.ngrok.dev'
    ],
    // Proxy API requests to local backend (keeps backend local-only)
    // IMPORTANT: More specific routes must come FIRST
    proxy: {
      // SSE (Server-Sent Events) proxy for sync progress - MUST come before /api
      '/api/sync/stream': {
        target: 'http://localhost:4001',
        changeOrigin: true,
        ws: true, // WebSocket support for SSE
      },
      // SSE proxy for btop terminal - MUST come before /api
      '/api/btop/stream': {
        target: 'http://localhost:4001',
        changeOrigin: true,
        ws: true, // WebSocket support for SSE
      },
      // Handle base path for SSE proxy - MUST come before /celestyal/api
      '/celestyal/api/sync/stream': {
        target: 'http://localhost:4001',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/celestyal\/api\/sync\/stream/, '/api/sync/stream'),
        ws: true,
      },
      // Handle base path for btop SSE proxy
      '/celestyal/api/btop/stream': {
        target: 'http://localhost:4001',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/celestyal\/api\/btop\/stream/, '/api/btop/stream'),
        ws: true,
      },
      // General API proxy (GraphQL) - comes after SSE routes
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '') // /api/graphql -> /graphql
      },
      // Handle base path for API proxy
      '/celestyal/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/celestyal\/api/, '') // /celestyal/api/graphql -> /graphql
      }
    }
  }
})
