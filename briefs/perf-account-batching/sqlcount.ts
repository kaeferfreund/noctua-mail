// SQL-count baseline for the account-batching spike (outside git; reusable unchanged on the batched tree).
//
//   cd <worktree> && TMPDIR=<worktree>/.tmp/tmp nice -n 10 bun --tsconfig-override tsconfig.json \
//     /home/monkey/code/noctua-mail/briefs/perf-account-batching/sqlcount.ts [out.json]
//
// Env: SQLCOUNT_ROOT (default cwd), SQLCOUNT_RUNS (default 9, after one warm-up), SQLCOUNT_ONLY (regex on scenario id).
// Synthetic data only, in a fresh testDbHarness data dir under TMPDIR (removed on exit).
// Only public entry points are called (route GET handlers, lib exports, the real SSE stream),
// so the same script measures the legacy and the batched implementation.
import { writeFileSync } from "node:fs";
import { loadavg } from "node:os";
import * as counter from "./sqlcounter";

const ROOT = process.env.SQLCOUNT_ROOT ?? process.cwd();
const RUNS = Number(process.env.SQLCOUNT_RUNS ?? 9);
const ONLY = process.env.SQLCOUNT_ONLY ? new RegExp(process.env.SQLCOUNT_ONLY) : null;
const OUT = process.argv[2] ?? `${import.meta.dir}/sqlcount-results.json`;
await import(`${ROOT}/lib/testSetupEnv.ts`);
delete process.env.NOCTUA_MAILBOX_WATCHER;

const { dbModulePromise } = await import(`${ROOT}/lib/testDbHarness.ts`);
const api = await dbModulePromise;
const { getDb, getAuthDb, getAccountDb } = await import(`${ROOT}/lib/db/connection.ts`);
const { getMainDbPath } = await import(`${ROOT}/lib/runtimePaths.ts`);
const { createAuthenticatedTestSession, getSharedTestAuthHarness } = await import(`${ROOT}/lib/testAuthHarness.ts`);
const { setActiveAccountId } = await import(`${ROOT}/lib/betterAuth.ts`);
const { recordMailboxSync } = await import(`${ROOT}/lib/db/mailboxSummary.ts`);
const { listAccessibleAccountsForUser, listAccountMembers } = await import(`${ROOT}/lib/accountAccess.ts`);
const { getUserMailboxSummary } = await import(`${ROOT}/lib/mailboxSummary.ts`);
const { requireActiveUserSession } = await import(`${ROOT}/lib/auth.ts`);
const { createUserEventStream } = await import(`${ROOT}/lib/userEvents.ts`);
const { publishMailboxEvent } = await import(`${ROOT}/lib/mailboxWatcherEvents.ts`);
const meRoute = await import(`${ROOT}/app/api/auth/me/route.ts`);
const summaryRoute = await import(`${ROOT}/app/api/me/mailboxes/summary/route.ts`);

const master = await getDb();
const h = await getSharedTestAuthHarness();
counter.labelHandle(master, "master");
counter.labelHandle(await getAuthDb(), "auth");
counter.setMainPath(getMainDbPath());

// ---- fixture: 12 mailboxes, 6 plain members (one disabled), viewers with 1 / 2 / 12 mailboxes ----
const ACCOUNTS = Array.from({ length: 12 }, (_, i) => `syn-acct-${String(i).padStart(2, "0")}`);
// Names collide on purpose (sort falls through to normalized email, then id).
const accountName = (i: number) => i % 4 === 3 ? "Shared Desk" : `Mailbox ${String.fromCharCode(76 - i)}`;
for (const [i, id] of ACCOUNTS.entries()) {
  const email = `${i % 4 === 3 ? (i % 8 === 3 ? "B" : "a") : "box"}${i}@example.test`;
  await api.upsertAccount({ id, name: accountName(i), email, avatar: "",
    imap: { host: "imap.example.test", port: 993, secure: true, user: email, password: "synthetic-imap-secret" },
    smtp: { host: "smtp.example.test", port: 465, secure: true, user: email, password: "synthetic-smtp-secret" },
    ...(i % 3 === 0 ? { caldav: { url: "https://dav.example.test/", user: email, password: "synthetic-dav" } } : {}),
    ...(i % 2 === 0 ? { deepl: { apiKey: "synthetic-deepl", enabled: true, targetLang: "DE" } } : {}) } as any);
  const folderId = `${id}:INBOX`;
  await api.saveFoldersForAccount(id, [{ id: folderId, accountId: id, name: "INBOX", count: 0, unreadCount: 0, specialUse: "\\Inbox" }]);
  await api.upsertMessages(id, folderId, Array.from({ length: 3 }, (_, m) => ({
    id: `${id}-m${m}`, accountId: id, folderId, threadId: `<t${m}@example.test>`, messageId: `<t${m}@example.test>`,
    subject: "Synthetic", from: "sender@example.test", to: email, preview: "Synthetic", body: "Synthetic",
    date: "2026-01-01T00:00:00.000Z", dateValue: 1767225600000 + m, unread: m < 2 })) as any);
  if (i % 2 === 0) await recordMailboxSync(id, 1767225600000 + i);
  master.prepare(`INSERT INTO sender_identities(id,accountId,email,displayName,isDefault,enabled,createdAt,updatedAt)
    VALUES(?,?,?,'Synthetic alias',0,1,0,0)`).run(`${id}-alias`, id, `alias${i}@example.test`);
}
const members = [];
for (let i = 0; i < 6; i++) members.push(await h.createUser(`member-${i}@example.test`, ""));
master.prepare("UPDATE auth_user SET banned=1 WHERE id=?").run(members[5].id); // disabled member
const owner = await h.createUser("owner@example.test", "");
for (const [i, id] of ACCOUNTS.entries()) {
  master.prepare("UPDATE accounts SET ownerUserId=? WHERE id=?").run(owner.id, id);
  for (let m = 0; m < i % 7; m++) await h.addMembership(members[m % 6].id, id, ["viewer", "editor", "manager"][m % 3]);
}
type Viewer = Awaited<ReturnType<typeof createAuthenticatedTestSession>> & { accountIds: string[]; label: string };
const ROLES = ["manager", "editor", "viewer"];
async function viewer(label: string, accountIds: string[], ownsFirst = false): Promise<Viewer> {
  const v = await createAuthenticatedTestSession();
  for (const [i, id] of accountIds.entries()) {
    if (ownsFirst && i === 0) master.prepare("UPDATE accounts SET ownerUserId=? WHERE id=?").run(v.user.id, id);
    else await v.addMembership(v.user.id, id, ROLES[i % 3]);
  }
  return Object.assign(v, { accountIds, label });
}
const viewers = {
  v1: await viewer("1", [ACCOUNTS[5]]),
  v2: await viewer("2", [ACCOUNTS[3], ACCOUNTS[8]]),
  v12: await viewer("12", ACCOUNTS, true),
  disabled: await viewer("12-disabled", ACCOUNTS.slice(1)),
  revoked: await viewer("12-revoked", ACCOUNTS.slice(1)),
};
master.prepare("UPDATE auth_user SET banned=1 WHERE id=?").run(viewers.disabled.user.id);
// MFA-restricted: password session, no TOTP, setup assurance; 12 memberships.
const restrictedUser = await h.createUser("restricted@example.test");
const restrictedLogin = await h.signIn(restrictedUser.email);
await h.seedSessionSecurity(restrictedLogin.session!.session.id, restrictedUser.id, "setup");
for (const [i, id] of ACCOUNTS.slice(1).entries()) await h.addMembership(restrictedUser.id, id, ROLES[i % 3]);
const restricted = { user: restrictedUser, jar: restrictedLogin.jar, session: restrictedLogin.session!.session, accountIds: ACCOUNTS.slice(1), label: "12-mfa-restricted" };

const revokeTarget = ACCOUNTS[6];
function restoreRevoked() {
  for (const [i, id] of viewers.revoked.accountIds.entries())
    master.prepare("INSERT OR IGNORE INTO user_accounts(userId,accountId,role) VALUES(?,?,?)").run(viewers.revoked.user.id, id, ROLES[i % 3]);
  master.prepare("INSERT OR IGNORE INTO user_accounts(userId,accountId,role) VALUES(?,?,'viewer')").run(members[0].id, ACCOUNTS[1]);
  master.prepare("UPDATE auth_session SET activeAccountId=NULL WHERE id=?").run(viewers.revoked.session.id);
}
const revoke = (userId: string, accountId: string) => master.prepare("DELETE FROM user_accounts WHERE userId=? AND accountId=?").run(userId, accountId);

// ---- entry points ----
const request = (path: string, jar: { header(): string }) => new Request(`http://localhost:3000${path}`, { headers: { cookie: jar.header(), origin: "http://localhost:3000" } });
async function route(handler: (r: Request) => Promise<Response>, path: string, jar: { header(): string }) {
  const response = await handler(request(path, jar));
  const body = await response.text();
  return { status: response.status, bytes: body.length };
}
type Stream = { publish(accountId: string): Promise<{ delivered: boolean; ms: number }>; close(): void };
const streams = new Map<string, Stream>();
// Every open user stream handles every mailbox event, so per-stream scenarios keep exactly one stream open.
async function openStream(v: { jar: { header(): string } }, key: string, exclusive = true): Promise<Stream | null> {
  if (exclusive) for (const [k, s] of streams) if (k !== key) { s.close(); streams.delete(k); }
  if (streams.has(key)) return streams.get(key)!;
  const controller = new AbortController();
  const req = new Request("http://localhost:3000/api/me/events", { headers: { cookie: v.jar.header(), origin: "http://localhost:3000" }, signal: controller.signal });
  const session = await requireActiveUserSession(req);
  if (session instanceof Response) return null;
  const reader = createUserEventStream(req, session as any, { debounceMs: 0, heartbeatMs: 3_600_000 }).getReader();
  const chunks: string[] = [];
  void (async () => { for (;;) { const { value, done } = await reader.read(); if (done) return; chunks.push(new TextDecoder().decode(value)); } })();
  while (!chunks.length) await Bun.sleep(5); // initial heartbeat, outside the window
  const stream: Stream = {
    async publish(accountId) {
      const fanout = streams.size > 1;
      const before = chunks.length, start = performance.now();
      let execs = counter.state.total.execs, quiet = performance.now(), last = start;
      publishMailboxEvent({ accountId, type: "synced" } as any);
      // Done when a chunk arrives, or when no statement ran for 40 ms after the debounce fired.
      for (;;) {
        await Bun.sleep(1);
        if (chunks.length > before && !fanout) return { delivered: true, ms: performance.now() - start };
        if (counter.state.total.execs !== execs) { execs = counter.state.total.execs; quiet = last = performance.now(); }
        else if (performance.now() - quiet > 40 && execs > 0) return { delivered: false, ms: last - start };
        if (performance.now() - start > 5000) return { delivered: false, ms: NaN };
      }
    },
    close() { controller.abort(); }
  };
  streams.set(key, stream);
  return stream;
}

type Scenario = { id: string; entry: string; variant: string; accounts: number | string; setup?: () => void; trigger?: () => void;
  run: () => Promise<Record<string, unknown> | void> };
const scenarios: Scenario[] = [];
const normal: Array<[keyof typeof viewers, string]> = [["v1", "normal"], ["v2", "normal"], ["v12", "normal"]];
for (const [key, variant] of [...normal, ["disabled", "disabled"], ["revoked", "revoked-mid-read"]] as const) {
  const v = viewers[key]; const revoked = variant === "revoked-mid-read";
  const base = { variant, accounts: v.accountIds.length, setup: revoked ? restoreRevoked : undefined };
  scenarios.push({ ...base, id: `accessible/${v.label}`, entry: "listAccessibleAccountsForUser",
    trigger: revoked ? () => counter.afterFirst(/\bFROM accounts\b/i, () => revoke(v.user.id, revokeTarget), "master") : undefined,
    run: async () => ({ rows: (await listAccessibleAccountsForUser(v.user.id)).length }) });
  scenarios.push({ ...base, id: `summary-lib/${v.label}`, entry: "getUserMailboxSummary(all)",
    trigger: revoked ? () => counter.afterFirst(/./, () => revoke(v.user.id, revokeTarget), "shard") : undefined,
    run: async () => ({ rows: (await getUserMailboxSummary(v.user.id)).mailboxes.length }) });
  scenarios.push({ ...base, id: `summary-route/${v.label}`, entry: "GET /api/me/mailboxes/summary",
    trigger: revoked ? () => counter.afterFirst(/./, () => revoke(v.user.id, revokeTarget), "shard") : undefined,
    run: () => route(summaryRoute.GET, "/api/me/mailboxes/summary", v.jar) });
  const scoped = revoked ? revokeTarget : v.accountIds.at(-1)!;
  scenarios.push({ ...base, id: `scoped-lib/${v.label}`, entry: "getUserMailboxSummary(scope=1)",
    trigger: revoked ? () => counter.afterFirst(/./, () => revoke(v.user.id, revokeTarget), "shard") : undefined,
    run: async () => ({ rows: (await getUserMailboxSummary(v.user.id, [scoped])).mailboxes.length }) });
  scenarios.push({ ...base, id: `scoped-event/${v.label}`, entry: "SSE mailbox-summary event (scope=1)",
    trigger: revoked ? () => counter.afterFirst(/./, () => revoke(v.user.id, revokeTarget), "shard") : undefined,
    run: async () => { const s = await openStream(v, v.label); return s ? s.publish(scoped) : { status: "stream-denied" }; } });
  scenarios.push({ ...base, id: `me/${v.label}`, entry: "GET /api/auth/me",
    trigger: revoked ? () => counter.afterFirst(/update\s+"?auth_session"?/i, () => {
      const row = master.prepare("SELECT activeAccountId FROM auth_session WHERE id=?").get(v.session.id) as { activeAccountId: string | null };
      if (row?.activeAccountId) revoke(v.user.id, row.activeAccountId);
    }, "auth") : undefined,
    run: () => route(meRoute.GET, "/api/auth/me", v.jar) });
}
// Foreign mailbox event: every user stream schedules a scoped read for every mailbox event.
const foreign = ACCOUNTS.find(id => !viewers.v2.accountIds.includes(id))!;
scenarios.push({ id: "scoped-event/2-foreign-mailbox", entry: "SSE mailbox-summary event (scope=1)", variant: "foreign mailbox", accounts: 2,
  run: async () => (await openStream(viewers.v2, viewers.v2.label))!.publish(foreign) });
scenarios.push({ id: "scoped-event/11-foreign-mailbox", entry: "SSE mailbox-summary event (scope=1)", variant: "foreign mailbox", accounts: 11, setup: restoreRevoked,
  run: async () => (await openStream(viewers.revoked, viewers.revoked.label))!.publish(ACCOUNTS[0]) });
// Fan-out: one mailbox event with four connected users (1, 2, 12 and 11 mailboxes); every stream re-reads access metadata.
scenarios.push({ id: "event-fanout/4-streams", entry: "SSE fan-out, 1 event x 4 open streams", variant: "normal", accounts: "1+2+12+11", setup: restoreRevoked,
  run: async () => {
    for (const [k, s] of streams) if (!k.startsWith("fanout-")) { s.close(); streams.delete(k); }
    for (const v of [viewers.v1, viewers.v2, viewers.v12, viewers.revoked]) await openStream(v, "fanout-" + v.label, false);
    return [...streams.values()][0].publish(ACCOUNTS[5]);
  } });
// MFA-restricted session: restricted /auth/me payload, 403 elsewhere; lib entry points do not see MFA state.
scenarios.push({ id: "me/12-mfa-restricted", entry: "GET /api/auth/me", variant: "mfa-restricted", accounts: 11, run: () => route(meRoute.GET, "/api/auth/me", restricted.jar) });
scenarios.push({ id: "summary-route/12-mfa-restricted", entry: "GET /api/me/mailboxes/summary", variant: "mfa-restricted", accounts: 11, run: () => route(summaryRoute.GET, "/api/me/mailboxes/summary", restricted.jar) });
scenarios.push({ id: "accessible/12-mfa-restricted", entry: "listAccessibleAccountsForUser", variant: "mfa-restricted", accounts: 11, run: async () => ({ rows: (await listAccessibleAccountsForUser(restricted.user.id)).length }) });
// Members: legacy cost grows with all users (getUsers), not with the mailbox's member count.
for (const [i, variant] of [[0, "owner only (0 links)"], [5, "5 links incl. disabled member"], [6, "6 links incl. disabled member"]] as const) {
  const id = ACCOUNTS[i];
  scenarios.push({ id: `members/${id}`, entry: "listAccountMembers", variant, accounts: 1, run: async () => ({ rows: (await listAccountMembers(id)).length }) });
}
scenarios.push({ id: `members/${ACCOUNTS[1]}-revoked`, entry: "listAccountMembers", variant: "revoked-mid-read", accounts: 1, setup: restoreRevoked,
  trigger: () => counter.afterFirst(/./, () => revoke(members[0].id, ACCOUNTS[1]), "master"),
  run: async () => ({ rows: (await listAccountMembers(ACCOUNTS[1])).length }) });

// ---- measure ----
const median = (values: number[]) => { const s = [...values].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
const results = [];
const startLoad = loadavg();
for (const scenario of scenarios) {
  if (ONLY && !ONLY.test(scenario.id)) continue;
  const samples = [];
  for (let i = 0; i <= RUNS; i++) {
    scenario.setup?.();
    counter.reset(); scenario.trigger?.();
    counter.state.enabled = true;
    const start = performance.now();
    const out = (await scenario.run()) ?? {};
    const ms = typeof (out as any).ms === "number" ? (out as any).ms : performance.now() - start;
    counter.state.enabled = false;
    if (i > 0) samples.push({ ms, out, ...counter.snapshot() });
  }
  const pick = (f: (s: any) => number) => samples.map(f);
  const row = {
    id: scenario.id, entry: scenario.entry, variant: scenario.variant, accounts: scenario.accounts,
    ms: median(pick(s => s.ms)), msMin: Math.min(...pick(s => s.ms)), msMax: Math.max(...pick(s => s.ms)),
    compiles: median(pick(s => s.total.compiles)), cached: median(pick(s => s.total.cached)),
    execs: median(pick(s => s.total.execs)), txs: median(pick(s => s.total.txs)),
    execsRange: [Math.min(...pick(s => s.total.execs)), Math.max(...pick(s => s.total.execs))],
    result: samples.at(-1)!.out, byHandle: samples.at(-1)!.byHandle, statements: samples.at(-1)!.statements
  };
  results.push(row);
  console.log(`${row.id.padEnd(36)} ${String(row.compiles).padStart(4)} compiles ${String(row.cached).padStart(4)} cached ${String(row.execs).padStart(4)} execs ${String(row.txs).padStart(2)} tx ${row.ms.toFixed(2).padStart(8)} ms  ${JSON.stringify(row.result)}`);
}
for (const s of streams.values()) s.close();
writeFileSync(OUT, JSON.stringify({ root: ROOT, runs: RUNS, bun: Bun.version, startLoad, endLoad: loadavg(), at: new Date().toISOString(), results }, null, 2));
console.log("wrote", OUT);
process.exit(0);
