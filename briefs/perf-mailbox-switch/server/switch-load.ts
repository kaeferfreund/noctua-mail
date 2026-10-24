// Mailbox-switch spike: contention protocol. One process seeds the 12-shard fixture once, then runs phases of
// SWITCH_PHASE_MS (default 60 s) in which the main process loops the switch critical path
// (switch-account -> me -> folders -> threads page 1, 100 ms think time) for the MFA user, while children add load:
//   a  auth writer: r4 profile, busy_timeout 0, 50 ms tick: session updatedAt of the second session, every 10th tick
//      a member churn on another user (user_accounts insert/delete). Stress profile (20 writes/s).
//   b  background sync: two production runSyncOperation loops (lease queue, 30 ms pause) on two extra IMAP-fixture
//      mailboxes (other shards), fixture on 127.0.0.1:3910 (control 3911), 1 injected INBOX message per second.
//   c  second active session: another MFA user with the same 12 memberships runs its own switch loop + summary GET.
//   all a+b+c.  Phases: quiet, a, b, c, all, quiet-2.
// Usage: cd <worktree> && TMPDIR=<data dir>/tmp nice -n 10 bun --tsconfig-override tsconfig.json switch-load.ts [out.json]
// SQLITE_BUSY retries are counted from withDbWriteRetry's '[db-write-retry] retry' warnings, per step (main) and per child.
import { Database } from "bun:sqlite";
import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { loadavg } from "node:os";
import { AsyncLocalStorage } from "node:async_hooks";
// Better Auth's lifetime lock admits one app process per datastore (as in production), so the second session runs
// in-process; retries are attributed per loop through AsyncLocalStorage (withDbWriteRetry runs in the caller's context).
const loopContext = new AsyncLocalStorage<string>();
const ROOT = process.env.SWITCH_ROOT ?? process.cwd();
const role = process.argv[2] ?? "main";
const pause = (ms: number) => new Promise(r => setTimeout(r, ms));
const retries: Array<{ op: string; delayMs: number; t: number; loop?: string }> = [];
const exhausted: string[] = [];
for (const method of ["warn", "error"] as const) {
  const original = console[method].bind(console);
  console[method] = (...args: any[]) => {
    if (args[0] === "[db-write-retry] retry") { retries.push({ op: args[1]?.operation, delayMs: args[1]?.delayMs, t: performance.now(), loop: loopContext.getStore() }); return; }
    if (args[0] === "[db-write-retry] exhausted") exhausted.push(args[1]?.operation);
    return original(...args);
  };
}
const end = () => Number(process.env.PHASE_END);
const ORIGIN = "http://localhost:3000";
const q = (xs: number[], p: number) => { if (!xs.length) return NaN; const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(p * (s.length - 1) + 0.5))]; };
const stats = (xs: number[]) => ({ n: xs.length, p50: q(xs, 0.5), p90: q(xs, 0.9), p99: q(xs, 0.99), max: xs.length ? Math.max(...xs) : NaN });
const byOp = (xs: typeof retries) => xs.reduce((m, r) => (m[r.op] = (m[r.op] ?? 0) + 1, m), {} as Record<string, number>);

if (role === "auth") {
  const db = new Database(process.env.LOAD_MASTER!); db.exec("PRAGMA busy_timeout=0");
  const kinds: Record<string, { attempts: number; busy: number }> = {};
  const write = (kind: string, fn: () => void) => { const k = kinds[kind] ??= { attempts: 0, busy: 0 }; k.attempts++;
    try { fn(); } catch (e: any) { if (/locked|busy/i.test(String(e))) k.busy++; else throw e; } };
  let tick = 0, present = false; const churn = process.env.LOAD_CHURN_USER!, accounts = process.env.LOAD_ACCOUNTS!.split(",");
  while (Date.now() < end()) {
    tick++;
    if (tick % 10 === 0) write("member", () => { const id = accounts[(tick / 10) % accounts.length];
      if (present) db.prepare("DELETE FROM user_accounts WHERE userId=? AND accountId=?").run(churn, id);
      else db.prepare("INSERT OR IGNORE INTO user_accounts(userId,accountId,role) VALUES(?,?,'viewer')").run(churn, id); present = !present; });
    else write("session", () => db.prepare("UPDATE auth_session SET updatedAt=? WHERE id=?").run(new Date().toISOString(), process.env.LOAD_SESSION!));
    await pause(50);
  }
  writeFileSync(process.env.LOAD_RESULT!, JSON.stringify({ kinds })); db.close(); process.exit(0);
}
if (role === "sync") {
  const { runSyncOperation } = await import(`${ROOT}/lib/syncOperation.ts`);
  const lease = await import(`${ROOT}/lib/db/processLeases.ts`);
  const { closeAllDbConnections } = await import(`${ROOT}/lib/db/connection.ts`);
  const { drainImapConnectionPool } = await import(`${ROOT}/lib/mail/imap/connectionPool.ts`);
  const accountId = process.argv[3], owner = lease.newLeaseOwner(); let completed = 0, failed = 0; const errors: string[] = [];
  while (Date.now() < end()) {
    const jobId = crypto.randomUUID();
    try {
      await lease.queueWorker(jobId, owner, 0, accountId);
      while (Date.now() < end() && !await lease.reserveWorker(jobId, owner, 2)) await pause(20);
      if (Date.now() >= end()) break;
      await runSyncOperation({ accountId, folderId: `${accountId}:INBOX`, mode: "recent" }, "synthetic-load");
      completed++;
    } catch (e: any) { failed++; errors.push(String(e).slice(0, 200)); }
    finally { try { await lease.removeWorker(jobId, owner, true); } catch (e) { errors.push(String(e).slice(0, 200)); } }
    await pause(30);
  }
  writeFileSync(process.env.LOAD_RESULT!, JSON.stringify({ completed, failed, errors: errors.slice(0, 5), retries: byOp(retries), exhausted }));
  await drainImapConnectionPool(); closeAllDbConnections(); process.exit(0);
}
// Route-calling loop, shared by the main switching user and the second-session child.
async function routes() {
  return {
    switch: await import(`${ROOT}/app/api/auth/switch-account/route.ts`),
    me: await import(`${ROOT}/app/api/auth/me/route.ts`),
    folders: await import(`${ROOT}/app/api/accounts/[accountId]/folders/route.ts`),
    threads: await import(`${ROOT}/app/api/accounts/[accountId]/threads/route.ts`),
    summary: await import(`${ROOT}/app/api/me/mailboxes/summary/route.ts`)
  };
}
type R = Awaited<ReturnType<typeof routes>>;
const STEPS = ["switch", "me", "folders", "threads"] as const;
function step(r: R, s: string, accountId: string, cookie: string) {
  const headers: Record<string, string> = { cookie, origin: ORIGIN };
  const p = { params: Promise.resolve({ accountId }) }, enc = encodeURIComponent(accountId);
  if (s === "switch") return r.switch.POST(new Request(`${ORIGIN}/api/auth/switch-account`, { method: "POST", body: JSON.stringify({ accountId }), headers: { ...headers, "content-type": "application/json" } }));
  if (s === "me") return r.me.GET(new Request(`${ORIGIN}/api/auth/me`, { headers }));
  if (s === "folders") return r.folders.GET(new Request(`${ORIGIN}/api/accounts/${enc}/folders`, { headers }), p);
  if (s === "summary") return r.summary.GET(new Request(`${ORIGIN}/api/me/mailboxes/summary`, { headers }));
  return r.threads.GET(new Request(`${ORIGIN}/api/accounts/${enc}/threads?page=1&pageSize=300&groupBy=date&threadDateSource=latestReceivedDateValue&folderId=${encodeURIComponent(accountId + ":INBOX")}`, { headers }), p);
}
async function secondLoop(r: R, cookie: string, accounts: string[]) {
  let i = 0, n = 0, errors = 0; const statuses: Record<string, number> = {}; const firstErrors: string[] = []; const ms: number[] = [];
  while (Date.now() < end()) {
    const id = accounts[(i++ * 7) % accounts.length];
    for (const s of [...STEPS, "summary"]) { try { const t = performance.now(); const res = await step(r, s, id, cookie); await res.text(); ms.push(performance.now() - t);
      statuses[res.status] = (statuses[res.status] ?? 0) + 1; n++; } catch (e: any) { errors++; if (firstErrors.length < 3) firstErrors.push(String(e?.stack ?? e).slice(0, 3000)); } }
    await pause(25);
  }
  return { requests: n, errors, firstErrors, statuses, requestMs: stats(ms) };
}

// ---- main ----
const OUT = process.argv[2] ?? "/tmp/spike-switch-server/switch-load.json";
const PHASE_MS = Number(process.env.SWITCH_PHASE_MS ?? 60000);
const PHASES = (process.env.SWITCH_PHASES ?? "quiet,a,b,c,all,quiet-2").split(",");
process.env.NOCTUA_WATCHER_ACCOUNTS_INTERVAL_MS = "1000";
const { MAILBOXES, buildFixture } = await import("./fixture");
const fx = await buildFixture();
const { getDb } = await import(`${ROOT}/lib/db/connection.ts`);
const { getSharedTestAuthHarness } = await import(`${ROOT}/lib/testAuthHarness.ts`);
const h = await getSharedTestAuthHarness();
const master = await getDb();
// IMAP fixture (own ports 3910/3911) and two extra sync mailboxes on other shards.
const fixture = Bun.spawn([process.execPath, "scripts/dev-fixture/imap-server.ts", "--host", "127.0.0.1", "--port", "3910", "--control-port", "3911"],
  { cwd: ROOT, env: process.env, stdout: "pipe", stderr: "pipe" });
const liveChildren = new Set<any>([fixture]);
process.once("exit", () => { for (const c of liveChildren) { try { c.kill("SIGTERM"); } catch {} } }); // stop by handle, never by pattern
let fixtureText = ""; const reader = fixture.stdout.getReader();
while (!/IMAP fixture: 127\.0\.0\.1:3910/.test(fixtureText)) { const v = await reader.read(); if (v.done) throw Error("fixture exited"); fixtureText += new TextDecoder().decode(v.value); }
const endpoint = { host: "127.0.0.1", port: 3910, secure: false, user: "demo@monkeydent.test", password: "demo" };
const syncAccounts = ["syn-sync-a", "syn-sync-b"];
const { api } = fx;
for (const id of syncAccounts) {
  await api.upsertAccount({ id, name: "Synthetic sync", email: "demo@monkeydent.test", avatar: "S", imap: endpoint, smtp: endpoint } as any);
  await api.saveFoldersForAccount(id, ["INBOX", "Sent", "Archive"].map(name => ({ id: `${id}:${name}`, accountId: id, name, count: 0, unreadCount: 0, ...(name === "INBOX" ? { specialUse: "\\Inbox" } : {}) })) as any);
  const { runSyncOperation } = await import(`${ROOT}/lib/syncOperation.ts`);
  await runSyncOperation({ accountId: id, folderId: `${id}:INBOX`, mode: "recent" });
}
const churnUser = await h.createUser("churn-load@example.test", "");
// IMAP work inside a switch-triggered request: POST folder consistency (IMAP STATUS via the pooled client) on the
// fixture mailbox. First call = cold pool (connect + login), then warm. Own user with membership on the sync mailbox.
const imapProbe: any = {};
{
  const { createAuthenticatedTestSession } = await import(`${ROOT}/lib/testAuthHarness.ts`);
  const u = await createAuthenticatedTestSession(syncAccounts[0]);
  const consistency = await import(`${ROOT}/app/api/accounts/[accountId]/folders/[folderId]/consistency/route.ts`);
  const call = async () => { const t = performance.now(); const res = await consistency.POST(new Request(`${ORIGIN}/api/accounts/${syncAccounts[0]}/folders/x/consistency`,
    { method: "POST", body: "{}", headers: { cookie: u.jar.header(), origin: ORIGIN, "content-type": "application/json" } }),
    { params: Promise.resolve({ accountId: syncAccounts[0], folderId: `${syncAccounts[0]}:INBOX` }) }); const body = await res.text(); return { ms: performance.now() - t, status: res.status, body: body.slice(0, 160) }; };
  const { drainImapConnectionPool } = await import(`${ROOT}/lib/mail/imap/connectionPool.ts`);
  await drainImapConnectionPool();
  imapProbe.cold = await call();
  const warm: number[] = []; for (let i = 0; i < 30; i++) warm.push((await call()).ms);
  imapProbe.warm = stats(warm);
  const coldAgain: number[] = []; for (let i = 0; i < 5; i++) { await drainImapConnectionPool(); coldAgain.push((await call()).ms); }
  imapProbe.coldRepeat = stats(coldAgain);
  console.log("[imap-probe]", JSON.stringify(imapProbe));
}
const accounts = MAILBOXES.map(m => m.id);
const r = await routes();
const cookie = fx.user.jar.header();
for (const id of accounts) for (const s of STEPS) await (await step(r, s, id, cookie)).text(); // warm (excluded)
const results: any[] = [];
const thrown: Array<{ step: string; phase: string; stack: string }> = [];
const spawnChild = (args: string[], file: string, extraEnv: Record<string, string>) => Bun.spawn(
  [process.execPath, "--tsconfig-override", `${ROOT}/tsconfig.json`, import.meta.path, ...args],
  { cwd: ROOT, env: { ...process.env, ...extraEnv, LOAD_RESULT: file }, stdout: "ignore", stderr: Bun.file(file + ".err") });
const trackedSpawn = (args: string[], file: string, extraEnv: Record<string, string>) => { const p = spawnChild(args, file, extraEnv); liveChildren.add(p); void p.exited.then(() => liveChildren.delete(p)); return p; };
for (const phase of PHASES) {
  const start = Date.now() + 1500, deadline = start + PHASE_MS;
  process.env.PHASE_END = String(deadline);
  const common = { PHASE_END: String(deadline), LOAD_MASTER: master.filename, LOAD_ACCOUNTS: accounts.join(",") };
  const kids: Array<{ name: string; proc: any; file: string }> = [];
  const want = (k: string) => phase === k || phase === "all";
  const tmp = `${process.env.TMPDIR}/load-${phase}`;
  if (want("a")) kids.push({ name: "auth", file: `${tmp}-auth.json`, proc: trackedSpawn(["auth"], `${tmp}-auth.json`, { ...common, LOAD_SESSION: fx.second.session.id, LOAD_CHURN_USER: churnUser.id }) });
  if (want("b")) for (const id of syncAccounts) kids.push({ name: `sync-${id}`, file: `${tmp}-${id}.json`, proc: trackedSpawn(["sync", id], `${tmp}-${id}.json`, common) });
  while (Date.now() < start) await pause(10);
  const injector = want("b") ? setInterval(() => { void fetch("http://127.0.0.1:3911/inject", { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ subject: "Synthetic load injected", text: "Synthetic watcher load" }) }).catch(() => {}); }, 1000) : null;
  const loadStart = loadavg(); retries.length = 0;
  const per: Record<string, { ms: number[]; retries: number; retryOps: Record<string, number>; retryDelayMs: number; statuses: Record<string, number> }> = {};
  for (const s of STEPS) per[s] = { ms: [], retries: 0, retryOps: {}, retryDelayMs: 0, statuses: {} };
  const switchMs: number[] = []; let i = 0;
  const second = want("c") ? loopContext.run("second", () => secondLoop(r, fx.second.jar.header(), accounts)) : null;
  await loopContext.run("main", async () => {
  while (Date.now() < deadline) {
    const id = accounts[(i++ * 5) % accounts.length]; let sum = 0, ok = true;
    for (const s of STEPS) {
      const before = retries.length, t = performance.now();
      let res: Response;
      try { res = await step(r, s, id, cookie); await res.text(); }
      catch (e: any) { // unretried errors would be a 500 in production: record the full stack, count, continue
        per[s].statuses.thrown = (per[s].statuses.thrown ?? 0) + 1; if (thrown.length < 5) thrown.push({ step: s, phase, stack: String(e?.stack ?? e).slice(0, 3000) }); ok = false; break; }
      const ms = performance.now() - t; sum += ms; const p = per[s];
      if (Date.now() > deadline) { ok = false; break; }
      p.ms.push(ms); p.statuses[res.status] = (p.statuses[res.status] ?? 0) + 1;
      for (const rr of retries.slice(before).filter(x => x.loop === "main")) { p.retries++; p.retryOps[rr.op] = (p.retryOps[rr.op] ?? 0) + 1; p.retryDelayMs += rr.delayMs; }
    }
    if (ok) switchMs.push(sum);
    await pause(100);
  }
  });
  const secondResult = second ? { ...(await second), retries: byOp(retries.filter(x => x.loop === "second")) } : null;
  if (injector) clearInterval(injector);
  const loadEnd = loadavg();
  for (const k of kids) { const timer = setTimeout(() => k.proc.kill("SIGKILL"), 30000); await k.proc.exited; clearTimeout(timer); }
  const children: Record<string, any> = Object.fromEntries(kids.map(k => [k.name, existsSync(k.file) ? JSON.parse(readFileSync(k.file, "utf8")) : { missing: true, err: existsSync(k.file + ".err") ? readFileSync(k.file + ".err", "utf8").slice(-800) : "" }]));
  if (secondResult) children.second = secondResult;
  const row = { phase, loadStart, loadEnd, switches: switchMs.length, criticalPath: stats(switchMs),
    steps: Object.fromEntries(Object.entries(per).map(([s, p]) => [s, { ...stats(p.ms), retries: p.retries, retryOps: p.retryOps, retryDelayMs: p.retryDelayMs, statuses: p.statuses }])), children };
  results.push(row);
  console.log(`[phase] ${phase} switches=${row.switches} critical p50 ${row.criticalPath.p50.toFixed(1)} p90 ${row.criticalPath.p90.toFixed(1)} p99 ${row.criticalPath.p99.toFixed(1)} | ` +
    STEPS.map(s => `${s} p50 ${row.steps[s].p50.toFixed(1)} p99 ${row.steps[s].p99.toFixed(1)} retries ${row.steps[s].retries}`).join(" | ") + ` | load ${loadStart[0]}->${loadEnd[0]}`);
  writeFileSync(OUT, JSON.stringify({ root: ROOT, phaseMs: PHASE_MS, imapProbe, results, thrown }, null, 1));
  await pause(2000);
}
fixture.kill("SIGTERM"); await fixture.exited;
process.exit(0);
