import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/browser/ui", testMatch: "qa-shell.spec.ts", fullyParallel: false, workers: 1,
  retries: 0, timeout: 240000, expect: { timeout: 20000 },
  outputDir: ".tmp/qa-shell-browser-results", reporter: "list",
  use: { baseURL: "http://localhost:3855", browserName: "chromium", headless: true,
    screenshot: "off", trace: "off", video: "off" }
});
