import { defineConfig } from "@playwright/test";
import { qaActionTimeouts } from "./tests/browser/qaActionTimeouts";

// Run against the explicitly started app and synthetic fixture on the assigned ports.
export default defineConfig({
  testDir: "./tests/browser/ui", testMatch: "sync-folder-account.spec.ts", workers: 1,
  retries: 0, timeout: 180000, expect: { timeout: 30000 }, reporter: "list",
  outputDir: ".tmp/sync-folder-browser-results",
  use: { ...qaActionTimeouts, baseURL: process.env.SYNC_FOLDER_BASE_URL ?? "http://127.0.0.1:3845",
    browserName: "chromium", headless: true, screenshot: "off", trace: "off", video: "off" }
});
