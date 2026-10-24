import { describe, expect, test } from "bun:test";
import { randomUUID } from "crypto";
import { GET } from "./route";
import { createAuthenticatedTestSession } from "@/lib/testAuthHarness";
import { dbModulePromise } from "@/lib/testDbHarness";
import { withDbWriteRetry } from "@/lib/dbWriteRetry";
import { ensureActiveAccountId, requireActiveUserSession, SESSION_ACTIVITY_WRITE_INTERVAL_MS, type ActiveUserSession } from "@/lib/auth";
import type { Account } from "@/lib/data";

// Owner decision 2 (variant c): the /auth/me selection write is skipped while the selection is unchanged and the
// session's updatedAt ("Last active") is younger than five minutes; liveness is still read on every request.
const { upsertAccount } = await dbModulePromise;
const req = (cookie: string) => new Request("http://localhost:3000/api/auth/me", { headers: { cookie, origin: "http://localhost:3000" } });
async function addMailbox(f: Awaited<ReturnType<typeof createAuthenticatedTestSession>>, name: string) {
  const accountId = randomUUID(); const email = `activity-${accountId}@example.test`;
  await upsertAccount({ id: accountId, name, email, avatar: "",
    imap: { host: "imap.example.test", port: 993, secure: true, user: email, password: "synthetic-imap" },
    smtp: { host: "smtp.example.test", port: 465, secure: true, user: email, password: "synthetic-smtp" } } as Account);
  await f.addMembership(f.user.id, accountId);
  return accountId;
}
async function fixture() {
  const f = await createAuthenticatedTestSession();
  const accountId = await addMailbox(f, "Activity");
  const row = () => f.master.prepare("SELECT activeAccountId, updatedAt FROM auth_session WHERE id=?").get(f.session.id) as { activeAccountId: string | null; updatedAt: string } | null;
  const setUpdatedAt = (msAgo: number) => withDbWriteRetry("test.activity", () =>
    f.master.prepare("UPDATE auth_session SET updatedAt=? WHERE id=?").run(new Date(Date.now() - msAgo).toISOString(), f.session.id));
  const me = async () => { const response = await GET(req(f.jar.header())); return { status: response.status, body: response.status === 200 ? await response.json() : null }; };
  return { ...f, accountId, row, setUpdatedAt, me, addMailbox: (name: string) => addMailbox(f, name) };
}
async function guard(f: Awaited<ReturnType<typeof fixture>>) {
  const session = await requireActiveUserSession(req(f.jar.header()), { allowRestricted: true });
  if (session instanceof Response) throw new Error(`guard denied: ${session.status}`);
  return session as ActiveUserSession;
}

describe("/auth/me session activity write", () => {
  test("an unchanged, fresh selection is not rewritten; a stale one refreshes Last active", async () => {
    const f = await fixture();
    expect((await f.me()).body.accountId).toBe(f.accountId);
    await f.setUpdatedAt(60_000);
    const fresh = f.row()!;
    expect((await f.me()).body).toMatchObject({ accountId: f.accountId, mailboxState: "selected" });
    expect(f.row()).toEqual(fresh);
    await f.setUpdatedAt(SESSION_ACTIVITY_WRITE_INTERVAL_MS + 1000);
    const before = Date.now();
    expect((await f.me()).body.accountId).toBe(f.accountId);
    const age = Date.now() - new Date(f.row()!.updatedAt).getTime();
    expect(new Date(f.row()!.updatedAt).getTime()).toBeGreaterThanOrEqual(before - 1000);
    expect(age).toBeLessThan(SESSION_ACTIVITY_WRITE_INTERVAL_MS);
  });

  test("a changed selection is written immediately even when the activity is fresh", async () => {
    const f = await fixture();
    await f.me();
    await withDbWriteRetry("test.revoke", () => f.master.prepare("DELETE FROM user_accounts WHERE userId=? AND accountId=?").run(f.user.id, f.accountId));
    await f.setUpdatedAt(1000);
    expect((await f.me()).body).toMatchObject({ accountId: null, mailboxState: "none", accounts: [] });
    expect(f.row()!.activeAccountId).toBeNull();
  });

  for (const [name, revoke] of [
    ["session deleted", (f: Awaited<ReturnType<typeof fixture>>) => f.master.prepare("DELETE FROM auth_session WHERE id=?").run(f.session.id)],
    ["security generation bumped", (f: Awaited<ReturnType<typeof fixture>>) => f.master.prepare("UPDATE auth_security_state SET generation=generation+1 WHERE userId=?").run(f.user.id)],
    ["user disabled", (f: Awaited<ReturnType<typeof fixture>>) => f.master.prepare("UPDATE auth_user SET banned=1 WHERE id=?").run(f.user.id)]
  ] as const) test(`revocation between two requests inside the interval: ${name} -> 401`, async () => {
    const f = await fixture();
    expect((await f.me()).status).toBe(200);
    await withDbWriteRetry("test.revoke", () => revoke(f));
    expect((await f.me()).status).toBe(401);
  });

  for (const [name, revoke] of [
    ["session deleted", (f: Awaited<ReturnType<typeof fixture>>) => f.master.prepare("DELETE FROM auth_session WHERE id=?").run(f.session.id)],
    ["security generation bumped", (f: Awaited<ReturnType<typeof fixture>>) => f.master.prepare("UPDATE auth_security_state SET generation=generation+1 WHERE userId=?").run(f.user.id)],
    ["session expired", (f: Awaited<ReturnType<typeof fixture>>) => f.master.prepare("UPDATE auth_session SET expiresAt=? WHERE id=?").run(new Date(Date.now() - 1000).toISOString(), f.session.id)]
  ] as const) for (const stale of [false, true]) test(`revocation after the guard, on the ${stale ? "stale-activity write" : "skipped-write"} path: ${name} -> no selection`, async () => {
    const f = await fixture();
    await f.me();
    if (stale) await f.setUpdatedAt(SESSION_ACTIVITY_WRITE_INTERVAL_MS + 1000);
    const session = await guard(f);
    expect(session.activeAccountId).toBe(f.accountId);
    await withDbWriteRetry("test.revoke", () => revoke(f));
    const selection = await ensureActiveAccountId(session);
    expect({ mailboxState: selection.mailboxState, accountId: selection.accountId }).toEqual({ mailboxState: "unselected", accountId: null });
    expect(session.activeAccountId).toBeNull();
  });

  test("selected mailbox revoked between the selection pre-read and the access read, on the skipped-write path", async () => {
    const f = await fixture();
    const other = await f.addMailbox("Zulu Activity");
    expect((await f.me()).body.accountId).toBe(f.accountId);
    const session = await guard(f);
    expect(session.activeAccountId).toBe(f.accountId);
    // Hooks only this request's pre-read on the shared handle; the cached statement itself stays unpatched.
    const query = f.master.query;
    const ownQuery = Object.hasOwn(f.master, "query");
    let fired = false;
    f.master.query = ((sql: string) => {
      const statement = query.call(f.master, sql);
      if (fired || !/^\s*SELECT DISTINCT a\.id, a\.name, a\.email\b/.test(sql)) return statement;
      return { all: (...args: unknown[]) => {
        const rows = statement.all(...(args as []));
        fired = true;
        f.master.prepare("DELETE FROM user_accounts WHERE userId=? AND accountId=?").run(f.user.id, f.accountId);
        return rows;
      } };
    }) as typeof f.master.query;
    let selection: Awaited<ReturnType<typeof ensureActiveAccountId>>;
    try { selection = await ensureActiveAccountId(session); } finally {
      if (ownQuery) f.master.query = query; else delete (f.master as { query?: unknown }).query;
    }
    expect(fired).toBe(true);
    expect({ mailboxState: selection.mailboxState, accountId: selection.accountId }).toEqual({ mailboxState: "selected", accountId: other });
    expect(selection.access.candidateIds).toEqual([other]);
    expect(session.activeAccountId).toBe(other);
    expect(f.row()!.activeAccountId).toBe(other);
  });

  // A switch-account that commits after this request's getSession read must survive the request's selection
  // write (backlog: /auth/me write-back of an old selection, cross-tab lost switch with stale activity).
  const switchTo = async (f: Awaited<ReturnType<typeof fixture>>, accountId: string) => {
    const { setActiveAccountId } = await import("@/lib/betterAuth");
    expect(await setActiveAccountId(f.auth, f.session.token, accountId)).toBeTruthy();
  };
  test("a stale-activity write does not overwrite a switch committed after the session read", async () => {
    const f = await fixture();
    const other = await f.addMailbox("Zulu Activity");
    expect((await f.me()).body.accountId).toBe(f.accountId);
    await f.setUpdatedAt(SESSION_ACTIVITY_WRITE_INTERVAL_MS + 1000);
    const session = await guard(f);
    expect(session.activeAccountId).toBe(f.accountId);
    await switchTo(f, other);
    const selection = await ensureActiveAccountId(session);
    expect({ mailboxState: selection.mailboxState, accountId: selection.accountId }).toEqual({ mailboxState: "selected", accountId: other });
    expect(selection.access.candidateIds.sort()).toEqual([f.accountId, other].sort());
    expect(session.activeAccountId).toBe(other);
    expect(f.row()!.activeAccountId).toBe(other);
    expect((await f.me()).body.accountId).toBe(other);
  });

  test("a default chosen for an empty selection does not overwrite a switch committed after the session read", async () => {
    const f = await fixture();
    const other = await f.addMailbox("Zulu Activity");
    await f.me();
    await withDbWriteRetry("test.clear", () => f.master.prepare("UPDATE auth_session SET activeAccountId=NULL WHERE id=?").run(f.session.id));
    const session = await guard(f);
    expect(session.activeAccountId).toBeNull();
    await switchTo(f, other);
    const selection = await ensureActiveAccountId(session);
    expect(selection.accountId).toBe(other);
    expect(f.row()!.activeAccountId).toBe(other);
  });

  test("an adopted switch is rechecked: revoked after it committed -> the default is written", async () => {
    const f = await fixture();
    const other = await f.addMailbox("Zulu Activity");
    await f.me();
    await f.setUpdatedAt(SESSION_ACTIVITY_WRITE_INTERVAL_MS + 1000);
    const session = await guard(f);
    await switchTo(f, other);
    await withDbWriteRetry("test.revoke", () => f.master.prepare("DELETE FROM user_accounts WHERE userId=? AND accountId=?").run(f.user.id, other));
    const selection = await ensureActiveAccountId(session);
    expect({ mailboxState: selection.mailboxState, accountId: selection.accountId }).toEqual({ mailboxState: "selected", accountId: f.accountId });
    expect(selection.access.candidateIds).toEqual([f.accountId]);
    expect(f.row()!.activeAccountId).toBe(f.accountId);
  });
});
