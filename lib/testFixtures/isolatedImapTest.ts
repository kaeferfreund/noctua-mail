import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { expect, test } from "bun:test";

// Pool unit tests intentionally mock connectImapClient across Bun's module graph.
// Real protocol fixtures need a fresh graph, as the collaboration send tests do.
// Keep the original cases/assertions and the CI 20-second budget in each child.
// The named pass marker comes from the child's JUnit report: Bun omits "(pass)"
// lines from stdout when it detects an AI agent (CLAUDECODE=1, AGENT=1, ...).
const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const escapeXml = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;")
  .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

/**
 * Runs `run` as a real-IMAP test in a child `bun test` of `testFileUrl`
 * (pass `import.meta.url`); `envFlag` marks the child and must be unique per file.
 */
export function isolatedImapTest(testFileUrl: string, envFlag: string, name: string, run: () => Promise<void>) {
  if (process.env[envFlag] === "1") {
    test(name, run);
    return;
  }
  test(name, async () => {
    const pattern = "^" + escapeRegExp(name) + "$";
    const reportDir = await mkdtemp(join(tmpdir(), "isolated-imap-test-"));
    try {
      const report = join(reportDir, "junit.xml");
      const { stdout, stderr } = await promisify(execFile)(process.execPath, [
        "test", "--timeout", "20000", "--test-name-pattern", pattern,
        "--reporter=junit", `--reporter-outfile=${report}`, fileURLToPath(testFileUrl)
      ], { cwd: process.cwd(), env: { ...process.env, [envFlag]: "1" },
        timeout: 20_000, maxBuffer: 10 * 1024 * 1024 });
      const output = stdout + stderr;
      // A self-closing <testcase .../> carries no <failure> or <skipped> child.
      expect(await readFile(report, "utf8"))
        .toMatch(new RegExp(`<testcase name="${escapeRegExp(escapeXml(name))}"[^>]*/>`));
      expect(output).toContain("0 fail");
    } finally {
      await rm(reportDir, { recursive: true, force: true });
    }
  }, 20_000);
}
