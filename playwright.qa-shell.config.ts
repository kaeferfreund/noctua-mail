import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/browser/ui", testMatch: process.env.QA_SHELL_SPEC ?? "qa-shell.spec.ts", fullyParallel: false, workers: 1,
  retries: 0, timeout: 240000, expect: { timeout: 20000 },
  outputDir: ".tmp/qa-shell-browser-results", reporter: "list",
  use: { baseURL: process.env.QA_SHELL_BASE_URL ?? "http://localhost:3799", browserName: "chromium", headless: true,
    screenshot: "off", trace: "off", video: "off" }
});
