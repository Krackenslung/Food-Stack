import { defineConfig } from '@playwright/test'

/**
 * E2E runs against the Vite dev server with the MSW mock API on (the real Flask endpoints are not
 * built yet). Locally it uses the installed Chrome; CI installs Chromium and sets E2E_CHANNEL=''.
 */
const channel = process.env.E2E_CHANNEL ?? 'chrome'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://127.0.0.1:5173',
    channel: channel || undefined,
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    env: { VITE_MOCK_API: 'true' },
  },
})
