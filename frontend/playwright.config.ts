import { defineConfig } from '@playwright/test'

/**
 * Two targets:
 *  - default: Vite dev server with the MSW mock API on (fast, no database).
 *  - E2E_TARGET=real: Flask serving the built SPA (`npm run build` first) over a SQL Server
 *    scratch database with the SQL services on. Needs DATABASE=<scratch db>, the SQL_* env vars,
 *    USE_SQL_SERVICES=1 and the seeded test users (scripts/seed_users.py).
 * Locally it uses the installed Chrome; CI installs Chromium and sets E2E_CHANNEL=''.
 */
const real = process.env.E2E_TARGET === 'real'
const channel = process.env.E2E_CHANNEL ?? 'chrome'

export default defineConfig({
  testDir: './e2e',
  // Accessibility sweeps run on the mock target only (they do not need real data).
  testIgnore: real ? ['**/a11y.spec.ts'] : [],
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: real ? 'http://127.0.0.1:5000' : 'http://127.0.0.1:5173',
    channel: channel || undefined,
    trace: 'retain-on-failure',
  },
  webServer: real
    ? {
        command: 'python -m flask --app app run --port 5000',
        cwd: '..',
        url: 'http://127.0.0.1:5000/api/test',
        reuseExistingServer: !process.env.CI,
        timeout: 60_000,
        env: { USE_SQL_SERVICES: '1' },
      }
    : {
        command: 'npm run dev -- --host 127.0.0.1',
        url: 'http://127.0.0.1:5173',
        reuseExistingServer: !process.env.CI,
        timeout: 60_000,
        env: { VITE_MOCK_API: 'true' },
      },
})
