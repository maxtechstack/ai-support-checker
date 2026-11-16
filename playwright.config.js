// Runs against dist/ served with the same CSP as closewellhq.com/check/ (scripts/serve.js).
// Uses the installed Google Chrome, the browser the spec's timing target is set for.
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "test/e2e",
  timeout: 60_000,
  workers: 1,
  reporter: "list",
  use: { baseURL: "http://127.0.0.1:8788", channel: "chrome", headless: true },
  webServer: { command: "node scripts/serve.js --port 8788", url: "http://127.0.0.1:8788/check/", reuseExistingServer: true },
});
