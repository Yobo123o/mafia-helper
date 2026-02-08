import { defineConfig } from "@playwright/test";

const baseURL = process.env.PW_BASE_URL || "http://127.0.0.1:3000";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 30_000,
  use: {
    baseURL,
    trace: "retain-on-failure",
  },
  webServer: process.env.PW_BASE_URL
    ? undefined
    : {
        command: "npm run dev -- --port 3000",
        url: "http://127.0.0.1:3000",
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
