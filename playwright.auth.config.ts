import { defineConfig } from "@playwright/test";
export default defineConfig({
  outputDir:process.env.AUTH_BROWSER_OUTPUT_DIR ?? ".tmp/auth-browser-results",
  testDir:"./tests/browser/auth", fullyParallel:false, workers:1, retries:0, timeout:60000,
  reporter:"list", use:{baseURL:"http://localhost:3784",browserName:"chromium",headless:true,
    screenshot:"off",trace:"off",video:"off"},
  // The runner owns a fresh server and data directory. Never attach to a user's server.
});
