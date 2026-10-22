import { Database } from "bun:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { describe, expect, test } from "bun:test";
import { createCollabFixture } from "../testThreadCollabHarness";
import * as collab from "./threadCollab";
import { initAccountSchema, ensureThreadCollabRuntimeSchema } from "./schema";
const actor = { userId: "synthetic-user", clientId: "web:test" };
describe("collaboration shard storage", () => {
  test("schema is repeatable and defaults do not create rows", async () => {
    const f = await createCollabFixture();
    initAccountSchema(f.db);
    ensureThreadCollabRuntimeSchema(f.db);
    expect(collab.getThreadCollabState(f.db, f.accountId, "missing")).toMatchObject({ status: "open", assigneeUserId: null, commentCount: 0, updatedAt: 0 });
    expect(f.db.prepare("SELECT COUNT(*) AS n FROM thread_collab_state WHERE accountId=?").get(f.accountId).n).toBe(0);
    expect(collab.getThreadCollabStates(f.db, f.accountId, Array.from({ length: 1001 }, (_, i) => `thread-${i}`)).size).toBe(1001);
    const indexes = f.db.prepare("SELECT name FROM sqlite_master WHERE type='index'").all().map((r: {
      name: string;
    }) => r.name);
    expect(indexes).toContain("idx_thread_collab_state_assignee");
    expect(indexes).toContain("idx_thread_collab_state_status");
  });
  test("upserts, comments, edits, soft delete, activity and no-ops are atomic", async () => {
    const f = await createCollabFixture();
    const thread = "<storage@example.test>";
    await f.seed(f.message(thread));
    await collab.mutateThreadCollab(f.accountId, thread, (db, now) => collab.updateThreadCollabState(db, f.accountId, thread, { status: "waiting", assigneeUserId: actor.userId }, actor, now));
    const added = await collab.mutateThreadCollab(f.accountId, thread, (db, now) => collab.addThreadComment(db, f.accountId, thread, "Internal **note**", actor, now));
    expect(added!.state.commentCount).toBe(1);
    const edited = await collab.mutateThreadCollab(f.accountId, thread, (db, now) => collab.editThreadComment(db, added!.comment, "Edited", actor, now));
    expect(edited!.comment.body).toBe("Edited");
    const deleted = await collab.mutateThreadCollab(f.accountId, thread, (db, now) => collab.deleteThreadComment(db, f.accountId, thread, added!.comment.id, actor, now));
    expect(deleted!.state.commentCount).toBe(0);
    expect(collab.listThreadComments(f.db, f.accountId, thread)).toEqual([]);
    expect(collab.getThreadComment(f.db, f.accountId, thread, added!.comment.id)!.deletedAt).toBeNumber();
    const before = collab.getThreadCollabState(f.db, f.accountId, thread);
    await collab.mutateThreadCollab(f.accountId, thread, (db, now) => collab.updateThreadCollabState(db, f.accountId, thread, { status: "waiting", assigneeUserId: actor.userId }, actor, now + 1000));
    expect(collab.getThreadCollabState(f.db, f.accountId, thread)).toMatchObject({
      status: before.status, assigneeUserId: before.assigneeUserId, revision: before.revision + 1,
    });
    expect((await collab.mutateThreadCollab(f.accountId, thread, (db, now) => collab.deleteThreadComment(db, f.accountId, thread, added!.comment.id, actor, now)))!.deleted).toBe(false);
    const activity = collab.listThreadActivity(f.db, f.accountId, thread);
    expect(activity.map(a => a.type).sort()).toEqual(["assigned", "comment_added", "comment_deleted", "comment_edited", "status_changed"]);
    expect(activity.every(a => a.actorUserId === actor.userId && a.actorClientId === actor.clientId && a.createdAt > 0)).toBe(true);
    expect(activity.find(a => a.type === "status_changed")!.payload).toEqual({ from: "open", to: "waiting" });
    expect(collab.listThreadActivity(f.db, f.accountId, thread, 2)).toHaveLength(2);
  });
  test("message-less/deleted threads write nothing and rollback includes activity", async () => {
    const f = await createCollabFixture();
    await f.seed(f.message("deleted", { deleted: true }));
    for (const thread of ["missing", "deleted"]) {
      expect(await collab.mutateThreadCollab(f.accountId, thread, (db, now) => collab.addThreadComment(db, f.accountId, thread, "invisible", actor, now))).toBeNull();
    }
    await f.seed(f.message("live"));
    await expect(collab.mutateThreadCollab(f.accountId, "live", (db, now) => {
      collab.addThreadComment(db, f.accountId, "live", "rolled back", actor, now);
      throw new Error("synthetic failure");
    })).rejects.toThrow("synthetic failure");
    expect(collab.listThreadComments(f.db, f.accountId, "live")).toEqual([]);
    expect(collab.listThreadActivity(f.db, f.accountId, "live")).toEqual([]);
    expect(f.db.prepare("SELECT COUNT(*) AS n FROM thread_collab_state WHERE accountId=?").get(f.accountId).n).toBe(0);
  });
  test("concurrent first mutations keep every comment, state field and activity", async () => {
    const f = await createCollabFixture();
    const thread = "<concurrent@example.test>";
    await f.seed(f.message(thread));
    await Promise.all([
      ...Array.from({ length: 48 }, (_, i) => collab.mutateThreadCollab(f.accountId, thread, (db, now) => collab.addThreadComment(db, f.accountId, thread, `Synthetic note ${i}`, actor, now))),
      collab.mutateThreadCollab(f.accountId, thread, (db, now) => collab.updateThreadCollabState(db, f.accountId, thread, { status: "in_progress" }, actor, now)),
      collab.mutateThreadCollab(f.accountId, thread, (db, now) => collab.updateThreadCollabState(db, f.accountId, thread, { assigneeUserId: actor.userId }, actor, now))
    ]);
    expect(collab.getThreadCollabState(f.db, f.accountId, thread)).toMatchObject({ revision: 50, commentCount: 48, status: "in_progress", assigneeUserId: actor.userId });
    expect(collab.listThreadComments(f.db, f.accountId, thread)).toHaveLength(48);
    expect(collab.listThreadActivity(f.db, f.accountId, thread)).toHaveLength(50);
  });
});
test("independent SQLite writers racing their first mutation keep exact counts", async () => {
  const f = await createCollabFixture(), thread = "<multi-writer@example.test>";
  await f.seed(f.message(thread));
  const dbPath = f.db.prepare("PRAGMA database_list").get().file as string;
  const storagePath = new URL("./threadCollab.ts", import.meta.url).pathname;
  const retryPath = new URL("../dbWriteRetry.ts", import.meta.url).pathname;
  // Separate Bun processes exercise real SQLite writer contention rather than
  // merely interleaving Promise callbacks on one shared connection.
  const script = `
    import { Database } from 'bun:sqlite';
    import { addThreadComment } from ${JSON.stringify(storagePath)};
    import { withDbWriteRetry } from ${JSON.stringify(retryPath)};
    const db = new Database(process.env.COLLAB_TEST_DB);
    db.exec('PRAGMA busy_timeout=0');
    const start = new Promise(resolve => process.stdin.once('end', resolve));
    process.stdin.resume();
    console.log('ready');
    await start;
    for (let i=0;i<12;i++) await withDbWriteRetry('synthetic-collab-writer',() => db.transaction(() => {
      addThreadComment(db,process.env.COLLAB_ACCOUNT,process.env.COLLAB_THREAD,'Synthetic concurrent note',
        {userId:'synthetic-worker',clientId:'system'},Date.now());
    }).immediate(),{maxAttempts:20,baseDelayMs:5,maxDelayMs:50});
    db.close();
  `;
  const processes = Array.from({ length: 4 }, () => spawn(process.execPath, ["--eval", script], {
    env: { ...process.env, COLLAB_TEST_DB: dbPath, COLLAB_ACCOUNT: f.accountId, COLLAB_THREAD: thread },
    stdio: ["pipe", "pipe", "pipe"]
  }));
  const workers = processes.map(child => {
    let stderr = "";
    child.stderr!.setEncoding("utf8");
    child.stderr!.on("data", (chunk: string) => { stderr += chunk; });
    const ready = new Promise<void>((resolve, reject) => {
      let stdout = "";
      child.stdout!.setEncoding("utf8");
      child.stdout!.on("data", (chunk: string) => {
        stdout += chunk;
        if (stdout.includes("ready\n")) resolve();
      });
      child.once("error", reject);
      child.once("exit", code => reject(new Error(`Writer exited before ready (${code}): ${stderr}`)));
    });
    const result = once(child, "close").then(([exit]) => ({ exit, stderr }));
    return { ready, result };
  });
  let results;
  try {
    const [, completed] = await Promise.all([
      Promise.all(workers.map(worker => worker.ready)).then(() => {
        for (const child of processes) child.stdin!.end();
      }),
      Promise.all(workers.map(worker => worker.result))
    ]);
    results = completed;
  } finally {
    for (const child of processes) {
      if (child.exitCode === null && child.signalCode === null) child.kill();
    }
  }
  for (const result of results) {
    if (result.exit !== 0)
      throw new Error(result.stderr);
    expect(result.exit).toBe(0);
  }
  expect(collab.getThreadCollabState(f.db, f.accountId, thread)).toMatchObject({ commentCount: 48, revision: 48 });
  expect(collab.listThreadComments(f.db, f.accountId, thread)).toHaveLength(48);
  expect(collab.listThreadActivity(f.db, f.accountId, thread)).toHaveLength(48);
});


describe("monotonic collaboration revisions", () => {
  test("state, comments and remaps increment each affected key exactly once despite clock ties/regression", async () => {
    const f = await createCollabFixture();
    const thread = "revision-source", target = "revision-target";
    await f.seed(f.message(target));
    const run = <T>(fn: () => T) => f.db.transaction(fn).immediate();
    const change = run(() => collab.updateThreadCollabState(f.db, f.accountId, thread, {
      status: "waiting", assigneeUserId: actor.userId,
    }, actor, 1000));
    expect(change.revision).toBe(1); // Two changed fields, one mutation.
    const added = run(() => collab.addThreadComment(f.db, f.accountId, thread, "Synthetic revision note", actor, 1000));
    expect(added.state.revision).toBe(2);
    expect(added.comment.revision).toBe(2);
    const edited = run(() => collab.editThreadComment(f.db, { ...added.comment }, "Synthetic edited note", actor, 500));
    expect(edited.state).toMatchObject({ revision: 3, updatedAt: 500 });
    expect(edited.comment).toMatchObject({ revision: 3, updatedAt: 500 });
    const deleted = run(() => collab.deleteThreadComment(f.db, f.accountId, thread, added.comment.id, actor, 500));
    expect(deleted.state.revision).toBe(4);
    expect(collab.getThreadComment(f.db, f.accountId, thread, added.comment.id)!.revision).toBe(4);
    run(() => collab.updateThreadCollabState(f.db, f.accountId, target, { status: "closed" }, actor, 200));
    run(() => collab.remapThreadCollab(f.db, f.accountId, [{
      id: "synthetic-message", oldThreadId: thread, newThreadId: target, dateValue: 1,
    }]));
    expect(collab.getThreadCollabState(f.db, f.accountId, target).revision).toBe(2);
    expect(collab.getThreadCollabState(f.db, f.accountId, thread).revision).toBe(5);
    expect(collab.getThreadComment(f.db, f.accountId, target, added.comment.id)!.revision).toBe(2);
    // Reusing a vacated key cannot restart its counter.
    expect(run(() => collab.updateThreadCollabState(f.db, f.accountId, thread, { status: "waiting" }, actor, 1)).revision).toBe(6);
    const before = collab.getThreadCollabState(f.db, f.accountId, target);
    expect(() => run(() => {
      collab.addThreadComment(f.db, f.accountId, target, "Synthetic rolled back", actor, 1);
      throw new Error("synthetic rollback");
    })).toThrow("synthetic rollback");
    expect(collab.getThreadCollabState(f.db, f.accountId, target)).toEqual(before);
  });

  test("legacy rows migrate to zero and accounts sharing one SQLite file have independent counters", () => {
    const directory = mkdtempSync(join(tmpdir(), "collab-revision-"));
    const path = join(directory, "synthetic-shard.sqlite");
    const db = new Database(path);
    try {
      // Populate the complete old schema first, including indexes, to exercise
      // the cold-reader fast path rather than just missing-table initialization.
      ensureThreadCollabRuntimeSchema(db);
      db.exec("ALTER TABLE thread_collab_state DROP COLUMN revision");
      db.exec("ALTER TABLE thread_comments DROP COLUMN revision");
      db.exec(`INSERT INTO thread_collab_state(accountId,threadId,lastActivityAt,updatedAt)
        VALUES ('synthetic-a','shared',100,100), ('synthetic-b','shared',100,100)`);
      db.exec(`INSERT INTO thread_comments(id,accountId,threadId,authorUserId,body,createdAt,updatedAt)
        VALUES ('synthetic-legacy-note','synthetic-a','shared','synthetic-user','Synthetic legacy note',100,100)`);
      // A new connection is deliberately required because ensure* caches per db.
      db.close();
      const migrated = new Database(path);
      try {
        ensureThreadCollabRuntimeSchema(migrated);
        ensureThreadCollabRuntimeSchema(migrated);
        expect(collab.getThreadCollabState(migrated, "synthetic-a", "shared").revision).toBe(0);
        expect(collab.getThreadComment(migrated, "synthetic-a", "shared", "synthetic-legacy-note")!.revision).toBe(0);
        const update = (account: string) => migrated.transaction(() => collab.updateThreadCollabState(migrated, account, "shared", { status: "waiting" }, actor, 10)).immediate();
        expect(update("synthetic-a").revision).toBe(1);
        expect(update("synthetic-a").revision).toBe(2); // Accepted no-op also advances once.
        expect(update("synthetic-b").revision).toBe(1);
        expect(collab.getThreadCollabState(migrated, "synthetic-a", "other").revision).toBe(0);
      } finally { migrated.close(); }
    } finally {
      db.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
