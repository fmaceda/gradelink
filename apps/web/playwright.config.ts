import { defineConfig } from "@playwright/test";

// The real thing end to end: the built SPA served by the built API, with its helmet CSP, on a
// port of its own so a running dev server doesn't interfere. Needs local Postgres
// (`docker compose up -d`). Not in CI until TASK-021.
const PORT = 3100;
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  // One worker: every test signs up from 127.0.0.1, and Better Auth limits that per IP.
  workers: 1,
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  reporter: "list",
  use: {
    baseURL: BASE_URL,
    browserName: "chromium",
    // DESIGN.md's phone target.
    viewport: { width: 360, height: 740 },
    isMobile: true,
    hasTouch: true,
    trace: "retain-on-failure",
  },
  webServer: {
    // Run from the repo root. The root .env supplies DATABASE_URL and BETTER_AUTH_SECRET; the
    // variables below win over it, because Node's --env-file never overrides the environment.
    command:
      "npm run build && node --env-file-if-exists=.env --import ./apps/web/e2e/support/stub-breach-check.mjs apps/api/dist/index.js",
    cwd: "../..",
    url: `${BASE_URL}/api/auth/get-session`,
    reuseExistingServer: false,
    timeout: 180_000,
    stdout: "ignore",
    stderr: "pipe",
    env: { PORT: String(PORT), BETTER_AUTH_URL: BASE_URL, NODE_ENV: "development" },
  },
});
