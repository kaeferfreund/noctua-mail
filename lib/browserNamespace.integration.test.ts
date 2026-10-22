import { test, expect } from "bun:test";
import { spawnSync } from "node:child_process";

test("browser SSE cannot publish changed UIDVALIDITY without invalidating rows, watermarks and move refs", () => {
  const result = spawnSync(process.execPath, ["scripts/verifyBrowserNamespace.test.fixture.ts"], {
    cwd: process.cwd(), env: process.env, encoding: "utf8", timeout: 10000
  });
  if (result.status !== 0) throw new Error(result.stdout + result.stderr);
  expect(result.stdout).toContain("BROWSER_NAMESPACE_UNIT PASS");
});
