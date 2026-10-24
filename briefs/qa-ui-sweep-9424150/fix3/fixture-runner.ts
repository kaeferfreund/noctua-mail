import { mkdirSync, openSync, writeFileSync } from "node:fs";
import { spawn, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";
import { setTimeout as delay } from "node:timers/promises";

const root = process.cwd();
const scratch = `${root}/.tmp/qa-shell-round2`;
mkdirSync(scratch, { recursive: true });
const env = { ...process.env, TMPDIR: `${root}/.tmp`, NOCTUA_DATA_DIR: `${scratch}/data`,
  BETTER_AUTH_URL: "http://localhost:3900", QA_SHELL_BASE_URL: "http://localhost:3900", AUTH_BROWSER_PORT: "3901",
  PASSKEY_RP_ID: "localhost", IMAP_CREDENTIALS_STORAGE: "db", BETTER_AUTH_TELEMETRY: "0",
  BETTER_AUTH_SECRET: "synthetic-qa-shell-secret-0123456789abcdef", IMAP_SECRET_KEY: Buffer.alloc(32, 8).toString("base64"),
  NOCTUA_TRUSTED_ORIGINS: "", NOCTUA_IMAP_LOGIN_HOSTS: "", NOCTUA_DESKTOP_MODE: "false", NOCTUA_MAILBOX_WATCHER: "1",
  QA_SHELL_SEED_FILE: `${scratch}/seed.json`, QA_SHELL_IMAP_PORT: "3902", QA_SHELL_SMTP_PORT: "3903" };
const children: ChildProcess[] = [];
for (const port of [3900, 3901, 3902, 3903, 3904]) await new Promise<void>((resolve, reject) => {
  const probe = createServer(); probe.once("error", reject); probe.listen(port, "localhost", () => probe.close(() => resolve()));
});
function start(args: string[], log: string) {
  const child = spawn("nice", ["-n", "15", "bun", ...args], { cwd: root, env, stdio: ["ignore", openSync(`${scratch}/${log}`, "a"), openSync(`${scratch}/${log}`, "a")] });
  children.push(child); writeFileSync(`${scratch}/pids.json`, JSON.stringify({ owner: process.pid, children: children.map(child => child.pid) })); return child;
}
async function ready(url: string, child: ChildProcess) {
  for (let n = 0; n < 120; n++) {
    if (child.exitCode !== null) throw Error(`Child exited: ${child.exitCode}`);
    try { if ((await fetch(url)).ok) return; } catch {}
    await delay(500);
  }
  throw Error(`Readiness timeout: ${url}`);
}
async function cleanup() {
  for (const child of children.toReversed()) {
    if (child.exitCode !== null) continue;
    child.kill("SIGTERM");
    await Promise.race([new Promise<void>(resolve => child.once("exit", () => resolve())), delay(5000)]);
    if (child.exitCode === null) child.kill("SIGKILL");
  }
}
for (const signal of ["SIGINT", "SIGTERM"] as const) process.on(signal, () => { void cleanup().then(() => process.exit(0)); });
try {
  const fixture = start(["scripts/dev-fixture/run.ts", "--port", "3902", "--smtp-port", "3903", "--control-port", "3904", "--seed", "qa-fix3", "--out", `${scratch}/outbox`], "fixture.log");
  await ready("http://127.0.0.1:3904/status", fixture);
  mkdirSync(`${scratch}/outbox`, { recursive: true });
  for (let n = 0; n < 240; n++) {
    const subject = n === 239 ? "QA long subject checks wrapping and leaves room for reading the synthetic message on a narrow phone. ".repeat(4).trim() : `QA synthetic ${String(n).padStart(3, "0")}`;
    const source = n === 239 ? `From: Synthetic Reader <reader@example.test>\r\nTo: demo@monkeydent.test\r\nMessage-ID: <qa-shell-long@example.test>\r\nDate: ${new Date(Date.now() + 86400000).toUTCString()}\r\nSubject: ${subject}\r\n\r\nSynthetic reader body for QA shell regressions.\r\n` : undefined;
    const response = await fetch("http://127.0.0.1:3904/inject", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ source, subject, text: "Synthetic QA round two message.", flags: n < 90 ? [] : ["\\Seen"] }) });
    if (!response.ok) throw Error("Injection failed");
  }
  const seed = start(["tests/browser/ui/seedQaShell.ts"], "seed.log");
  if (await new Promise<number | null>(resolve => seed.once("exit", resolve)) !== 0) throw Error("Seed failed");
  const seeds = await Bun.file(env.QA_SHELL_SEED_FILE).json();
  await Bun.write(`${scratch}/compose-seed.json`, JSON.stringify({ ...seeds[0], accountId: "qa-shared" }));
  const server = start(["--bun", "next", "start", "-p", "3900", "-H", "localhost"], "server.log");
  await ready("http://localhost:3900/api/ba/ok", server);
  console.log(`QA_READY owner=${process.pid} fixture=${fixture.pid} server=${server.pid}`);
  await new Promise(() => {});
} catch (error) { console.error(error); await cleanup(); process.exit(1); }
