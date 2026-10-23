/** Production UI regression harness. Only synthetic data, an explicit app port and OS-assigned fixture ports. */
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { createServer } from "node:net";
import { spawn, type ChildProcess } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

const root = process.cwd();
const port = Number(process.env.QA_SHELL_PORT ?? 3799);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error("Invalid QA_SHELL_PORT");
const baseURL = `http://localhost:${port}`;
mkdirSync(path.join(root, ".tmp"), { recursive: true });
const scratch = mkdtempSync(path.join(root, ".tmp", "qa-shell-"));
const env = { ...process.env, TMPDIR: path.join(root, ".tmp"), NOCTUA_DATA_DIR: path.join(scratch, "data"),
  BETTER_AUTH_URL: baseURL, QA_SHELL_BASE_URL: baseURL, PASSKEY_RP_ID: "localhost", IMAP_CREDENTIALS_STORAGE: "db",
  BETTER_AUTH_SECRET: "synthetic-qa-shell-secret-0123456789abcdef", IMAP_SECRET_KEY: Buffer.alloc(32, 8).toString("base64"),
  BETTER_AUTH_TELEMETRY: "0", NOCTUA_TRUSTED_ORIGINS: "", NOCTUA_IMAP_LOGIN_HOSTS: "", NOCTUA_DESKTOP_MODE: "false",
  QA_SHELL_SEED_FILE: path.join(scratch, "seed.json") };
Object.assign(process.env, env);
async function run(args: string[]) {
  const child = spawn("bun", args, { cwd: root, env, stdio: "inherit" });
  const code = await new Promise<number>((resolve, reject) => { child.on("error", reject); child.on("exit", code => resolve(code ?? 1)); });
  if (code !== 0) throw new Error(`QA command exited ${code}: bun ${args.join(" ")}`);
}
let server: ChildProcess | undefined;
let imap: Awaited<ReturnType<typeof import("./dev-fixture/imap-server").startImapServer>> | undefined;
let smtp: Awaited<ReturnType<typeof import("./dev-fixture/smtp-sink").startSmtpSink>> | undefined;
try {
  await new Promise<void>((resolve, reject) => {
    const probe = createServer(); probe.once("error", reject);
    probe.listen(port, "localhost", () => probe.close(() => resolve()));
  });
  if (process.env.QA_SHELL_USE_BUILD !== "1") await run(["run", "build"]);
  const { startImapServer } = await import("./dev-fixture/imap-server");
  const { startSmtpSink } = await import("./dev-fixture/smtp-sink");
  imap = await startImapServer({ host: "127.0.0.1", port: 0, controlPort: 0, user: "demo@monkeydent.test", pass: "demo", seed: "qa-shell" });
  imap.store.append("INBOX", Buffer.from(`From: Synthetic Reader <reader@example.test>\r\nTo: demo@monkeydent.test\r\nMessage-ID: <qa-shell-long@example.test>\r\nDate: ${new Date().toUTCString()}\r\nSubject: ${"QA long subject checks wrapping and leaves room for reading the synthetic message on a narrow phone. ".repeat(4).trim()}\r\n\r\nSynthetic reader body for QA shell regressions.\r\n`));
  smtp = await startSmtpSink({ host: "127.0.0.1", port: 0, user: "demo@monkeydent.test", pass: "demo", out: path.join(scratch, "outbox"), deliver: source => { imap!.store.append("INBOX", source); } });
  Object.assign(env, { QA_SHELL_IMAP_PORT: String(imap.port), QA_SHELL_SMTP_PORT: String(smtp.port), QA_SHELL_OUTBOX: path.join(scratch, "outbox") });
  await run(["tests/browser/ui/seedQaShell.ts"]);
  server = spawn("bun", ["--bun", "next", "start", "-p", String(port), "-H", "localhost"], { cwd: root, env, stdio: "inherit", detached: true });
  let ready = false;
  for (let attempt = 0; attempt < 120; attempt++) {
    if (server.exitCode !== null) throw new Error("QA server exited before readiness");
    try { if ((await fetch(`${baseURL}/api/ba/ok`)).ok) { ready = true; break; } } catch { /* wait for own server */ }
    await delay(500);
  }
  if (!ready) throw new Error("QA server readiness timed out");
  await run(["x", "playwright", "test", "--config=playwright.qa-shell.config.ts", ...process.argv.slice(2)]);
} finally {
  if (server?.pid) {
    const signal = (value: NodeJS.Signals) => { try { process.kill(-server!.pid!, value); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error; } };
    signal("SIGTERM");
    if (server.exitCode === null) await Promise.race([new Promise<void>(resolve => server!.once("exit", () => resolve())), delay(5000)]);
    signal("SIGKILL");
  }
  await smtp?.stop(); await imap?.stop();
  rmSync(scratch, { recursive: true, force: true });
}
