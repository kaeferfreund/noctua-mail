import { expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

test("SIGTERM mid-job preserves committed transactions and a fresh process reclaims its durable lease", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "noctua-graceful-worker-"));
  const env = { ...process.env, NOCTUA_DATA_DIR: dir, IMAP_SECRET_KEY: "synthetic-worker-shutdown-key-32-chars" };
  const children: ReturnType<typeof Bun.spawn>[] = [];
  const launch = (mode: string) => {
    const child = Bun.spawn([process.execPath, "lib/testFixtures/gracefulWorker.ts", mode], { env, stdout: "pipe", stderr: "pipe" });
    children.push(child); return child;
  };
  try {
    const child = launch("write");
    let output = "";
    const stdout = (async () => { for await (const chunk of child.stdout as ReadableStream) output += Buffer.from(chunk).toString(); })();
    const stderr = new Response(child.stderr as ReadableStream).text();
    const deadline = Date.now() + 5000;
    while (!output.includes("COMMITTED") && Date.now() < deadline && child.exitCode === null) await Bun.sleep(10);
    expect(output).toContain("COMMITTED");
    child.kill("SIGTERM");
    expect(await child.exited).toBe(0); await stdout;
    expect(await stderr).toBe("");
    const fresh = launch("recover");
    const freshOutput = new Response(fresh.stdout as ReadableStream).text();
    const freshError = new Response(fresh.stderr as ReadableStream).text();
    expect(await fresh.exited).toBe(0);
    expect(await freshOutput).toContain("RECOVERED"); expect(await freshError).toBe("");
  } finally {
    for (const child of children) if (child.exitCode === null) { child.kill("SIGKILL"); await child.exited; }
    rmSync(dir, { recursive: true, force: true });
  }
}, 10000);

test("an interrupted durable identity scan stays queued and the same job resumes in a fresh process", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "noctua-graceful-registry-"));
  const env = { ...process.env, NOCTUA_DATA_DIR: dir, IMAP_SECRET_KEY: "synthetic-registry-shutdown-key-32-chars" };
  const children: ReturnType<typeof Bun.spawn>[] = [];
  const launch = (recover = false) => {
    const child = Bun.spawn([process.execPath, "lib/testFixtures/gracefulRegistry.ts", recover ? "recover" : "start"], {
      env: { ...env, ...(recover ? { NOCTUA_SYNTHETIC_RECOVER: "1" } : {}) }, stdout: "pipe", stderr: "pipe"
    });
    children.push(child); return child;
  };
  try {
    const child = launch();
    let output = "";
    const stdout = (async () => { for await (const chunk of child.stdout as ReadableStream) output += Buffer.from(chunk).toString(); })();
    const stderr = new Response(child.stderr as ReadableStream).text();
    const deadline = Date.now() + 5000;
    while (!output.includes("READY ") && Date.now() < deadline && child.exitCode === null) await Bun.sleep(10);
    expect(output).toContain("READY ");
    const id = output.match(/READY ([\w-]+)/)![1];
    child.kill("SIGTERM");
    expect(await child.exited).toBe(0); await stdout;
    expect(output).toContain("[shutdown] complete"); expect(await stderr).toBe("");
    const fresh = launch(true);
    const recovered = new Response(fresh.stdout as ReadableStream).text();
    const errors = new Response(fresh.stderr as ReadableStream).text();
    expect(await fresh.exited).toBe(0);
    expect(await recovered).toContain(`RECOVERED ${id}`); expect(await errors).toBe("");
  } finally {
    for (const child of children) if (child.exitCode === null) { child.kill("SIGKILL"); await child.exited; }
    rmSync(dir, { recursive: true, force: true });
  }
}, 10000);
