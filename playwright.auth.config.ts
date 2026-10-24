import { defineConfig } from "@playwright/test";
import { qaActionTimeouts } from "./tests/browser/qaActionTimeouts";
export default defineConfig({
  outputDir:process.env.AUTH_BROWSER_OUTPUT_DIR ?? ".tmp/auth-browser-results",
  testDir:"./tests/browser/auth", fullyParallel:false, workers:1, retries:0, timeout:240000,
  expect: { timeout: 20000 },
  reporter:"list", use:{...qaActionTimeouts,baseURL:process.env.AUTH_BROWSER_BASE_URL ?? `http://localhost:${process.env.AUTH_BROWSER_PORT ?? 3799}`,browserName:"chromium",headless:true,locale:"en-GB",
    screenshot:"off",trace:"off",video:"off"},
  // The runner owns a fresh server and data directory. Never attach to a user's server.
});
