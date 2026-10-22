import { expect, test } from "bun:test";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
test("real IMAP/SMTP: direct, draft, calendar; retry, UID fallback, failures and shared Sent", async () => {
  const { stdout } = await promisify(execFile)(process.execPath, ["--preload", "./lib/testSetupEnv.ts", "./lib/testFixtures/verifyCollaborationSend.ts"], {
    cwd: join(dirname(fileURLToPath(import.meta.url)), ".."), env: { ...process.env }, timeout: 110_000, maxBuffer: 10 * 1024 * 1024
  });
  const results = stdout.split("\n").filter(line => line.startsWith("PASS "));
  console.log(results.join("\n"));
  expect(stdout).toContain("PASS 19 fixture send scenarios");
}, 120_000);
