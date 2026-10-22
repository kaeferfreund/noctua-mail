import { test, expect } from "bun:test";
import { spawn } from "node:child_process";
import { once } from "node:events";

test("durable admission: independent graphs, restart recovery, starvation bound, confirmed-exit failure, scheduler takeover", async () => {
  const child = spawn(process.execPath, ["scripts/verifyProcessLeases.ts"], { cwd: process.cwd(), env: process.env, stdio: ["ignore", "pipe", "pipe"] });
  let output = "";
  child.stdout.on("data", chunk => { output += chunk; });
  child.stderr.on("data", chunk => { output += chunk; });
  const exited = once(child, "exit");
  const timer = setTimeout(() => child.kill("SIGKILL"), 25000);
  try {
    const [code] = await exited;
    if (code !== 0) throw new Error(output);
    expect(output).toContain("LEASE_PROOF PASS");
    console.info(output.split("\n").filter(line => line.startsWith("LEASE_PROOF")).join("\n"));
  } finally {
    clearTimeout(timer);
    if (child.exitCode === null && child.signalCode === null) { child.kill("SIGKILL"); await exited; }
  }
}, 30000);

for (const [mode, label] of [
  ["cancel", "cancelled queue head is retried after SQLite cleanup retry exhaustion"],
  ["release", "confirmed-exit release is retried after SQLite cleanup retry exhaustion"],
  ["restart", "restart recovers stale records of a live owner without displacing live children"]
]) {
  test(`durable cleanup: ${label}`, async () => {
    const child = spawn(process.execPath, ["scripts/verifyAdmissionCleanup.ts", mode], {
      cwd: process.cwd(), env: process.env, stdio: ["ignore", "pipe", "pipe"]
    });
    let output = "";
    child.stdout.on("data", chunk => { output += chunk; });
    child.stderr.on("data", chunk => { output += chunk; });
    const exited = once(child, "exit");
    const timer = setTimeout(() => child.kill("SIGKILL"), 15000);
    try {
      const [code] = await exited;
      if (code !== 0) throw new Error(output);
      expect(output).toContain(`CLEANUP_PROOF ${mode} PASS`);
    } finally {
      clearTimeout(timer);
      if (child.exitCode === null && child.signalCode === null) { child.kill("SIGKILL"); await exited; }
    }
  }, 18000);
}
