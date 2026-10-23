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
async function fixture() {
  const f = await createAuthenticatedTestSession();
  const accountId = randomUUID(); const email = `activity-${accountId}@example.test`;
  await upsertAccount({ id: accountId, name: "Activity", email, avatar: "",
    imap: { host: "imap.example.test", port: 993, secure: true, user: email, password: "synthetic-imap" },
    smtp: { host: "smtp.example.test", port: 465, secure: true, user: email, password: "synthetic-smtp" } } as Account);
  await f.addMembership(f.user.id, accountId);
  const row = () => f.master.prepare("SELECT activeAccountId, updatedAt FROM auth_session WHERE id=?").get(f.session.id) as { activeAccountId: string | null; updatedAt: string } | null;
  const setUpdatedAt = (msAgo: number) => withDbWriteRetry("test.activity", () =>
    f.master.prepare("UPDATE auth_session SET updatedAt=? WHERE id=?").run(new Date(Date.now() - msAgo).toISOString(), f.session.id));
  const me = async () => { const response = await GET(req(f.jar.header())); return { status: response.status, body: response.status === 200 ? await response.json() : null }; };
  return { ...f, accountId, row, setUpdatedAt, me };
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
  ] as const) test(`revocation after the guard, on the skipped-write path: ${name} -> no selection`, async () => {
    const f = await fixture();
    await f.me();
    const session = await guard(f);
    expect(session.activeAccountId).toBe(f.accountId);
    await withDbWriteRetry("test.revoke", () => revoke(f));
    const selection = await ensureActiveAccountId(session);
    expect({ mailboxState: selection.mailboxState, accountId: selection.accountId }).toEqual({ mailboxState: "unselected", accountId: null });
    expect(session.activeAccountId).toBeNull();
  });
});
