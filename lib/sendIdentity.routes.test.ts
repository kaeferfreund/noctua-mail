import { expect, test } from "bun:test";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

test("sender identity routes: validation before network, canonical envelope, draft preservation, RSVP, MCP live roles", async () => {
  const { stdout } = await promisify(execFile)(process.execPath, ["--preload", "./lib/testSetupEnv.ts", "./lib/testFixtures/verifySenderIdentity.ts"], {
    cwd: join(dirname(fileURLToPath(import.meta.url)), ".."), env: { ...process.env }, timeout: 110_000, maxBuffer: 10 * 1024 * 1024
  });
  expect(stdout).toContain("PASS sender identity route contracts");
}, 120_000);
