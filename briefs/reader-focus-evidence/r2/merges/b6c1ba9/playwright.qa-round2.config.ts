import { defineConfig } from "@playwright/test";
import base from "./playwright.qa-shell.config";

// Use the same budgets and serial execution as the established QA shell suite.
export default defineConfig(base, {
  testDir: "./tests/browser",
<<<<<<< b6c1ba9
  testMatch: /(?:qa-shell|qa-compose|qa-unread-count|qa-translation|qa-admin-breakpoint|qa-admin-self-grant)\.spec\.ts/,
=======
  testMatch: /(?:qa-shell|qa-compose|qa-unread-count|qa-translation|qa-admin-breakpoint|qa-reader-focus)\.spec\.ts/,
>>>>>>> HEAD
  outputDir: ".tmp/qa-round2-browser-results"
});
