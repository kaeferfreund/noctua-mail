import { expect, test } from "bun:test";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

for (const path of ["direct", "draft-save", "draft-send", "calendar-respond", "mcp-create-draft", "mcp-set-preferences", "mcp-create-identity", "mcp-update-identity"]) {
  test(`final boundary ${path}: mid-request revocation, disabled user/identity, role downgrade and live credentials`, async () => {
    const { stdout } = await promisify(execFile)(process.execPath, ["--preload", "./lib/testSetupEnv.ts", "./lib/testFixtures/verifyOutboundAuthorization.ts", path], {
      cwd: join(dirname(fileURLToPath(import.meta.url)), ".."), env: { ...process.env }, timeout: 110_000, maxBuffer: 10 * 1024 * 1024
    });
    expect(stdout).toContain(`PASS final boundary ${path}`);
  }, 120_000);
}
