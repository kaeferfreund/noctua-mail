import { expect, test } from "bun:test";
import { createCollabFixture } from "./testThreadCollabHarness";
import { cleanupUserAccountAccess } from "./membershipCleanup";
import * as store from "./db/threadCollab";

const actor = { userId: "synthetic-manager", clientId: "web:test" };
const target = "synthetic-revoked-member";

test("membership cleanup increments each changed thread revision exactly once and leaves other scopes intact", async () => {
  const f = await createCollabFixture();
  const otherAccount = `${f.accountId}-other`;
  f.db.transaction(() => {
    store.updateThreadCollabState(f.db, f.accountId, "A", { assigneeUserId: target }, actor, 100);
    store.addThreadComment(f.db, f.accountId, "A", "Synthetic retained note", { ...actor, userId: target }, 100);
    store.updateThreadCollabState(f.db, f.accountId, "B", { assigneeUserId: target }, actor, 100);
    store.updateThreadCollabState(f.db, f.accountId, "other-member", { assigneeUserId: actor.userId }, actor, 100);
    store.updateThreadCollabState(f.db, otherAccount, "A", { assigneeUserId: target }, actor, 100);
  }).immediate();
  const before = ["A", "B"].map(thread => store.getThreadCollabState(f.db, f.accountId, thread));
  const comments = store.listThreadComments(f.db, f.accountId, "A");
  const otherMember = store.getThreadCollabState(f.db, f.accountId, "other-member");
  const otherScope = store.getThreadCollabState(f.db, otherAccount, "A");

  expect(await cleanupUserAccountAccess(f.accountId, target, actor)).toEqual({ status: "complete", unassigned: 2 });
  const after = before.map(state => store.getThreadCollabState(f.db, f.accountId, state.threadId));
  for (let i = 0; i < before.length; i++) {
    expect(after[i]).toMatchObject({ assigneeUserId: null, assignedAt: null, revision: before[i].revision + 1 });
    const unassigned = store.listThreadActivity(f.db, f.accountId, before[i].threadId).filter(row => row.type === "unassigned");
    expect(unassigned).toHaveLength(1);
    expect(unassigned[0]).toMatchObject({ actorUserId: actor.userId, actorClientId: "system", payload: { previousAssigneeUserId: target } });
  }
  expect(store.listThreadComments(f.db, f.accountId, "A")).toEqual(comments);
  expect(store.getThreadCollabState(f.db, f.accountId, "other-member")).toEqual(otherMember);
  expect(store.getThreadCollabState(f.db, otherAccount, "A")).toEqual(otherScope);
  expect(await cleanupUserAccountAccess(f.accountId, target, actor)).toEqual({ status: "complete", unassigned: 0 });
  expect(before.map(state => store.getThreadCollabState(f.db, f.accountId, state.threadId))).toEqual(after);
  for (const state of before)
    expect(store.listThreadActivity(f.db, f.accountId, state.threadId).filter(row => row.type === "unassigned")).toHaveLength(1);
});

test("membership cleanup rolls back revision and activity together on failure, then retries once", async () => {
  const f = await createCollabFixture();
  f.db.transaction(() => {
    for (const thread of ["A", "B"])
      store.updateThreadCollabState(f.db, f.accountId, thread, { assigneeUserId: target }, actor, 100);
  }).immediate();
  const before = ["A", "B"].map(thread => store.getThreadCollabState(f.db, f.accountId, thread));
  f.db.exec(`CREATE TRIGGER synthetic_cleanup_failure BEFORE INSERT ON thread_activity
    WHEN NEW.type='unassigned' AND NEW.threadId='B'
    BEGIN SELECT RAISE(ABORT,'Synthetic cleanup activity failure'); END`);
  try {
    await expect(cleanupUserAccountAccess(f.accountId, target, actor)).rejects.toThrow("Synthetic cleanup activity failure");
    expect(before.map(state => store.getThreadCollabState(f.db, f.accountId, state.threadId))).toEqual(before);
    for (const state of before)
      expect(store.listThreadActivity(f.db, f.accountId, state.threadId).filter(row => row.type === "unassigned")).toEqual([]);
  } finally {
    f.db.exec("DROP TRIGGER synthetic_cleanup_failure");
  }
  expect(await cleanupUserAccountAccess(f.accountId, target, actor)).toEqual({ status: "complete", unassigned: 2 });
  for (const state of before)
    expect(store.getThreadCollabState(f.db, f.accountId, state.threadId)).toMatchObject({ assigneeUserId: null, revision: state.revision + 1 });
});
