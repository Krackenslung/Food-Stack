/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Dev: Vite on :5173 proxies /api to the Flask server on :5000.
// Build: outputs frontend/dist (served by Flask in production).
export default defineConfig({
  plugins: [react()],
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
    exclude: ['e2e/**', 'node_modules/**', 'dist/**'],
    env: { VITE_API_BASE_URL: 'http://localhost:3000/api', VITE_MOCK_API: 'false' },
  },
})
