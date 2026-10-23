// Differential suite: legacy (verbatim copy) vs current implementation, side by side on identical fixture state.
// Destination: tests/differential/accountPresentation.differential.test.ts (next to legacyAccountPresentation.ts).
// Every case runs legacy first, restores the mutable rows, then runs the new code, and compares serialized
// output byte for byte plus the post-state (session selection, memberships). The clock is frozen per case so
// generatedAt / exp / Better Auth updatedAt are identical. Synthetic data only; no module mocks.
import { afterAll, beforeAll, describe, expect, setSystemTime, test } from "bun:test";
import { Database } from "bun:sqlite";
import { createAuthenticatedTestSession, getSharedTestAuthHarness } from "@/lib/testAuthHarness";
import { dbModulePromise } from "@/lib/testDbHarness";
import { getDb } from "@/lib/db/connection";
import { recordMailboxSync } from "@/lib/db/mailboxSummary";
import { listAccessibleAccountsForUser, listAccountMembers, listAccountMembersForRole } from "@/lib/accountAccess";
import { getUserMailboxSummary } from "@/lib/mailboxSummary";
import { requireActiveUserSession } from "@/lib/auth";
import { createUserEventStream } from "@/lib/userEvents";
import { publishMailboxEvent } from "@/lib/mailboxWatcherEvents";
import { GET as meGET } from "@/app/api/auth/me/route";
import { GET as summaryGET } from "@/app/api/me/mailboxes/summary/route";
import * as legacy from "./legacyAccountPresentation";

// ---------- statement hooks (test-local; prototypes restored in afterAll) ----------
type Hook = { pattern: RegExp; shard: boolean; fn: () => void; fired: boolean };
let hooks: Hook[] = [];
let suspended = 0;
let masterHandle: object | undefined;
const proto = Database.prototype as any;
const originals = { prepare: proto.prepare, query: proto.query };
function wrapStatement(db: object, stmt: any, sql: string) {
  if (stmt.__diffWrapped) return stmt;
  stmt.__diffWrapped = true;
  for (const method of ["get", "all", "run", "values", "iterate"]) {
    const original = stmt[method];
    if (typeof original !== "function") continue;
    stmt[method] = (...args: unknown[]) => {
      const result = original.apply(stmt, args);
      if (!suspended) for (const hook of hooks) {
        if (hook.fired || !hook.pattern.test(sql) || hook.shard === (db === masterHandle || (db as any).filename === (masterHandle as any)?.filename)) continue;
        hook.fired = true; suspended++; try { hook.fn(); } finally { suspended--; }
      }
      return result;
    };
  }
  return stmt;
}
/** Fire fn once, right after the first matching statement on the master file (shard=false) or a shard (shard=true). */
function afterFirst(pattern: RegExp, shard: boolean, fn: () => void) { hooks.push({ pattern, shard, fn, fired: false }); }

// ---------- fixture ----------
const ROLES = ["manager", "editor", "viewer"] as const;
let master: Database;
let h: Awaited<ReturnType<typeof getSharedTestAuthHarness>>;
const ACCOUNTS = Array.from({ length: 12 }, (_, i) => `diff-acct-${String(i).padStart(2, "0")}`);
type Viewer = Awaited<ReturnType<typeof createAuthenticatedTestSession>> & { accountIds: string[] };
const viewers: Record<string, Viewer> = {};
let restrictedJar: { header(): string; headers(): Headers };
let restrictedId = "";
let memberIds: string[] = [];

beforeAll(async () => {
  const api = await dbModulePromise;
  master = await getDb(); masterHandle = master;
  proto.prepare = function (sql: string, ...rest: unknown[]) { return wrapStatement(this, originals.prepare.call(this, sql, ...rest), sql); };
  proto.query = function (sql: string, ...rest: unknown[]) { return wrapStatement(this, originals.query.call(this, sql, ...rest), sql); };
  h = await getSharedTestAuthHarness();
  for (const [i, id] of ACCOUNTS.entries()) {
    // Colliding names exercise the name -> normalized email -> id sort; secrets must never surface.
    const email = i % 4 === 3 ? `${i % 8 === 3 ? "B" : "a"}${i}@example.test` : ` Box${i}@Example.test `.trim();
    await api.upsertAccount({ id, name: i % 4 === 3 ? "Shared Desk" : `Mailbox ${String.fromCharCode(76 - i)}`, email, avatar: "",
      imap: { host: "imap.example.test", port: 993, secure: true, user: email, password: "synthetic-imap-secret" },
      smtp: { host: "smtp.example.test", port: 465, secure: true, user: email, password: "synthetic-smtp-secret" },
      ...(i % 3 === 0 ? { caldav: { url: "https://dav.example.test/", user: email, password: "synthetic-dav-secret" } } : {}),
      ...(i % 2 === 0 ? { deepl: { apiKey: i % 4 === 0 ? "synthetic-deepl" : "   ", enabled: true, targetLang: "DE" } } : {}) } as any);
    await api.saveFoldersForAccount(id, [{ id: `${id}:INBOX`, accountId: id, name: "INBOX", count: 0, unreadCount: 0, specialUse: "\\Inbox" }]);
    await api.upsertMessages(id, `${id}:INBOX`, Array.from({ length: 3 }, (_, m) => ({ id: `${id}-m${m}`, accountId: id, folderId: `${id}:INBOX`,
      threadId: `<t${m}@example.test>`, messageId: `<t${m}@example.test>`, subject: "Synthetic", from: "sender@example.test", to: email,
      preview: "Synthetic", body: "Synthetic", date: "2026-01-01T00:00:00.000Z", dateValue: 1767225600000 + m, unread: m < 2 })) as any);
    if (i % 2 === 0) await recordMailboxSync(id, 1767225600000 + i);
    master.prepare(`INSERT INTO sender_identities(id,accountId,email,displayName,isDefault,enabled,createdAt,updatedAt) VALUES(?,?,?,'Alias',0,1,0,0)`)
      .run(`${id}-alias`, id, `Alias${i}@example.test`);
  }
  const owner = await h.createUser("diff-owner@example.test", "");
  memberIds = [];
  for (let i = 0; i < 6; i++) memberIds.push((await h.createUser(`diff-member-${i}@example.test`, "")).id);
  master.prepare("UPDATE auth_user SET banned=1 WHERE id=?").run(memberIds[5]); // disabled member still counts
  for (const [i, id] of ACCOUNTS.entries()) {
    master.prepare("UPDATE accounts SET ownerUserId=? WHERE id=?").run(owner.id, id);
    for (let m = 0; m < i % 7; m++) await h.addMembership(memberIds[m % 6], id, ROLES[m % 3]);
  }
  // Owner also holding an explicit link (deduplicated), a link to a vanished user, an unknown role string.
  await h.addMembership(owner.id, ACCOUNTS[2], "viewer");
  master.prepare("INSERT INTO user_accounts(userId,accountId,role) VALUES('diff-ghost-user',?,'editor')").run(ACCOUNTS[4]);
  async function viewer(key: string, accountIds: string[], ownsFirst = false) {
    const v = await createAuthenticatedTestSession() as Viewer;
    for (const [i, id] of accountIds.entries()) {
      if (ownsFirst && i === 0) master.prepare("UPDATE accounts SET ownerUserId=? WHERE id=?").run(v.user.id, id);
      else await v.addMembership(v.user.id, id, ROLES[i % 3]);
    }
    viewers[key] = Object.assign(v, { accountIds });
  }
  // Boundary of `shared` (memberCount > 1): a solo mailbox (count 1) and a pair mailbox (count 2).
  for (const id of ["diff-solo", "diff-pair"]) await api.upsertAccount({ id, name: id, email: `${id}@example.test`, avatar: "",
    imap: { host: "imap.example.test", port: 993, secure: true, user: id, password: "synthetic-imap-secret" },
    smtp: { host: "smtp.example.test", port: 465, secure: true, user: id, password: "synthetic-smtp-secret" } } as any);
  master.prepare("UPDATE accounts SET ownerUserId=? WHERE id='diff-pair'").run(owner.id);
  await viewer("1", ["diff-pair"]);
  await viewer("2", ["diff-solo", ACCOUNTS[8]], true);
  await viewer("12", ACCOUNTS, true);
  await viewer("invalid-role", [ACCOUNTS[1], ACCOUNTS[7]]);
  master.prepare("UPDATE user_accounts SET role='superuser' WHERE userId=? AND accountId=?").run(viewers["invalid-role"].user.id, ACCOUNTS[1]);
  await viewer("disabled", ACCOUNTS.slice(1));
  master.prepare("UPDATE auth_user SET banned=1 WHERE id=?").run(viewers.disabled.user.id);
  const restricted = await h.createUser("diff-restricted@example.test");
  const login = await h.signIn(restricted.email);
  await h.seedSessionSecurity(login.session!.session.id, restricted.id, "setup");
  for (const id of ACCOUNTS.slice(1)) await h.addMembership(restricted.id, id, "editor");
  restrictedJar = login.jar; restrictedId = restricted.id;
});
afterAll(() => { proto.prepare = originals.prepare; proto.query = originals.query; setSystemTime(); });

// ---------- pair runner ----------
type State = { sessions: unknown[]; links: unknown[] };
const readState = (): State => ({
  sessions: master.prepare("SELECT id,activeAccountId,updatedAt,expiresAt FROM auth_session ORDER BY id").all(),
  links: master.prepare("SELECT userId,accountId,role FROM user_accounts ORDER BY userId,accountId").all()
});
function restoreState(state: State) {
  master.transaction(() => {
    master.exec("DELETE FROM user_accounts");
    const link = master.prepare("INSERT INTO user_accounts(userId,accountId,role) VALUES(?,?,?)");
    for (const row of state.links as Array<{ userId: string; accountId: string; role: string }>) link.run(row.userId, row.accountId, row.role);
    const session = master.prepare("UPDATE auth_session SET activeAccountId=?,updatedAt=? WHERE id=?");
    for (const row of state.sessions as Array<{ id: string; activeAccountId: string | null; updatedAt: string }>) session.run(row.activeAccountId, row.updatedAt, row.id);
  }).immediate();
}
async function serialize(value: unknown) {
  if (!(value instanceof Response)) return JSON.stringify(value);
  const headers = ["content-type", "cache-control"].map(k => `${k}: ${value.headers.get(k)}`);
  return JSON.stringify({ status: value.status, headers, cookies: value.headers.getSetCookie().sort(), body: await value.text() });
}
/** Runs legacy then current from the same state; arm() installs this case's mid-read injection before each run. */
async function pair(run: (impl: "legacy" | "current") => Promise<unknown>, arm?: () => void, prepare?: () => void) {
  prepare?.();
  const before = readState();
  const out: Record<string, { bytes: string; state: State }> = {};
  // Frozen after fixture/session creation (authenticatedAt must not lie in the future), identical for both runs.
  const frozen = new Date(Date.now() + 1000);
  for (const impl of ["legacy", "current"] as const) {
    restoreState(before);
    setSystemTime(frozen);
    hooks = []; arm?.();
    try {
      const result = await run(impl);
      const unfired = hooks.filter(hook => !hook.fired).map(hook => String(hook.pattern));
      hooks = []; // post-run reads must not trigger a leftover injection
      if (unfired.length) throw new Error(`${impl}: injection did not fire: ${unfired.join(", ")}`);
      out[impl] = { bytes: await serialize(result), state: readState() };
    } finally { hooks = []; setSystemTime(); }
  }
  restoreState(before);
  expect(out.current.bytes).toBe(out.legacy.bytes);
  expect(out.current.state).toEqual(out.legacy.state);
  return out.legacy.bytes;
}
const revoke = (userId: string, accountId: string) => master.prepare("DELETE FROM user_accounts WHERE userId=? AND accountId=?").run(userId, accountId);
const setRole = (userId: string, accountId: string, role: string) => master.prepare("UPDATE user_accounts SET role=? WHERE userId=? AND accountId=?").run(role, userId, accountId);
const req = (path: string, jar: { header(): string }) => new Request(`http://localhost:3000${path}`, { headers: { cookie: jar.header(), origin: "http://localhost:3000" } });
const clearSelection = (v: Viewer) => () => { master.prepare("UPDATE auth_session SET activeAccountId=NULL WHERE id=?").run(v.session.id); };
const ACCOUNT_KEYS = ["1", "2", "12", "invalid-role", "disabled"];

describe("listAccessibleAccountsForUser", () => {
  for (const key of ACCOUNT_KEYS) test(`viewer ${key}`, async () => {
    await pair(impl => (impl === "legacy" ? legacy.legacyListAccessibleAccountsForUser : listAccessibleAccountsForUser)(viewers[key].user.id));
  });
  test("mfa-restricted user (lib level sees memberships)", async () => {
    await pair(impl => (impl === "legacy" ? legacy.legacyListAccessibleAccountsForUser : listAccessibleAccountsForUser)(restrictedId));
  });
  // Injection seam: after the candidate-account read, before any role decision. Requires the new candidate
  // statement to read `FROM accounts a` and the role statement to run after it (design §5.1).
  test("revoked mid-read", async () => {
    const v = viewers["12"];
    await pair(impl => (impl === "legacy" ? legacy.legacyListAccessibleAccountsForUser : listAccessibleAccountsForUser)(v.user.id),
      () => afterFirst(/\bFROM accounts a\b/, false, () => revoke(v.user.id, ACCOUNTS[6])));
  });
  test("role downgraded mid-read", async () => {
    const v = viewers["12"];
    await pair(impl => (impl === "legacy" ? legacy.legacyListAccessibleAccountsForUser : listAccessibleAccountsForUser)(v.user.id),
      () => afterFirst(/\bFROM accounts a\b/, false, () => setRole(v.user.id, ACCOUNTS[3], "viewer")));
  });
});

describe("listAccountMembers", () => {
  for (const id of [ACCOUNTS[0], ACCOUNTS[2], ACCOUNTS[4], ACCOUNTS[5], ACCOUNTS[6], "diff-missing-account"]) test(`members ${id}`, async () => {
    await pair(impl => (impl === "legacy" ? legacy.legacyListAccountMembers : listAccountMembers)(id));
  });
  for (const role of ROLES) test(`role-filtered DTO for ${role}`, async () => {
    await pair(impl => (impl === "legacy" ? legacy.legacyListAccountMembersForRole : listAccountMembersForRole)(ACCOUNTS[6], role));
  });
  test("member revoked mid-read", async () => {
    await pair(impl => (impl === "legacy" ? legacy.legacyListAccountMembers : listAccountMembers)(ACCOUNTS[6]),
      () => afterFirst(/./, false, () => revoke(memberIds[1], ACCOUNTS[6])));
  });
});

describe("full mailbox summary", () => {
  for (const key of ACCOUNT_KEYS) {
    test(`lib viewer ${key}`, async () => {
      await pair(impl => (impl === "legacy" ? legacy.legacyGetUserMailboxSummary : getUserMailboxSummary)(viewers[key].user.id));
    });
    test(`route viewer ${key}`, async () => {
      await pair(impl => (impl === "legacy" ? legacy.legacySummaryGET : summaryGET)(req("/api/me/mailboxes/summary", viewers[key].jar)));
    });
  }
  test("route mfa-restricted", async () => {
    await pair(impl => (impl === "legacy" ? legacy.legacySummaryGET : summaryGET)(req("/api/me/mailboxes/summary", restrictedJar)));
  });
  // Injection seam: first shard statement, i.e. after the metadata read and before final authorization.
  for (const [name, mutate] of [["revoked", (v: Viewer) => revoke(v.user.id, ACCOUNTS[6])], ["role downgraded", (v: Viewer) => setRole(v.user.id, ACCOUNTS[1], "viewer")]] as const) {
    test(`route ${name} mid-read`, async () => {
      const v = viewers["12"];
      await pair(impl => (impl === "legacy" ? legacy.legacySummaryGET : summaryGET)(req("/api/me/mailboxes/summary", v.jar)),
        () => afterFirst(/./, true, () => mutate(v)));
    });
  }
});

describe("scoped summary event", () => {
  // Same production stream; only the summary reader differs (existing loadSummary seam in lib/userEvents.ts).
  async function event(v: Viewer, accountId: string, impl: "legacy" | "current") {
    const controller = new AbortController();
    const request = new Request("http://localhost:3000/api/me/events", { headers: { cookie: v.jar.header(), origin: "http://localhost:3000" }, signal: controller.signal });
    const session = await requireActiveUserSession(request);
    if (session instanceof Response) return session;
    const reader = createUserEventStream(request, session as any, { debounceMs: 0, heartbeatMs: 3_600_000,
      ...(impl === "legacy" ? { loadSummary: legacy.legacyGetUserMailboxSummary } : {}) }).getReader();
    const chunks: string[] = [];
    const pump = (async () => { for (;;) { const { value, done } = await reader.read(); if (done) return; chunks.push(new TextDecoder().decode(value)); } })();
    while (!chunks.length) await Bun.sleep(1);
    publishMailboxEvent({ accountId, type: "synced" } as any);
    for (let i = 0; i < 200 && chunks.length < 2; i++) await Bun.sleep(2); // a delivered event, or none after 400 ms
    controller.abort(); await pump.catch(() => {});
    return chunks.slice(1);
  }
  for (const key of ["1", "2", "12"]) test(`own mailbox, viewer ${key}`, async () => {
    const v = viewers[key];
    await pair(impl => event(v, v.accountIds.at(-1)!, impl));
  });
  test("foreign mailbox emits nothing", async () => { await pair(impl => event(viewers["2"], ACCOUNTS[0], impl)); });
  test("disabled viewer stream denied", async () => { await pair(impl => event(viewers.disabled, ACCOUNTS[2], impl)); });
  test("revoked mid-read emits nothing", async () => {
    const v = viewers["12"];
    await pair(impl => event(v, ACCOUNTS[6], impl), () => afterFirst(/./, true, () => revoke(v.user.id, ACCOUNTS[6])));
  });
  test("lib scope narrowing incl. foreign and duplicate ids", async () => {
    const v = viewers["12"];
    await pair(impl => (impl === "legacy" ? legacy.legacyGetUserMailboxSummary : getUserMailboxSummary)(v.user.id, [ACCOUNTS[4], "diff-unknown", ACCOUNTS[4]]));
  });
});

describe("/api/auth/me", () => {
  for (const key of ACCOUNT_KEYS) {
    test(`viewer ${key}, persisted selection`, async () => {
      await pair(impl => (impl === "legacy" ? legacy.legacyMeGET : meGET)(req("/api/auth/me", viewers[key].jar)));
    });
    test(`viewer ${key}, null selection`, async () => {
      await pair(impl => (impl === "legacy" ? legacy.legacyMeGET : meGET)(req("/api/auth/me", viewers[key].jar)), undefined, clearSelection(viewers[key]));
    });
  }
  test("mfa-restricted payload", async () => {
    await pair(impl => (impl === "legacy" ? legacy.legacyMeGET : meGET)(req("/api/auth/me", restrictedJar)));
  });
  // Injection seam: the session selection UPDATE (Better Auth adapter, auth handle on the master file),
  // the same boundary as app/api/auth/me/route.test.ts. Selection starts NULL, so both implementations write.
  for (const [name, mutate] of [
    ["selected mailbox revoked", (v: Viewer) => { const row = master.prepare("SELECT activeAccountId FROM auth_session WHERE id=?").get(v.session.id) as { activeAccountId: string | null }; if (row.activeAccountId) revoke(v.user.id, row.activeAccountId); }],
    ["manager downgraded", (v: Viewer) => setRole(v.user.id, ACCOUNTS[1], "viewer")],
    ["other mailbox revoked", (v: Viewer) => revoke(v.user.id, ACCOUNTS[9])]
  ] as const) test(`${name} during selection persistence`, async () => {
    const v = viewers["12"];
    await pair(impl => (impl === "legacy" ? legacy.legacyMeGET : meGET)(req("/api/auth/me", v.jar)),
      () => afterFirst(/^update "auth_session"/i, false, () => mutate(v)), clearSelection(v));
  });
});
