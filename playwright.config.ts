import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  workers: process.env.CI ? 2 : undefined,
  retries: process.env.CI ? 1 : 0,
  timeout: 120_000,
  use: {
    baseURL: "http://localhost:3099",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "E2E_MODE=1 PORT=3099 npm run build && E2E_MODE=1 PORT=3099 node dist/server/index.js",
    url: "http://localhost:3099/api/health",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
