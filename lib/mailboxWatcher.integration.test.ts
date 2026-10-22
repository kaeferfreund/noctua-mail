import { existsSync } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { expect, test } from "bun:test";

const fixture = process.env.NOCTUA_TEST_IMAP_FIXTURE ?? path.resolve(process.cwd(), "../wt-dev-fixture/scripts/dev-fixture/imap-server.ts");
// The fixture is maintained on its own branch. CI can opt in by supplying its path.
(existsSync(fixture) ? test : test.skip)("watcher ingests local synthetic IMAP mail without a browser and shuts down", async () => {
  const child = spawn(process.execPath, ["scripts/verifyMailboxWatcher.ts", fixture], {
    cwd: process.cwd(), env: process.env, stdio: ["ignore", "pipe", "pipe"]
  });
  let output = "";
  child.stdout.on("data", (chunk) => { output += chunk; });
  child.stderr.on("data", (chunk) => { output += chunk; });
  const timer = setTimeout(() => child.kill("SIGKILL"), 55000);
  try {
    const code = await new Promise<number | null>((resolve, reject) => {
      child.once("exit", resolve); child.once("error", reject);
    });
    if (code !== 0) throw new Error(output);
    expect(output).toContain("WATCHER_FIXTURE PASS");
    console.info(output.split("\n").filter((line) => line.startsWith("WATCHER_FIXTURE")).join("\n"));
  } finally {
    clearTimeout(timer);
    if (child.exitCode === null) child.kill("SIGKILL");
  }
}, 60000);
