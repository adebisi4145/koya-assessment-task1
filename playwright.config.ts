import { config } from "dotenv";
import { defineConfig } from "@playwright/test";

config({ path: ".env.local", quiet: true });

const baseURL = process.env.API_URL || "http://localhost:3000";

export default defineConfig({
  testDir: "tests/e2e",
  // Specs call POST /reset on a shared database, so they must not overlap.
  workers: 1,
  fullyParallel: false,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL,
    // Uses the locally installed Chrome; no browser download needed.
    channel: "chrome",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "npm run dev",
    url: baseURL,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
