import { defineConfig } from "@playwright/test";
import base from "./playwright.qa-shell.config";

// Use the same budgets and serial execution as the established QA shell suite.
export default defineConfig(base, {
  testDir: "./tests/browser",
  testMatch: /(?:qa-shell|qa-compose|qa-unread-count|qa-translation|qa-admin-breakpoint)\.spec\.ts/,
  outputDir: ".tmp/qa-round2-browser-results"
});
