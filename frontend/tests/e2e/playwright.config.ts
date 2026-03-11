// ============================================================
// PROJECT      : BRANDPILOT
// FILE         : frontend/tests/e2e/playwright.config.ts
// ============================================================

import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  // Root for test files (relative to this config)
  testDir:  ".",
  testMatch: "**/*.spec.ts",

  // Global timeout per test
  timeout: 30_000,

  // One retry in CI, none locally
  retries: process.env.CI ? 1 : 0,

  // Parallelism
  fullyParallel: true,
  workers: process.env.CI ? 2 : undefined,

  // Reporter
  reporter: process.env.CI
    ? [["github"], ["html", { open: "never" }]]
    : [["list"], ["html", { open: "on-failure" }]],

  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",

    // Capture screenshot only on failure
    screenshot: "only-on-failure",

    // Video recording — retain only on failure in CI
    video: process.env.CI ? "retain-on-failure" : "off",

    // Trace — useful for debugging failures in CI
    trace: "retain-on-failure",

    // Reasonable navigation timeout
    navigationTimeout: 20_000,
    actionTimeout:     10_000,
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "mobile-safari",
      use: { ...devices["iPhone 14"] },
    },
  ],

  // Start the Next.js dev server automatically when running locally
  webServer: process.env.CI
    ? undefined
    : {
        command: "npm run dev",
        url:     "http://localhost:3000",
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
