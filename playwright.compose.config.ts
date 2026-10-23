import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/browser/compose", testMatch: "qa-compose.spec.ts", fullyParallel: false, workers: 1,
  retries: 0, timeout: 240000, expect: { timeout: 20000 },
  outputDir: ".tmp/compose-browser-results", reporter: "list",
  use: { baseURL: process.env.COMPOSE_QA_BASE_URL ?? "http://localhost:3880", browserName: "chromium", headless: true,
    locale: "en-GB", screenshot: "off", trace: "off", video: "off" }
});
