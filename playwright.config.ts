import { defineConfig, devices } from "@playwright/test";

/**
 * E2E suite (T0.4+): drives the real app (`npm run dev`) against the real Supabase project, so it
 * requires a complete `.env` (see README). Excluded from `npm test`; run with `npm run test:e2e`.
 */
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  // Generous: the first navigation of a run may pay Turbopack's cold compile of each route.
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
    // The invite flow's "Copiar" button uses the Clipboard API.
    permissions: ["clipboard-read", "clipboard-write"],
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
