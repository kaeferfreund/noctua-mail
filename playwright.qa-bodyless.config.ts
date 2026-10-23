import { defineConfig } from "@playwright/test";
import base from "./playwright.qa-shell.config";

// Real-HTTP bodyless command contract; same budgets and serial execution as the QA shell suite.
export default defineConfig(base, {
  testMatch: "qa-bodyless-commands.spec.ts",
  outputDir: ".tmp/qa-bodyless-browser-results"
});
