import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // Allow external connections
    allowedHosts: [
      'proud-books-brake.loca.lt',
      'petite-baths-shave.loca.lt',
      'taliahub.com',
      'www.taliahub.com'
    ],
    // Proxy API requests to local backend (keeps backend local-only)
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '') // /api/graphql -> /graphql
      }
    }
  }
})
