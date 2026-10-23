import { describe, expect, test } from "bun:test";
import { createCollabFixture } from "../testThreadCollabHarness";
import { closeAccountDbConnection, getAccountDb, getDb } from "./connection";
import { getDefaultAccountDbPath } from "../runtimePaths";
import { shardWriterGuardsInstalled } from "./shardFormat";
import * as store from "./threadCollab";

function seedMetadata(db: Awaited<ReturnType<typeof getAccountDb>>, accountId: string, idPrefix = "") {
  db.transaction(() => {
    for (const [index, threadId] of ["a", "b", "c"].entries()) {
      store.upsertThreadCollabState(db, {
        ...store.defaultThreadCollabState(accountId, threadId),
        revision: index + 5, status: "waiting", statusChangedAt: index + 1,
        assigneeUserId: `assignee-${threadId}`, assignedAt: index + 1,
        commentCount: 1, updatedAt: index + 1, lastActivityAt: index + 1
      });
      for (const deletedAt of [null, 10]) {
        db.prepare(`INSERT INTO thread_comments
          (id,accountId,threadId,authorUserId,body,createdAt,updatedAt,revision,deletedAt)
          VALUES(?,?,?,'synthetic-author',?,1,1,?,?)`)
          .run(`${idPrefix}comment-${threadId}-${deletedAt ?? "live"}`, accountId, threadId, `Note ${threadId}`, index + 5, deletedAt);
      }
      db.prepare(`INSERT INTO thread_activity
        (id,accountId,threadId,type,actorClientId,payload,createdAt)
        VALUES(?,?,?,'comment_added','synthetic','{}',1)`)
        .run(`${idPrefix}activity-${threadId}`, accountId, threadId);
      for (const topicId of ["common", threadId]) {
        db.prepare("INSERT INTO thread_topics VALUES(?,?,?,1)").run(threadId, topicId, accountId);
      }
    }
  }).immediate();
}

function snapshot(db: Awaited<ReturnType<typeof getAccountDb>>, accountId: string) {
  return {
    states: db.prepare("SELECT * FROM thread_collab_state WHERE accountId=? ORDER BY threadId").all(accountId),
    comments: db.prepare("SELECT * FROM thread_comments WHERE accountId=? ORDER BY id").all(accountId),
    activities: db.prepare("SELECT * FROM thread_activity WHERE accountId=? ORDER BY id").all(accountId),
    topics: db.prepare("SELECT * FROM thread_topics WHERE accountId=? ORDER BY threadId,topicId").all(accountId)
  };
}

describe("remap statement reuse preserves simultaneous moves", () => {
  for (const [label, entries] of [
    ["swap", [["a", "b"], ["b", "a"]]],
    ["chain", [["a", "b"], ["b", "c"]]],
    ["shared target", [["a", "c"], ["b", "c"]]]
  ] as const) {
    test(`${label}: rows, events, revisions, topics and shared-shard accounts`, async () => {
      const f = await createCollabFixture();
      const other = await createCollabFixture();
      (await getDb()).prepare("UPDATE accounts SET dbPath=? WHERE id=?").run(getDefaultAccountDbPath(f.accountId), other.accountId);
      expect(await getAccountDb(other.accountId)).toBe(f.db);
      seedMetadata(f.db, f.accountId);
      seedMetadata(f.db, other.accountId, "other-");
      const otherBefore = snapshot(f.db, other.accountId);
      expect(shardWriterGuardsInstalled(f.db)).toBe(true);
      const pairs = entries.map(([oldThreadId, newThreadId]) => ({ oldThreadId, newThreadId, id: oldThreadId, dateValue: 1 }));
      const events = f.db.transaction(() => store.remapThreadCollab(f.db, f.accountId, pairs)).immediate();
      const moves = new Map<string, string>(entries);
      const touched = new Set([...moves.keys(), ...moves.values()]);
      expect(events).toEqual([...touched].map(threadId => ({ accountId: f.accountId, threadId, revision: ["a", "b", "c"].indexOf(threadId) + 6 })));
      for (const [index, source] of ["a", "b", "c"].entries()) {
        const target = moves.get(source) ?? source;
        const revision = moves.has(source) ? ["a", "b", "c"].indexOf(target) + 6 : index + 5;
        for (const suffix of ["live", "10"]) {
          expect(f.db.prepare("SELECT threadId,revision,body FROM thread_comments WHERE accountId=? AND id=?").get(f.accountId, `comment-${source}-${suffix}`))
            .toEqual({ threadId: target, revision, body: `Note ${source}` });
        }
        expect(f.db.prepare("SELECT threadId FROM thread_activity WHERE accountId=? AND id=?").get(f.accountId, `activity-${source}`).threadId).toBe(target);
      }
      for (const threadId of touched) {
        const expectedSources = ["a", "b", "c"].filter(source => (moves.get(source) ?? source) === threadId);
        const state = store.getThreadCollabState(f.db, f.accountId, threadId);
        expect(state.commentCount).toBe(expectedSources.length);
        const topics = f.db.prepare("SELECT topicId FROM thread_topics WHERE accountId=? AND threadId=? ORDER BY topicId").all(f.accountId, threadId);
        expect(topics).toEqual([...new Set(expectedSources.flatMap(source => ["common", source]))].sort().map(topicId => ({ topicId })));
        const merges = store.listThreadActivity(f.db, f.accountId, threadId).filter(activity => activity.type === "threads_merged");
        expect(merges).toHaveLength(expectedSources.length > 1 ? 1 : 0);
        if (merges.length) {
          expect(merges[0].payload).toEqual({ mergedFromThreadIds: entries.filter(([, target]) => target === threadId).map(([source]) => source).sort() });
        }
      }
      expect(snapshot(f.db, other.accountId)).toEqual(otherBefore);
    });
  }
});

test("remap statements use the reopened shard connection on a subsequent call", async () => {
  const f = await createCollabFixture();
  seedMetadata(f.db, f.accountId);
  f.db.transaction(() => store.remapThreadCollab(f.db, f.accountId, [{ oldThreadId: "a", newThreadId: "b", id: "a", dateValue: 1 }])).immediate();
  closeAccountDbConnection(getDefaultAccountDbPath(f.accountId));
  const reopened = await getAccountDb(f.accountId);
  expect(reopened).not.toBe(f.db);
  expect(shardWriterGuardsInstalled(reopened)).toBe(true);
  const events = reopened.transaction(() => store.remapThreadCollab(reopened, f.accountId, [{ oldThreadId: "b", newThreadId: "c", id: "b", dateValue: 1 }])).immediate();
  expect(events).toEqual([
    { accountId: f.accountId, threadId: "b", revision: 8 },
    { accountId: f.accountId, threadId: "c", revision: 8 }
  ]);
  expect(store.getThreadCollabState(reopened, f.accountId, "c").commentCount).toBe(3);
  expect(reopened.prepare("SELECT threadId,revision FROM thread_comments WHERE accountId=? AND id='comment-a-live'").get(f.accountId)).toEqual({ threadId: "c", revision: 8 });
});
