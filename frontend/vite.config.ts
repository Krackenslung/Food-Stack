/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import type { Plugin } from 'vite'

/**
 * The legacy static pages (menu.html, cart.html, login.html, signup.html…) still live in this
 * folder until Phase 7 and would shadow the SPA routes of the same name in the dev server.
 * Send every extension-less page request to index.html so React Router owns the routes.
 */
function spaFirst(): Plugin {
  return {
    name: 'foodstack-spa-first',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        const path = (req.url ?? '').split('?')[0]
        const wantsHtml = (req.headers.accept ?? '').includes('text/html')
        if (
          wantsHtml &&
          !path.includes('.') &&
          !path.startsWith('/@') &&
          !path.startsWith('/api')
        ) {
          req.url = '/index.html'
        }
        next()
      })
    },
  }
}

// Dev: Vite on :5173 proxies /api to the Flask server on :5000.
// Build: outputs frontend/dist (served by Flask in production, wired up in a later phase).
export default defineConfig({
  plugins: [react(), spaFirst()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://127.0.0.1:5000',
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    env: { VITE_API_BASE_URL: 'http://localhost:3000/api', VITE_MOCK_API: 'false' },
  },
})
