/* eslint-env node */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { resolve as pathResolve } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const appVersion = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf-8')
).version

const buildTime =
  globalThis.process?.env?.VITE_BUILD_TIME ||
  new Date().toISOString()

/** HTML meta + dist JSON for ops probes — avoids mistaking IP fragments in bundles for semver. */
function taliaReleaseProbePlugin(version) {
  let outDir = 'dist'
  return {
    name: 'talia-release-probe',
    configResolved(config) {
      outDir = pathResolve(config.root, config.build.outDir)
    },
    transformIndexHtml(html) {
      if (/name=["']talia-app-version["']/i.test(html)) {
        return html
      }
      const tag = `    <meta name="talia-app-version" content="${version}" />\n`
      return html.replace('<head>', `<head>\n${tag}`)
    },
    writeBundle() {
      mkdirSync(outDir, { recursive: true })
      const payload = `${JSON.stringify({ taliaAppVersion: version })}\n`
      writeFileSync(pathResolve(outDir, 'talia-app-version.json'), payload, 'utf8')
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), taliaReleaseProbePlugin(appVersion)],
  optimizeDeps: {
    // Keep these pre-bundled deterministically to avoid transient
    // 504 errors from /node_modules/.vite/deps during dev reloads.
    include: ['react', 'react-dom', 'react-dom/client', 'leaflet', 'react-leaflet'],
    force: true
  },
  define: {
    // Talia product semver only (from talia-ui/package.json). Dependency versions stay in lockfiles.
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(appVersion),
    'import.meta.env.VITE_BUILD_TIME': JSON.stringify(buildTime),
  },
  // Base path for deployment - set via environment variable or default to root
  // For celestyal path: VITE_BASE_PATH=/celestyal
  base: globalThis.process?.env?.VITE_BASE_PATH || '/',
  // Build configuration
  build: {
    // Disable chunk size warnings - not needed for development
    chunkSizeWarningLimit: Infinity,
    // Minification only happens in production builds (npm run build)
    // Dev mode (npm run dev) does NOT minify
  },
  server: {
    port: 5173,
    strictPort: true,
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
      // Public image proxy endpoint
      '/api/public-image': {
        target: 'http://localhost:4001',
        changeOrigin: true,
      },
      '/api/public-itinerary-catalog': {
        target: 'http://localhost:4001',
        changeOrigin: true,
      },
      '/api/public-image-pool': {
        target: 'http://localhost:4001',
        changeOrigin: true,
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
      // Handle base path for public image proxy
      '/celestyal/api/public-image': {
        target: 'http://localhost:4001',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/celestyal\/api\/public-image/, '/api/public-image'),
      },
      '/celestyal/api/public-itinerary-catalog': {
        target: 'http://localhost:4001',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/celestyal\/api\/public-itinerary-catalog/, '/api/public-itinerary-catalog'),
      },
      '/celestyal/api/public-image-pool': {
        target: 'http://localhost:4001',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/celestyal\/api\/public-image-pool/, '/api/public-image-pool'),
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
