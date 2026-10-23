import { describe, expect, test } from "bun:test";
import { COLLAB_SUMMARY_SQL } from "../../mailboxSummary";
import { createCollabFixture } from "../../testThreadCollabHarness";
import { createSharedShardFixture } from "../../testSharedShardHarness";
import { updateThreadCollabState } from "../threadCollab";
import { listMessages, listThreads } from "./query";

const actor = { userId: "synthetic-viewer", clientId: "web:test" };
type Fixture = Awaited<ReturnType<typeof createCollabFixture>>;

async function expectUnassigned(f: Fixture, expected: string[]) {
  const counts = f.db.prepare(COLLAB_SUMMARY_SQL).get(f.accountId, actor.userId) as { unassignedOpen: number };
  expect(counts.unassignedOpen).toBe(expected.length);
  for (const list of [listMessages, listThreads]) {
    const result = await list({ accountId: f.accountId, badges: ["unassigned"], page: 1, pageSize: 100, groupBy: "none" });
    expect(result.items.map(message => message.threadId).sort()).toEqual([...expected].sort());
    expect(result.total).toBe(counts.unassignedOpen);
    expect((result.groups ?? []).reduce((sum, group) => sum + group.count, 0)).toBe(expected.length);
    expect(result.items.every(message => message.accountId === f.accountId)).toBe(true);
  }
}

describe("unassigned view matches its sidebar badge", () => {
  test("waiting unassigned plus closed unassigned yields one row and badge one", async () => {
    const f = await createCollabFixture();
    await f.seed(f.message("waiting"), f.message("closed"));
    f.db.transaction(() => {
      updateThreadCollabState(f.db, f.accountId, "waiting", { status: "waiting" }, actor, 1);
      updateThreadCollabState(f.db, f.accountId, "closed", { status: "closed" }, actor, 2);
    }).immediate();
    await expectUnassigned(f, ["waiting"]);
  });

  test("assigned then closed stays excluded; no collab row defaults to open and unassigned", async () => {
    const f = await createCollabFixture();
    await f.seed(...["default", "assigned-closed", "progress", "open"].map(id => f.message(id)));
    f.db.transaction(() => {
      updateThreadCollabState(f.db, f.accountId, "assigned-closed", { assigneeUserId: actor.userId }, actor, 1);
      updateThreadCollabState(f.db, f.accountId, "assigned-closed", { status: "closed" }, actor, 2);
      updateThreadCollabState(f.db, f.accountId, "progress", { status: "in_progress" }, actor, 3);
      updateThreadCollabState(f.db, f.accountId, "open", { status: "open" }, actor, 4);
    }).immediate();
    expect(f.db.prepare("SELECT 1 FROM thread_collab_state WHERE accountId=? AND threadId='default'").get(f.accountId)).toBeNull();
    await expectUnassigned(f, ["default", "progress", "open"]);
  });

  test("shared-shard composite keys isolate closed and assigned state for identical thread ids", async () => {
    const { a, b, db } = await createSharedShardFixture();
    for (const f of [a, b]) {
      await f.seed(...["closed-in-a", "assigned-in-a", "closed-in-b"].map(id => f.message(id, { id, messageId: `<${id}@example.test>` })));
    }
    db.transaction(() => {
      updateThreadCollabState(db, a.accountId, "closed-in-a", { status: "closed" }, actor, 1);
      updateThreadCollabState(db, a.accountId, "assigned-in-a", { assigneeUserId: actor.userId }, actor, 2);
      updateThreadCollabState(db, b.accountId, "closed-in-b", { status: "closed" }, actor, 3);
      updateThreadCollabState(db, b.accountId, "closed-in-a", { status: "waiting" }, actor, 4);
    }).immediate();
    await expectUnassigned(a, ["closed-in-b"]);
    await expectUnassigned(b, ["closed-in-a", "assigned-in-a"]);
  });
});
