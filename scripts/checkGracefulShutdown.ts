/** Starts only an explicitly selected standalone instance; never signals an existing server. */
import { parseArgs } from "node:util";
import path from "node:path";

const { values } = parseArgs({ args: process.argv.slice(2), options: {
  port: { type: "string" }, "data-dir": { type: "string" },
  server: { type: "string", default: ".next/standalone/server.js" }
}, strict: true });
const port = Number(values.port);
if (!Number.isInteger(port) || port < 1024 || port > 65535 || !values["data-dir"]) {
  throw new Error("Usage: bun scripts/checkGracefulShutdown.ts --port 3836 --data-dir /absolute/isolated/data [--server .next/standalone/server.js]");
}
const dataDir = path.resolve(values["data-dir"]);
const server = path.resolve(values.server!);
const child = Bun.spawn([process.execPath, "--bun", server], {
  env: { ...process.env, PORT: String(port), HOSTNAME: "127.0.0.1", NOCTUA_DATA_DIR: dataDir },
  stdout: "pipe", stderr: "pipe"
});
let output = "";
const drain = async (stream: ReadableStream<Uint8Array>) => {
  for await (const chunk of stream) { const text = Buffer.from(chunk).toString(); output += text; process.stderr.write(text); }
};
const drains = Promise.all([drain(child.stdout), drain(child.stderr)]);
let forced = false;
try {
  const readyDeadline = Date.now() + 30000;
  // Read our child's readiness, never mistake a different listener for this instance.
  while (!output.includes(`Ready on http://127.0.0.1:${port}`) && Date.now() < readyDeadline && child.exitCode === null) await Bun.sleep(25);
  if (!output.includes(`Ready on http://127.0.0.1:${port}`)) throw new Error("Owned standalone server did not become ready");
  const response = await fetch(`http://127.0.0.1:${port}/api/ba/ok`, { signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new Error(`Health check failed: ${response.status}`);
  await response.arrayBuffer();
  const start = performance.now();
  child.kill("SIGTERM");
  const timer = setTimeout(() => { forced = true; child.kill("SIGKILL"); }, 5000);
  const code = await child.exited;
  clearTimeout(timer);
  const durationMs = Math.round(performance.now() - start);
  await drains;
  console.log(JSON.stringify({ pid: child.pid, port, dataDir, exitCode: code, signal: child.signalCode, durationMs, forced }));
  if (forced || code !== 0 || durationMs >= 5000) process.exitCode = 1;
} finally {
  if (child.exitCode === null) { child.kill("SIGKILL"); await child.exited; }
  await drains;
}
