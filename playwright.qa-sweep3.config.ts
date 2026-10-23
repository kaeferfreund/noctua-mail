import { defineConfig } from "@playwright/test";
import base from "./playwright.qa-shell.config";

// QA sweep 3 fixes: same harness, budgets and serial execution as the QA shell suite.
export default defineConfig(base, {
  testDir: "./tests/browser/ui",
  testMatch: /qa-sweep3-[a-z]+\.spec\.ts/,
  outputDir: ".tmp/qa-sweep3-browser-results"
});
