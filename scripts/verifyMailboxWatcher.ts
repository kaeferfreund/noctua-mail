/** Synthetic end-to-end proof, run in its own process to isolate SQLite/env/module mocks. */
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { ImapFlow } from "imapflow";
import type { Account } from "@/lib/data";

const dataDir = mkdtempSync(path.join(tmpdir(), "noctua-watcher-proof-"));
process.env.NOCTUA_DATA_DIR = dataDir;
process.env.ACCOUNT_DB_IDLE_MS = "0";
process.env.IMAP_CREDENTIALS_STORAGE = "db";
process.env.IMAP_SECRET_KEY = "synthetic-watcher-integration-secret-32-chars";
process.env.NOCTUA_MAILBOX_WATCHER = "1";
process.env.NOCTUA_WATCHER_ACCOUNTS_INTERVAL_MS = "100";
process.env.NOCTUA_WATCHER_INTERVAL_MS = "300000";
const fixturePath = process.argv[2];
if (!fixturePath) throw new Error("Pass the synthetic dev-fixture imap-server.ts path");
let fixture: ChildProcess | undefined;
let mutationClient: ImapFlow | undefined;
let fixtureLog = "";
let imapPort = 0;
let controlUrl = "";
const accountId = "synthetic-watcher";
const { upsertAccount, patchAccount, deleteAccountControlPlane, getStoredAccounts,
  withAccountDb, closeAllDbConnections, getMailboxSummaries } = await import("@/lib/db");
const { startMailboxWatcher, stopMailboxWatcher, watcherRetryDelay } = await import("@/lib/mailboxWatcher");
const { drainImapConnectionPool } = await import("@/lib/mail/imap/connectionPool");
const { cacheSessionCredentials } = await import("@/lib/credentials");
const { subscribeMailboxEvents } = await import("@/lib/mailboxWatcherEvents");
const events: string[] = [];
const unsubscribe = subscribeMailboxEvents((event) => { events.push(event.type); });
async function until(check: () => Promise<boolean>, label: string, ms = 12000) {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    if (await check()) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`Timed out: ${label}\n${fixtureLog}`);
}
async function count(subject?: string) {
  return withAccountDb(accountId, (db) => (db.prepare(`SELECT count(*) AS n FROM messages
    WHERE accountId = ? AND folderId = ? ${subject ? "AND subject = ?" : ""}`)
    .get(...[accountId, `${accountId}:INBOX`, ...(subject ? [subject] : [])]) as { n: number }).n);
}
async function status() { return (await getMailboxSummaries([accountId]))[0]; }
let cleanupTask: Promise<void> | undefined;
function cleanup() {
  return cleanupTask ??= (async () => {
    unsubscribe();
    mutationClient?.close();
    if (fixture && fixture.exitCode === null) {
      const exited = once(fixture, "exit");
      fixture.kill("SIGKILL");
      await exited;
    }
    await stopMailboxWatcher();
    await drainImapConnectionPool();
    closeAllDbConnections();
    rmSync(dataDir, { recursive: true, force: true });
  })();
}
const terminate = () => { void cleanup().finally(() => process.exit(1)); };
process.once("SIGTERM", terminate);
process.once("SIGINT", terminate);
const watchdog = setTimeout(terminate, 50000);

try {
  fixture = spawn(process.execPath, [fixturePath, "--host", "127.0.0.1", "--port", process.env.NOCTUA_TEST_IMAP_PORT ?? "0",
    "--control-port", process.env.NOCTUA_TEST_CONTROL_PORT ?? "0", "--user", "demo@monkeydent.test", "--pass", "demo", "--seed", "monkeydent"],
  { cwd: path.resolve(fixturePath, "../../.."), stdio: ["ignore", "pipe", "pipe"], env: process.env });
  fixture.stdout?.on("data", (chunk) => { fixtureLog += chunk; });
  fixture.stderr?.on("data", (chunk) => { fixtureLog += chunk; });
  await until(async () => {
    if (fixture?.exitCode != null) throw new Error(`Fixture exited: ${fixtureLog}`);
    const ready = fixtureLog.match(/IMAP fixture: 127\.0\.0\.1:(\d+); control: (\d+)/);
    if (!ready) return false;
    imapPort = Number(ready[1]);
    controlUrl = `http://127.0.0.1:${ready[2]}`;
    try { return (await fetch(`${controlUrl}/status`)).ok; } catch { return false; }
  }, "fixture startup");
  const endpoint = { host: "127.0.0.1", port: imapPort, secure: false, user: "demo@monkeydent.test", password: "demo" };
  const account: Account = { id: accountId, name: "Synthetic watcher", email: "demo@monkeydent.test", avatar: "S", imap: endpoint, smtp: endpoint };
  await upsertAccount(account);
  cacheSessionCredentials({ accountId, imap: { user: endpoint.user, pass: "wrong-cookie-password" } });
  assert.equal((await getStoredAccounts()).find((entry) => entry.id === accountId)?.imap.password, "demo");
  delete process.env.NOCTUA_MAILBOX_WATCHER;
  assert.equal(startMailboxWatcher(), null, "watcher must be off by default");
  process.env.NOCTUA_MAILBOX_WATCHER = "1";
  assert.equal(watcherRetryDelay(1), 60000);
  assert.equal(watcherRetryDelay(2), 120000);
  assert.equal(watcherRetryDelay(100), 1800000);
  const watcher = startMailboxWatcher();
  assert(watcher);
  assert.equal(startMailboxWatcher(), watcher, "one instance per process");
  await until(async () => (await count()) === 60 && (await status()).lastSyncAt !== null && events.includes("synced"), "INBOX bootstrap");
  const before = Date.now();
  const response = await fetch(`${controlUrl}/inject`, { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ subject: "Synthetic watcher injected", text: "No browser is open." }) });
  assert(response.ok);
  await until(async () => (await count("Synthetic watcher injected")) === 1, "IDLE ingestion", 5000);
  console.info(`WATCHER_FIXTURE injection ingested in ${Date.now() - before}ms`);
  assert.equal((await status()).unreadInbox, 21);
  assert(events.includes("state") && events.includes("synced"));
  mutationClient = new ImapFlow({ ...endpoint, auth: { user: endpoint.user, pass: endpoint.password }, logger: false });
  mutationClient.on("error", () => {});
  await mutationClient.connect();
  await mutationClient.mailboxOpen("INBOX");
  const uids = await mutationClient.search({ subject: "Synthetic watcher injected" }, { uid: true });
  assert(uids && uids.length === 1);
  await mutationClient.messageFlagsAdd(uids, ["\\Seen"], { uid: true });
  await until(async () => (await status()).unreadInbox === 20, "shared flag reconciliation", 5000);
  await mutationClient.messageDelete(uids, { uid: true });
  await until(async () => (await count("Synthetic watcher injected")) === 0, "EXPUNGE reconciliation", 5000);
  await mutationClient.logout();
  mutationClient = undefined;

  // Exercise credentials reload and auth backoff without waiting a reconnect minute.
  await patchAccount(accountId, { imap: { ...endpoint, password: "wrong-synthetic-password" } });
  await until(async () => (await status()).watcherState === "auth_failed", "credentials reload / auth failure");
  await new Promise((resolve) => setTimeout(resolve, 300));
  assert.equal((await status()).watcherState, "auth_failed");
  await patchAccount(accountId, { imap: endpoint });
  await until(async () => (await status()).watcherState === "idling", "credentials recovery");
  const secondId = "synthetic-watcher-added";
  await upsertAccount({ ...account, id: secondId });
  await until(async () => (await getMailboxSummaries([secondId]))[0].watcherState === "idling", "account addition");
  await deleteAccountControlPlane(secondId);
  await new Promise((resolve) => setTimeout(resolve, 300));
  await stopMailboxWatcher();
  assert.equal((await status()).watcherState, "stopped");
  process.env.NOCTUA_WATCHER_INTERVAL_MS = "500";
  startMailboxWatcher();
  const beforeFallback = events.filter((event) => event === "synced").length;
  await until(async () => events.filter((event) => event === "synced").length > beforeFallback, "restart initial check");
  assert((await fetch(`${controlUrl}/inject`, { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ folder: "Sent", subject: "Synthetic periodic sent", text: "Only the fallback observes Sent." }) })).ok);
  await until(async () => withAccountDb(accountId, (db) => !!db.prepare(`SELECT 1 FROM messages WHERE accountId = ? AND subject = ?`)
    .get(accountId, "Synthetic periodic sent")), "periodic Sent ingestion", 5000);
  await stopMailboxWatcher();
  console.info("WATCHER_FIXTURE PASS bootstrap=60 injected=1 flags=ok expunge=ok periodic-Sent=ok singleton=ok DB-credentials=ok auth-reload=ok add/remove=ok events=ok shutdown=ok");
} finally {
  clearTimeout(watchdog);
  process.off("SIGTERM", terminate);
  process.off("SIGINT", terminate);
  await cleanup();
}
