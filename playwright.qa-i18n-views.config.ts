import { defineConfig } from "@playwright/test";
import base from "./playwright.qa-shell.config";

export default defineConfig(base, {
  testMatch: "qa-i18n-views.spec.ts",
  outputDir: ".tmp/qa-i18n-views-browser-results"
});
