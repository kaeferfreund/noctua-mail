import { beforeAll, expect, test } from "bun:test";
import { createAuthenticatedTestSession } from "./testAuthHarness";
import { createCollabFixture } from "./testThreadCollabHarness";
import { getUserMailboxSummary, COLLAB_SUMMARY_SQL } from "./mailboxSummary";
import { recordMailboxSync } from "./db/mailboxSummary";
import * as store from "./db/threadCollab";
import { GET } from "@/app/api/me/mailboxes/summary/route";
import { getDb } from "./db/connection";

let viewer: Awaited<ReturnType<typeof createAuthenticatedTestSession>>;
let owner: typeof viewer;
beforeAll(async () => { viewer = await createAuthenticatedTestSession(); owner = await createAuthenticatedTestSession(); });
const request = () => new Request("http://localhost:3812/api/me/mailboxes/summary?accountId=foreign&viewerUserId=foreign", { headers: viewer.jar.headers() });

test("canonical summary: two users, three mailboxes, viewer counts include waiting/defaults and assigned closed threads", async () => {
  const personal = await createCollabFixture(), shared = await createCollabFixture(), foreign = await createCollabFixture();
  const db = await getDb();
  db.prepare("UPDATE accounts SET ownerUserId=? WHERE id=?").run(viewer.user.id, personal.accountId);
  for (const f of [shared, foreign]) db.prepare("UPDATE accounts SET ownerUserId=? WHERE id=?").run(owner.user.id, f.accountId);
  await viewer.addMembership(viewer.user.id, shared.accountId, "viewer");
  await personal.seed(...["default", "waiting", "progress", "closed", "mine", "mine-closed", "other", "deleted"].map(threadId => personal.message(threadId, { unread: true, deleted: threadId === "deleted" })));
  // Repeated physical copies of one thread must not multiply collaboration counts.
  await personal.seed(personal.message("default", { unread: false, messageId: "<synthetic-copy@example.test>" }));
  personal.db.transaction(() => {
    for (const [threadId, status, assigneeUserId] of [
      ["waiting", "waiting", null], ["progress", "in_progress", null], ["closed", "closed", null],
      ["mine", "open", viewer.user.id], ["mine-closed", "closed", viewer.user.id],
      ["other", "waiting", owner.user.id], ["historical", "open", viewer.user.id]
    ] as const) store.updateThreadCollabState(personal.db, personal.accountId, threadId, { status, assigneeUserId }, { userId: viewer.user.id, clientId: "system" }, 100);
  }).immediate();
  await recordMailboxSync(personal.accountId, 1234);
  await shared.seed(shared.message("shared-default", { unread: true }));
  await foreign.seed(foreign.message("hidden", { unread: true }));
  const response = await GET(request());
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("no-store");
  const result = await response.json();
  expect(result.ok).toBe(true); expect(result.generatedAt).toBeNumber();
  const ids = result.mailboxes.map((m: { accountId: string }) => m.accountId);
  expect(ids).toContain(personal.accountId); expect(ids).toContain(shared.accountId); expect(ids).not.toContain(foreign.accountId);
  const own = result.mailboxes.find((m: { accountId: string }) => m.accountId === personal.accountId);
  expect(own).toEqual({ accountId: personal.accountId, name: personal.account.name, email: personal.account.email,
    accessRole: "manager", isOwner: true, shared: false, unread: 7, assignedToMe: 2, unassignedOpen: 3, open: 5,
    watcher: { state: process.env.NOCTUA_MAILBOX_WATCHER === "1" ? "starting" : "disabled", lastEventAt: 1234 } });
  const sharedBefore = result.mailboxes.find((m: { accountId: string }) => m.accountId === shared.accountId);
  expect(sharedBefore).toMatchObject({ accessRole: "viewer", isOwner: false, shared: true, unread: null, assignedToMe: 0, unassignedOpen: 1 });
  expect(sharedBefore.watcher.lastEventAt).toBeUndefined();
  db.prepare("UPDATE user_accounts SET role='manager' WHERE userId=? AND accountId=?").run(viewer.user.id, shared.accountId);
  const after = await getUserMailboxSummary(viewer.user.id, [shared.accountId]);
  expect(after.mailboxes[0]).toEqual({ ...sharedBefore, accessRole: "manager" });
  const ownerResult = await getUserMailboxSummary(owner.user.id, [personal.accountId, shared.accountId, foreign.accountId]);
  expect(ownerResult.mailboxes.map(m => m.accountId).sort()).toEqual([shared.accountId, foreign.accountId].sort());
  db.prepare("DELETE FROM user_accounts WHERE userId=? AND accountId=?").run(viewer.user.id, shared.accountId);
  expect((await getUserMailboxSummary(viewer.user.id, [shared.accountId])).mailboxes).toEqual([]);
});

test("canonical summary rejects anonymous access; an admin without membership sees an empty list", async () => {
  expect((await GET(new Request("http://localhost:3812/api/me/mailboxes/summary"))).status).toBe(401);
  const admin = await createAuthenticatedTestSession(undefined, "admin");
  const response = await GET(new Request("http://localhost:3812/api/me/mailboxes/summary", { headers: admin.jar.headers() }));
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ ok: true, mailboxes: [] });
});

test("summary query uses shard indexes, including the additive legacy covering index", async () => {
  const f = await createCollabFixture();
  const plan = f.db.prepare(`EXPLAIN QUERY PLAN ${COLLAB_SUMMARY_SQL}`).all(f.accountId, viewer.user.id) as { detail: string }[];
  const details = plan.map(row => row.detail).join("\n");
  expect(details).toContain("idx_thread_collab_state_summary");
  expect(details).toContain("idx_messages_live_thread_summary");
  expect(details).not.toMatch(/SCAN (?:messages|tc)\b/);
});


test("Open counts distinct waiting threads across all folders, including assigned, and excludes closed/deleted/history", async () => {
  const f = await createCollabFixture();
  await viewer.addMembership(viewer.user.id, f.accountId, "viewer");
  await f.seed(f.message("waiting", { messageId: "<synthetic-waiting-1@example.test>" }),
    f.message("waiting", { messageId: "<synthetic-waiting-2@example.test>", folderId: `${f.accountId}:Archive` }),
    f.message("closed"), f.message("deleted", { deleted: true }));
  for (const [threadId, status] of [["waiting", "waiting"], ["closed", "closed"], ["deleted", "open"], ["history", "open"]] as const)
    store.updateThreadCollabState(f.db, f.accountId, threadId, { status, assigneeUserId: viewer.user.id }, { userId: viewer.user.id, clientId: "system" }, 100);
  expect((await getUserMailboxSummary(viewer.user.id, [f.accountId])).mailboxes[0]).toMatchObject({ open: 1, unassignedOpen: 0 });
});
