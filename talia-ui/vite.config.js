import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: [
      'proud-books-brake.loca.lt',
      'petite-baths-shave.loca.lt'
    ]
  }
})
