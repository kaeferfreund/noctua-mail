import { beforeAll, describe, expect, test } from "bun:test";
import { NextResponse } from "next/server";
import { createAuthenticatedTestSession } from "./testAuthHarness";
import { createCollabFixture } from "./testThreadCollabHarness";
import { requireActiveUserSession } from "./auth";
import { getDb } from "./db/connection";
import * as collab from "./threadCollab";
let principal: Awaited<ReturnType<typeof createAuthenticatedTestSession>>;
beforeAll(async () => { principal = await createAuthenticatedTestSession(); });
async function fixture() {
  const f = await createCollabFixture();
  await principal.addMembership(principal.user.id, f.accountId, "editor");
  const session = await requireActiveUserSession(new Request("http://localhost:3000/api/auth/me", { headers: principal.jar.headers() }));
  if (session instanceof NextResponse)
    throw new Error("Synthetic authenticated session was rejected");
  return { ...f, actor: collab.collabActorFromSession(session, "browser_1"), thread: "<domain@example.test>" };
}
describe("collaboration domain", () => {
  test("actor comes from a real assured session; validates role, member and status", async () => {
    const f = await fixture();
    await f.seed(f.message(f.thread));
    expect(f.actor).toEqual({ userId: principal.user.id, clientId: "web:browser_1" });
    for (const status of ["in_progress", "waiting", "closed", "open"] as const) {
      expect((await collab.updateThreadCollabState(f.accountId, f.thread, { status }, f.actor))!.status).toBe(status);
    }
    await expect(collab.updateThreadCollabState(f.accountId, f.thread, { status: "done" as collab.ThreadStatus }, f.actor)).rejects.toMatchObject({ status: 400 });
    await expect(collab.updateThreadCollabState(f.accountId, f.thread, { assigneeUserId: "non-member" }, f.actor)).rejects.toMatchObject({ status: 400 });
    await expect(collab.updateThreadCollabState(f.accountId, f.thread, { status: "closed" }, { userId: null, clientId: "system" })).rejects.toMatchObject({ status: 403 });
    (await getDb()).prepare("UPDATE user_accounts SET role='viewer' WHERE userId=? AND accountId=?").run(principal.user.id, f.accountId);
    await expect(collab.addThreadComment(f.accountId, f.thread, "denied", f.actor)).rejects.toMatchObject({ status: 403 });
  });
  test("comments validate body, enforce authorship and manager override, and no-op on repeats", async () => {
    const f = await fixture();
    await f.seed(f.message(f.thread));
    for (const body of ["", "   ", "x".repeat(20001)])
      await expect(collab.addThreadComment(f.accountId, f.thread, body, f.actor)).rejects.toMatchObject({ status: 400 });
    const added = (await collab.addThreadComment(f.accountId, f.thread, "Private synthetic note", f.actor))!;
    const edited = await collab.editThreadComment(f.accountId, f.thread, added.comment.id, "Updated note", f.actor);
    expect(edited!.state.commentCount).toBe(1);
    const before = await collab.getThreadCollabState(f.accountId, f.thread);
    await collab.editThreadComment(f.accountId, f.thread, added.comment.id, "Updated note", f.actor);
    expect(await collab.getThreadCollabState(f.accountId, f.thread)).toEqual(before);
    const other = await principal.createUser(`other-${crypto.randomUUID()}@example.test`);
    await principal.addMembership(other.id, f.accountId, "editor");
    const otherActor = { userId: other.id, clientId: "mcp:synthetic" };
    await expect(collab.deleteThreadComment(f.accountId, f.thread, added.comment.id, otherActor, { allowAnyAuthor: true })).rejects.toMatchObject({ status: 403 });
    (await getDb()).prepare("UPDATE user_accounts SET role='manager' WHERE userId=? AND accountId=?").run(other.id, f.accountId);
    expect((await collab.deleteThreadComment(f.accountId, f.thread, added.comment.id, otherActor, { allowAnyAuthor: true }))!.deleted).toBe(true);
    expect((await collab.deleteThreadComment(f.accountId, f.thread, added.comment.id, f.actor))!.deleted).toBe(false);
    expect(await collab.listThreadComments(f.accountId, f.thread)).toEqual([]);
    await expect(collab.editThreadComment(f.accountId, f.thread, added.comment.id, "deleted", f.actor)).rejects.toMatchObject({ status: 404 });
    expect(await collab.deleteThreadComment(f.accountId, "missing", added.comment.id, f.actor)).toBeNull();
  });
  test("missing/deleted threads return null for mutations; reads default and never expose orphan comments", async () => {
    const f = await fixture();
    expect(await collab.updateThreadCollabState(f.accountId, f.thread, { status: "closed" }, f.actor)).toBeNull();
    expect(await collab.addThreadComment(f.accountId, f.thread, "no message", f.actor)).toBeNull();
    expect((await collab.getThreadCollabState(f.accountId, f.thread)).status).toBe("open");
    expect((await collab.getThreadCollabStates(f.accountId, [f.thread])).get(f.thread)!.commentCount).toBe(0);
    await f.seed(f.message(f.thread));
    await collab.addThreadComment(f.accountId, f.thread, "orphan", f.actor);
    f.db.prepare("UPDATE messages SET deleted=1 WHERE accountId=?").run(f.accountId);
    expect(await collab.listThreadComments(f.accountId, f.thread)).toEqual([]);
    expect(await collab.listThreadActivity(f.accountId, f.thread)).toEqual([]);
    expect(f.db.prepare("SELECT COUNT(*) AS n FROM thread_comments WHERE accountId=?").get(f.accountId).n).toBe(1);
  });
  test("membership cleanup unassigns once, including orphan states, with a system activity", async () => {
    const f = await fixture();
    await f.seed(f.message(f.thread));
    await collab.updateThreadCollabState(f.accountId, f.thread, { assigneeUserId: principal.user.id }, f.actor);
    f.db.prepare("UPDATE messages SET deleted=1 WHERE accountId=?").run(f.accountId);
    expect(await collab.unassignUserInAccount(f.accountId, principal.user.id, { userId: null, clientId: "system" })).toBe(1);
    expect(await collab.unassignUserInAccount(f.accountId, principal.user.id, f.actor)).toBe(0);
    expect(await collab.getThreadCollabState(f.accountId, f.thread)).toMatchObject({ assigneeUserId: null, assignedAt: null });
    expect(f.db.prepare("SELECT actorClientId FROM thread_activity WHERE accountId=? AND type='unassigned'").get(f.accountId).actorClientId).toBe("system");
  });
});
