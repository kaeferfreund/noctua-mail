import { defineConfig } from "@playwright/test";
import base from "../../playwright.qa-shell.config";
export default defineConfig(base, { testDir: ".", testMatch: /review-.*\.spec\.ts/, outputDir: "./results", use: { ...base.use, actionTimeout: 30000 } });
