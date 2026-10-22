/** Synthetic end-to-end proof, run in its own process to isolate SQLite/env/module mocks. */
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { createServer, connect, type Socket } from "node:net";
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
process.env.NOCTUA_WATCHER_RECONNECT_MIN_MS = "150"; // Observe multiple retry windows without slowing CI.
const fixturePath = process.argv[2];
if (!fixturePath) throw new Error("Pass the synthetic dev-fixture imap-server.ts path");
let fixture: ChildProcess | undefined;
let mutationClient: ImapFlow | undefined;
let fixtureLog = "";
let imapPort = 0;
let controlUrl = "";
let authAttempts = 0;
const proxySockets = new Set<Socket>();
const proxy = createServer(socket => {
  const upstream = connect(imapPort, "127.0.0.1");
  for (const stream of [socket, upstream]) {
    proxySockets.add(stream);
    stream.on("close", () => proxySockets.delete(stream));
    stream.on("error", () => { socket.destroy(); upstream.destroy(); });
  }
  let pending = "";
  socket.on("data", chunk => {
    pending += chunk.toString();
    let end: number;
    while ((end = pending.indexOf("\r\n")) >= 0) {
      const line = pending.slice(0, end); pending = pending.slice(end + 2);
      if (/^\S+ (?:AUTHENTICATE|LOGIN)\b/i.test(line)) authAttempts++;
    }
  });
  socket.pipe(upstream).pipe(socket);
  socket.on("close", () => upstream.destroy());
  upstream.on("close", () => socket.destroy());
});
// Initialize the shared fixture module before opening storage, then keep this subprocess's data root.
const { dbModulePromise } = await import("@/lib/testDbHarness");
await dbModulePromise;
process.env.NOCTUA_DATA_DIR = dataDir;
const { TEST_SECRET, TEST_BASE_URL } = await import("@/lib/testAuthHarness");
process.env.BETTER_AUTH_SECRET = TEST_SECRET;
process.env.BETTER_AUTH_URL = TEST_BASE_URL;
const { getAuth } = await import("@/lib/betterAuth");
const accountId = "synthetic-watcher";
const { upsertAccount, patchAccount, deleteAccountControlPlane, getStoredAccounts,
  withAccountDb, closeAllDbConnections, getMailboxSummaries } = await import("@/lib/db");
const { startMailboxWatcher, stopMailboxWatcher, watcherRetryDelay } = await import("@/lib/mailboxWatcher");
const { drainImapConnectionPool } = await import("@/lib/mail/imap/connectionPool");
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
    for (const socket of proxySockets) socket.destroy();
    if (proxy.listening) await new Promise<void>((resolve, reject) => proxy.close(error => error ? reject(error) : resolve()));
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
  // Use production startup before fixture writes or watcher activity.
  await getAuth();
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
  proxy.listen(0, "127.0.0.1");
  await once(proxy, "listening");
  const proxyPort = (proxy.address() as { port: number }).port;
  const endpoint = { host: "127.0.0.1", port: proxyPort, secure: false, user: "demo@monkeydent.test", password: "demo" };
  const account: Account = { id: accountId, name: "Synthetic watcher", email: "demo@monkeydent.test", avatar: "S", imap: endpoint, smtp: endpoint };
  await upsertAccount(account);
  assert.equal((await getStoredAccounts()).find((entry) => entry.id === accountId)?.imap.password, "demo");
  delete process.env.NOCTUA_MAILBOX_WATCHER;
  assert.equal(startMailboxWatcher(), null, "watcher must be off by default");
  process.env.NOCTUA_MAILBOX_WATCHER = "1";
  assert.equal(watcherRetryDelay(1), 150);
  assert.equal(watcherRetryDelay(2), 300);
  assert.equal(watcherRetryDelay(100), 1800000);
  const watcher = startMailboxWatcher();
  assert(watcher);
  assert.equal(startMailboxWatcher(), watcher, "one instance per process");
  await until(async () => (await count()) === 60 && (await status()).lastSyncAt !== null && events.includes("synced"), "INBOX bootstrap");
  // A second independently evaluated watcher graph must not open another IDLE.
  const graphSpecifier = "../lib/mailboxWatcher.ts?independent-fixture-graph";
  const graph: typeof import("@/lib/mailboxWatcher") = await import(graphSpecifier);
  const contender = new graph.MailboxWatcher();
  try {
    const attemptsBeforeContender = authAttempts;
    await new Promise(resolve => setTimeout(resolve, 350));
    assert.equal(authAttempts, attemptsBeforeContender, "only the DB scheduler owner may open IDLE");
    await stopMailboxWatcher();
    await until(async () => authAttempts > attemptsBeforeContender && (await status()).watcherState === "idling", "watcher graph takeover");
  } finally { await contender.stop(); }
  startMailboxWatcher();
  await until(async () => (await status()).watcherState === "idling", "watcher restart after handoff");
  console.info("WATCHER_FIXTURE independent watcher graphs: one IDLE owner, orderly takeover");
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

  // Reset twice: UID 61 first contains OLD, then NEW, with distinct UIDVALIDITY.
  await stopMailboxWatcher();
  const { getMailboxState } = await import("@/lib/db");
  const { startSyncJob, getSyncJob } = await import("@/lib/syncJobs");
  async function repairInbox() {
    const repair = startSyncJob({ accountId, folderId: `${accountId}:INBOX`, mode: "repair" });
    await until(async () => { const job = getSyncJob(repair.id); if (job?.status === "failed") throw new Error(job.error); return job?.status === "done"; }, "UIDVALIDITY repair");
  }
  async function resetAndInject(subject: string, text: string) {
    assert((await fetch(`${controlUrl}/reset`, { method: "POST" })).ok);
    assert((await fetch(`${controlUrl}/inject`, { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject, text }) })).ok);
  }
  await resetAndInject("Synthetic OLD namespace", "Synthetic OLD body");
  await repairInbox();
  assert.equal(await count("Synthetic OLD namespace"), 1);
  const oldValidity = (await getMailboxState(accountId, `${accountId}:INBOX`))?.uidValidity;
  const stagedMessageId = await withAccountDb(accountId, db => (db.prepare("SELECT id FROM messages WHERE accountId=? AND folderId=? AND imapUid=60")
    .get(accountId, `${accountId}:INBOX`) as { id: string }).id);
  const { stageMessageMoves, getPendingMoveSourceUids } = await import("@/lib/db");
  await stageMessageMoves({ accountId, messageIds: [stagedMessageId], destinationFolderId: `${accountId}:Archive`, destinationMailboxPath: "Archive" });
  // Stage a different row: OLD must still occupy UID 61 when the browser opens.
  assert.equal(await count("Synthetic OLD namespace"), 1);
  assert.equal((await getPendingMoveSourceUids(accountId, `${accountId}:INBOX`)).has(60), true);
  await resetAndInject("Synthetic NEW namespace", "Synthetic NEW body");
  // Exact regression: a browser SELECT runs before repair sees the new validity.
  // Use the actual authenticated SSE handler, including its persisted-state writes.
  const { GET: browserStream } = await import("@/app/api/accounts/[accountId]/imap/stream/route");
  const { authenticatedTestCookie } = await import("@/lib/testAuthHarness");
  const browserAbort = new AbortController();
  const browserResponse = await browserStream(new Request(`http://example.test/api/accounts/${accountId}/imap/stream`, {
    signal: browserAbort.signal, headers: { cookie: await authenticatedTestCookie(accountId) }
  }), { params: Promise.resolve({ accountId }) });
  assert.equal(browserResponse.status, 200);
  const reader = browserResponse.body!.getReader();
  try {
    let browserEvents = "";
    while (!browserEvents.includes("event: folder:update")) {
      const chunk = await reader.read();
      assert(!chunk.done, `Browser SSE ended before SELECT: ${browserEvents}`);
      browserEvents += new TextDecoder().decode(chunk.value);
      assert(!browserEvents.includes("event: error"), browserEvents);
    }
    const browserState = await getMailboxState(accountId, `${accountId}:INBOX`);
    assert.notEqual(browserState?.uidValidity, oldValidity);
    assert.equal(browserState?.highestUid, null);
    assert.equal(browserState?.highestModSeq, null);
    assert.equal(await count("Synthetic OLD namespace"), 0);
    assert.equal((await getPendingMoveSourceUids(accountId, `${accountId}:INBOX`)).has(60), false);
    await repairInbox();
  } finally {
    browserAbort.abort();
    await reader.cancel();
  }
  assert.notEqual((await getMailboxState(accountId, `${accountId}:INBOX`))?.uidValidity, oldValidity);
  assert.equal(await count("Synthetic OLD namespace"), 0);
  assert.equal(await count("Synthetic NEW namespace"), 1);
  assert.equal((await getPendingMoveSourceUids(accountId, `${accountId}:INBOX`)).has(60), false);
  assert.equal(await count(), 61);
  await withAccountDb(accountId, db => {
    const row = db.prepare("SELECT subject,body FROM messages WHERE accountId=? AND folderId=? AND imapUid=61").get(accountId, `${accountId}:INBOX`) as { subject: string; body: string };
    assert.equal(row?.subject, "Synthetic NEW namespace");
    assert(row.body.includes("Synthetic NEW body") && !row.body.includes("Synthetic OLD body"));
  });
  console.info("WATCHER_FIXTURE UIDVALIDITY browser-before-repair: OLD=0 NEW=1 reused UID=61 replacement subject/body, watermarks and pending moves cleared");
  await resetAndInject("Synthetic WATCHER namespace", "Synthetic WATCHER body");
  startMailboxWatcher();
  await until(async () => (await count("Synthetic WATCHER namespace")) === 1 && (await count("Synthetic NEW namespace")) === 0,
    "watcher UIDVALIDITY re-ingestion");
  console.info("WATCHER_FIXTURE UIDVALIDITY watcher reset automatically replaced reused UID=61");
  await stopMailboxWatcher();
  for (const mode of ["new", "full"] as const) {
    const subject = `Synthetic ${mode} reset namespace`;
    await resetAndInject(subject, `Synthetic ${mode} replacement body`);
    const job = startSyncJob({ accountId, folderId: `${accountId}:INBOX`, mode,
      ...(mode === "full" ? { resumeFromUid: 61 } : {}) });
    await until(async () => {
      const current = getSyncJob(job.id);
      if (current?.status === "failed") throw new Error(current.error);
      return current?.status === "done";
    }, `${mode} namespace recovery`);
    assert.equal(await count(subject), 1);
    assert.equal(await count(), 61);
  }
  console.info("WATCHER_FIXTURE UIDVALIDITY direct-new and resumed-full reset re-ingest replacement UID=61");
  startMailboxWatcher();
  await until(async () => (await status()).watcherState === "idling", "watcher restart after direct syncs");

  // Observe authentication attempts at the wire over multiple reconnect windows.
  await patchAccount(accountId, { imap: { ...endpoint, password: "wrong-synthetic-password" } });
  await until(async () => (await status()).watcherState === "auth_failed", "credentials reload / auth failure");
  const attemptsAfterFailure = authAttempts;
  await new Promise((resolve) => setTimeout(resolve, 800));
  assert.equal((await status()).watcherState, "auth_failed");
  assert.equal(authAttempts, attemptsAfterFailure, "auth_failed must suspend attempts across retry windows");
  console.info("WATCHER_FIXTURE auth_failed suspended: 0 new authentication attempts over 800ms (minimum reconnect=150ms)");
  await stopMailboxWatcher();
  startMailboxWatcher();
  await until(async () => (await status()).watcherState === "auth_failed", "durable auth suspension after watcher restart");
  await new Promise(resolve => setTimeout(resolve, 400));
  assert.equal(authAttempts, attemptsAfterFailure, "restarting the scheduler must preserve auth suspension");
  const suspended = startMailboxWatcher();
  assert(await suspended?.retryAccount(accountId));
  await until(async () => authAttempts > attemptsAfterFailure && (await status()).watcherState === "auth_failed", "explicit auth retry");
  const retriedAttempts = authAttempts;
  await new Promise((resolve) => setTimeout(resolve, 400));
  assert.equal(authAttempts, retriedAttempts, "explicit retry suspends again after failure");
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
