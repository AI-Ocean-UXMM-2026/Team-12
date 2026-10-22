import { defineConfig, devices } from "@playwright/test";
import { existsSync } from "node:fs";
import "dotenv/config";
const localChrome = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const executablePath =
  process.env.PLAYWRIGHT_EXECUTABLE_PATH ??
  (process.platform === "win32" && existsSync(localChrome)
    ? localChrome
    : undefined);
export default defineConfig({
  testDir: "./tests/e2e",
  use: {
    baseURL: process.env.APP_BASE_URL ?? "http://localhost:3000",
    trace: "off",
    launchOptions: { executablePath },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "node node_modules/next/dist/bin/next dev --hostname localhost",
    url: "http://localhost:3000/api/health",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
