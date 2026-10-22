import { describe, expect, test } from "bun:test";
import { createCollabFixture } from "../testThreadCollabHarness";
import * as store from "./threadCollab";
import { recomputeThreadIdsForAccount } from "./threads";
const actor = { userId: "synthetic-author", clientId: "web:test" };
describe("collaboration thread remap", () => {
  test("recompute merges two state rows and unions their common topic without loss", async () => {
    const f = await createCollabFixture();
    const a = "<root@example.test>", b = "<reply@example.test>";
    await f.seed(f.message(a), f.message(b, { inReplyTo: a, references: [a], dateValue: 1767225601000 }));
    f.db.transaction(() => {
      store.updateThreadCollabState(f.db, f.accountId, a, { status: "closed", assigneeUserId: "first" }, actor, 100);
      store.updateThreadCollabState(f.db, f.accountId, b, { status: "waiting", assigneeUserId: "second" }, actor, 200);
      store.addThreadComment(f.db, f.accountId, a, "Root comment", actor, 300);
      store.addThreadComment(f.db, f.accountId, b, "Reply comment", actor, 400);
      for (const thread of [a, b])
        for (const topic of ["common", thread])
          f.db.prepare("INSERT INTO thread_topics VALUES (?,?,?,?)").run(thread, topic, f.accountId, 100);
    }).immediate();
    await recomputeThreadIdsForAccount(f.accountId);
    expect(store.getThreadCollabState(f.db, f.accountId, a)).toMatchObject({ status: "waiting", assigneeUserId: "second", assignedAt: 200, commentCount: 2, updatedAt: 400, updatedByUserId: actor.userId });
    expect(f.db.prepare("SELECT * FROM thread_collab_state WHERE accountId=? AND threadId=?").get(f.accountId, b)).toBeNull();
    expect(store.listThreadComments(f.db, f.accountId, a).map(c => c.body)).toEqual(["Root comment", "Reply comment"]);
    expect(f.db.prepare("SELECT topicId FROM thread_topics WHERE accountId=? AND threadId=?").all(f.accountId, a)).toHaveLength(3);
    const merged = store.listThreadActivity(f.db, f.accountId, a).filter(a => a.type === "threads_merged");
    expect(merged).toHaveLength(1);
    expect(merged[0].payload).toEqual({ mergedFromThreadIds: [b] });
    expect(merged[0].actorClientId).toBe("system");
    await recomputeThreadIdsForAccount(f.accountId);
    expect(store.listThreadActivity(f.db, f.accountId, a).filter(a => a.type === "threads_merged")).toHaveLength(1);
  });
  test("all-closed merge stays closed; nonclosed status and equal-time ties are deterministic", async () => {
    const f = await createCollabFixture();
    const target = "target";
    await f.seed(f.message(target));
    f.db.transaction(() => {
      for (const thread of ["z", "a", target])
        store.updateThreadCollabState(f.db, f.accountId, thread, { status: "closed" }, actor, 50);
      store.remapThreadCollab(f.db, f.accountId, [{ id: "z", oldThreadId: "z", newThreadId: target, dateValue: 1 }, { id: "a", oldThreadId: "a", newThreadId: target, dateValue: 2 }]);
    }).immediate();
    expect(store.getThreadCollabState(f.db, f.accountId, target).status).toBe("closed");
    f.db.transaction(() => {
      store.updateThreadCollabState(f.db, f.accountId, "z", { status: "waiting", assigneeUserId: "z" }, actor, 100);
      store.updateThreadCollabState(f.db, f.accountId, "a", { status: "in_progress", assigneeUserId: "a" }, actor, 100);
      store.remapThreadCollab(f.db, f.accountId, [{ id: "z", oldThreadId: "z", newThreadId: target, dateValue: 1 }, { id: "a", oldThreadId: "a", newThreadId: target, dateValue: 2 }]);
    }).immediate();
    expect(store.getThreadCollabState(f.db, f.accountId, target)).toMatchObject({ status: "in_progress", assigneeUserId: "a" });
  });
  test("split follows former root even if it is newer; otherwise follows oldest former message", async () => {
    for (const withRoot of [true, false]) {
      const f = await createCollabFixture();
      const old = "<old@example.test>";
      const first = f.message("first", { messageId: "<child@example.test>", dateValue: 1 });
      const root = f.message("root", { messageId: withRoot ? old : "<other@example.test>", dateValue: 2 });
      await f.seed(first, root);
      f.db.transaction(() => {
        store.addThreadComment(f.db, f.accountId, old, "Follows exactly one split", actor, 10);
        store.remapThreadCollab(f.db, f.accountId, [{ ...first, oldThreadId: old, newThreadId: first.threadId }, { ...root, oldThreadId: old, newThreadId: root.threadId }]);
      }).immediate();
      const winner = withRoot ? "root" : "first";
      expect(store.getThreadCollabState(f.db, f.accountId, winner).commentCount).toBe(1);
      expect(store.listThreadComments(f.db, f.accountId, withRoot ? "first" : "root")).toEqual([]);
    }
  });
  test("old id with live messages keeps all metadata", async () => {
    const f = await createCollabFixture();
    await f.seed(f.message("old"), f.message("new"));
    f.db.transaction(() => {
      store.addThreadComment(f.db, f.accountId, "old", "stays", actor, 10);
      store.remapThreadCollab(f.db, f.accountId, [{ id: "moved", oldThreadId: "old", newThreadId: "new", dateValue: 1 }]);
    }).immediate();
    expect(store.getThreadCollabState(f.db, f.accountId, "old").commentCount).toBe(1);
    expect(store.getThreadCollabState(f.db, f.accountId, "new").commentCount).toBe(0);
  });
  test("resync/upsert and full replacement move collaboration and topics", async () => {
    for (const replace of [false, true]) {
      const f = await createCollabFixture();
      const msg = f.message("old");
      await f.seed(msg);
      f.db.transaction(() => {
        store.addThreadComment(f.db, f.accountId, "old", "survives resync", actor, 10);
        f.db.prepare("INSERT INTO thread_topics VALUES (?,?,?,?)").run("old", `topic-${f.accountId}`, f.accountId, 10);
      }).immediate();
      await f.api.upsertMessages(f.accountId, f.folderId, [{ ...msg, threadId: "new" }], replace);
      expect(store.getThreadCollabState(f.db, f.accountId, "new").commentCount).toBe(1);
      expect(f.db.prepare("SELECT threadId FROM thread_topics WHERE accountId=?").get(f.accountId).threadId).toBe("new");
      expect(store.getThreadCollabState(f.db, f.accountId, "old").updatedAt).toBe(0);
    }
  });
  test("resync split spanning batching boundary follows root once", async () => {
    const f = await createCollabFixture();
    const old = "<batch-root@example.test>";
    const messages = Array.from({ length: 205 }, (_, i) => f.message(old, { messageId: i === 204 ? old : `<batch-${i}@example.test>`, dateValue: i }));
    await f.seed(...messages);
    f.db.transaction(() => store.addThreadComment(f.db, f.accountId, old, "batch root", actor, 100)).immediate();
    await f.api.upsertMessages(f.accountId, f.folderId, messages.map((msg, i) => ({ ...msg, threadId: i === 204 ? "root" : "child" })));
    expect(store.getThreadCollabState(f.db, f.accountId, "root").commentCount).toBe(1);
    expect(store.getThreadCollabState(f.db, f.accountId, "child").commentCount).toBe(0);
  });
});
