import { describe, expect, test } from "bun:test";
import { createCollabFixture } from "./testThreadCollabHarness";
import { getDb, getAccountDb } from "./db/connection";
import * as store from "./db/threadCollab";
const actor = { userId: "viewer-synthetic", clientId: "web:test" };
describe("collaboration badges and account isolation", () => {
  test("message and thread lists honor badges, totals and groups with and without viewerUserId", async () => {
    const f = await createCollabFixture();
    await f.seed(...["default", "mine", "other", "closed", "progress", "waiting"].map(id => f.message(id)));
    f.db.transaction(() => {
      store.updateThreadCollabState(f.db, f.accountId, "mine", { assigneeUserId: actor.userId }, actor, 1);
      store.updateThreadCollabState(f.db, f.accountId, "other", { assigneeUserId: "other-user" }, actor, 2);
      store.updateThreadCollabState(f.db, f.accountId, "closed", { status: "closed" }, actor, 3);
      store.updateThreadCollabState(f.db, f.accountId, "progress", { status: "in_progress" }, actor, 4);
      store.updateThreadCollabState(f.db, f.accountId, "waiting", { status: "waiting" }, actor, 5);
    }).immediate();
    const cases: Array<[
      string[],
      string[]
    ]> = [
        [["assigned-to-me"], ["mine"]], [["unassigned"], ["default", "closed", "progress", "waiting"]],
        [["open"], ["default", "mine", "other", "progress", "waiting"]], [["closed"], ["closed"]],
        [["in-progress"], ["progress"]], [["waiting"], ["waiting"]], [["unassigned", "open"], ["default", "progress", "waiting"]]
      ];
    for (const list of [f.api.listMessages, f.api.listThreads])
      for (const viewerUserId of [undefined, actor.userId]) {
        for (const [badges, wanted] of cases) {
          const expected = badges.includes("assigned-to-me") && !viewerUserId ? [] : wanted;
          const result = await list({ accountId: f.accountId, page: 1, pageSize: 100, groupBy: "none", badges, viewerUserId });
          expect(result.items.map(m => m.threadId).sort()).toEqual([...expected].sort());
          expect(result.total).toBe(expected.length);
          expect((result.groups ?? []).reduce((sum, g) => sum + g.count, 0)).toBe(expected.length);
        }
      }
    const related = await f.api.listRelatedMessages({ accountId: f.accountId, relatedId: (await f.api.listMessages({ accountId: f.accountId, page: 1, pageSize: 10 })).items.find(m => m.threadId === "mine")!.id, page: 1, pageSize: 10, badges: ["assigned-to-me"] });
    expect(related.total).toBe(0);
  });
  test("two accounts share one physical shard and thread id without leaking state, comments, remaps or filters", async () => {
    const a = await createCollabFixture(), b = await createCollabFixture();
    const master = await getDb();
    master.prepare("UPDATE accounts SET dbPath=(SELECT dbPath FROM accounts WHERE id=?) WHERE id=?").run(a.accountId, b.accountId);
    expect(await getAccountDb(b.accountId)).toBe(a.db);
    const thread = "<same-thread@example.test>";
    await a.seed(a.message(thread));
    await b.seed(b.message(thread));
    a.db.transaction(() => {
      store.updateThreadCollabState(a.db, a.accountId, thread, { status: "closed", assigneeUserId: actor.userId }, actor, 10);
      store.addThreadComment(a.db, a.accountId, thread, "Only account A", actor, 20);
      store.addThreadComment(a.db, b.accountId, thread, "Only account B", actor, 30);
    }).immediate();
    expect(store.getThreadCollabState(a.db, b.accountId, thread)).toMatchObject({ status: "open", assigneeUserId: null, commentCount: 1 });
    const foreign = store.listThreadComments(a.db, a.accountId, thread)[0];
    expect(await store.mutateThreadCollab(b.accountId, thread, (db, now) => store.deleteThreadComment(db, b.accountId, thread, foreign.id, actor, now))).toMatchObject({ deleted: false });
    expect(store.listThreadActivity(a.db, b.accountId, thread)).toHaveLength(1);
    expect((await b.api.listThreads({ accountId: b.accountId, page: 1, pageSize: 20, badges: ["assigned-to-me"], viewerUserId: actor.userId })).items).toEqual([]);
    expect(await store.unassignUserInAccount(b.accountId, actor.userId, actor)).toBe(0);
    const original = (await a.api.listMessages({ accountId: a.accountId, page: 1, pageSize: 20 })).items[0];
    await a.api.upsertMessages(a.accountId, a.folderId, [{ ...original, threadId: "remapped" }]);
    expect(store.listThreadComments(a.db, a.accountId, "remapped")[0].body).toBe("Only account A");
    expect(store.listThreadComments(a.db, b.accountId, thread)[0].body).toBe("Only account B");
  });
});
