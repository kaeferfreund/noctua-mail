/** Production Next launcher regression probe; delays only its own marked HTTP request. */
import assert from "node:assert/strict";
import { parseArgs } from "node:util";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { Database } from "bun:sqlite";

const { values } = parseArgs({ options: {
  port: { type: "string", default: "3836" }, "data-dir": { type: "string" },
  "cookie-file": { type: "string" },
  "wait-for-worker": { type: "boolean", default: false },
  "wait-for-watcher": { type: "boolean", default: false }
}, strict: true });
const port = Number(values.port);
assert(Number.isInteger(port) && port >= 1024 && port <= 65535 && values["data-dir"],
  "Usage: bun scripts/checkNextStartShutdown.test.fixture.ts --port 3836 --data-dir /absolute/isolated/data [--cookie-file /private/synthetic-cookie]");
const dataDir = path.resolve(values["data-dir"]!);
const temp = mkdtempSync(path.join(tmpdir(), "next-shutdown-probe-"));
const preload = path.join(temp, "delay-http.cjs");
// No application/test route is packaged. Next still owns the real HTTP server,
// response, request handler, storage and signal lifecycle. Only dispatch is held.
writeFileSync(preload, `
const {Server}=require('node:http');
const emit=Server.prototype.emit;
Server.prototype.emit=function(event,...args){
  if(event==='request' && args[0].headers['x-noctua-shutdown-probe']==='1500'){
    console.log('NOCTUA_PROBE_IN_FLIGHT');
    setTimeout(()=>emit.call(this,event,...args),1500);
    return true;
  }
  return emit.call(this,event,...args);
};
`);
const env: NodeJS.ProcessEnv = { ...process.env, NOCTUA_DATA_DIR: dataDir, PORT: String(port), HOSTNAME: "127.0.0.1" };
delete env.NEXT_MANUAL_SIG_HANDLE;
const child = Bun.spawn([process.execPath, "--bun", "--preload", preload, "node_modules/next/dist/bin/next", "start", "-p", String(port), "-H", "127.0.0.1"], {
  env, stdout: "pipe", stderr: "pipe"
});
let output = "", forced = false;
const drain = async (stream: ReadableStream<Uint8Array>) => {
  for await (const chunk of stream) { const text = Buffer.from(chunk).toString(); output += text; process.stderr.write(text); }
};
const drains = Promise.all([drain(child.stdout), drain(child.stderr)]);
const until = async (predicate: () => boolean) => {
  const deadline = Date.now() + 30000;
  while (!predicate() && child.exitCode === null && Date.now() < deadline) await Bun.sleep(10);
  assert(predicate(), "Owned Next child failed readiness/in-flight marker");
};
let fallback: ReturnType<typeof setTimeout> | undefined;
try {
  await until(() => output.includes("Ready in"));
  const origin = `http://127.0.0.1:${port}`;
  const health = await fetch(`${origin}/api/ba/ok`, { headers: { Connection: "close" } });
  assert(health.ok); await health.arrayBuffer();
  const before = new Database(path.join(dataDir, "db/main.db"), { readonly: true });
  const active = () => ({
    watcher: (before.prepare("SELECT count(*) AS n FROM mailbox_watcher_lease").get() as { n: number }).n,
    workers: (before.prepare("SELECT count(*) AS n FROM sync_worker_leases WHERE pid IS NOT NULL").get() as { n: number }).n
  });
  await until(() => (!values["wait-for-worker"] || active().workers > 0) && (!values["wait-for-watcher"] || active().watcher > 0));
  const activeBeforeSignal = active();
  before.close();
  const cookie = values["cookie-file"] ? (await Bun.file(values["cookie-file"]).text()).trim() : undefined;
  const route = cookie ? "/api/auth/me" : "/api/ba/ok";
  // Retire the client socket after the response; measure request drain separately
  // from Next/Bun's native idle keepalive wait (documented in DEPLOYMENT.md).
  const pending = fetch(`${origin}${route}`, { headers: { "x-noctua-shutdown-probe": "1500", Connection: "close", ...(cookie ? { Cookie: cookie } : {}) }, signal: AbortSignal.timeout(10000) })
    .then(async response => ({ status: response.status, body: await response.text() }));
  await until(() => output.includes("NOCTUA_PROBE_IN_FLIGHT"));
  const start = performance.now();
  child.kill("SIGTERM");
  fallback = setTimeout(() => { forced = true; child.kill("SIGKILL"); }, 10000);
  const response = await pending;
  const code = await child.exited;
  const durationMs = Math.round(performance.now() - start);
  clearTimeout(fallback); await drains;
  const db = new Database(path.join(dataDir, "db/main.db"), { readonly: true });
  const leases = Object.fromEntries(["mailbox_watcher_lease", "sync_worker_leases", "sync_worker_queue"].map(table =>
    [table, (db.prepare(`SELECT count(*) AS n FROM ${table}`).get() as { n: number }).n]));
  const integrity = (db.prepare("PRAGMA integrity_check").get() as { integrity_check: string }).integrity_check;
  db.close();
  const result = { responseCompleted: true, status: response.status, exitCode: code, durationMs, forced, activeBeforeSignal, leases, integrity };
  console.log(JSON.stringify(result));
  assert.equal(response.status, 200);
  assert.equal(code, 143);
  assert(durationMs >= 1400 && durationMs < 5000);
  assert(!forced);
  assert(Object.values(leases).every(n => n === 0));
  assert.equal(integrity, "ok");
  assert(!output.includes("could not register Next cleanup participant"));
} finally {
  clearTimeout(fallback);
  if (child.exitCode === null) { child.kill("SIGKILL"); await child.exited; }
  await drains;
  rmSync(temp, { recursive: true, force: true });
}
