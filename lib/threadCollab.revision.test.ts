import { expect, it } from "bun:test";
import { Database } from "bun:sqlite";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { createCollabFixture } from "@/lib/testThreadCollabHarness";
import { ensureThreadCollabRuntimeSchema } from "./db/schema";
import * as store from "./db/threadCollab";
import { getThreadCollabSnapshot } from "@/lib/threadCollab";
import { createAuthenticatedTestSession } from "@/lib/testAuthHarness";
import { GET, PATCH } from "@/app/api/accounts/[accountId]/threads/[threadId]/collab/route";
import { POST } from "@/app/api/accounts/[accountId]/threads/[threadId]/comments/route";
import { DELETE } from "@/app/api/accounts/[accountId]/threads/[threadId]/comments/[commentId]/route";
const actor = { userId: "synthetic-r6", clientId: "web:r6" };
const tx = <T>(db: Database, fn: () => T) => db.transaction(fn).immediate();

it("R6-server: interleaved state/comment/no-op/remap changes increase each key strictly despite tied/backwards clocks", async () => {
  const f = await createCollabFixture();
  const [message] = await f.seed(f.message("A"));
  const seen: Record<string, number> = { A: 0, B: 0 };
  const check = (key: string) => {
    const state = store.getThreadCollabState(f.db, f.accountId, key);
    expect(state.revision).toBe(seen[key] + 1); seen[key] = state.revision;
  };
  tx(f.db, () => store.updateThreadCollabState(f.db, f.accountId, "A", { status: "waiting", assigneeUserId: actor.userId }, actor, 100)); check("A");
  const added = tx(f.db, () => store.addThreadComment(f.db, f.accountId, "A", "Synthetic note", actor, 100)); check("A");
  expect(added.comment.revision).toBe(added.state.revision);
  tx(f.db, () => store.updateThreadCollabState(f.db, f.accountId, "B", { status: "closed" }, actor, 200)); check("B");
  const edited = tx(f.db, () => store.editThreadComment(f.db, { ...added.comment }, "Synthetic edit", actor, 50)); check("A");
  expect(edited.comment.revision).toBe(seen.A);
  const deleted = tx(f.db, () => store.deleteThreadComment(f.db, f.accountId, "A", added.comment.id, actor, 50)); check("A");
  expect(store.getThreadComment(f.db, f.accountId, "A", added.comment.id)?.revision).toBe(deleted.state.revision);
  tx(f.db, () => store.deleteThreadComment(f.db, f.accountId, "A", added.comment.id, actor, 1)); check("A");
  tx(f.db, () => {
    f.db.prepare("UPDATE messages SET threadId=? WHERE id=?").run("B", message.id);
    store.remapThreadCollab(f.db, f.accountId, [{ id: message.id, oldThreadId: "A", newThreadId: "B", dateValue: 1 }]);
  }); check("A"); check("B");
  expect(store.getThreadComment(f.db, f.accountId, "B", added.comment.id)?.revision).toBe(seen.B);
  tx(f.db, () => store.updateThreadCollabState(f.db, f.accountId, "A", { status: "open" }, actor, 0)); check("A");
  console.log("R6-server interleaved final revisions", JSON.stringify(seen));
});

it("R6-server: accounts sharing one shard keep independent state/comment counters through remap", async () => {
  const f = await createCollabFixture(), a = f.accountId, b = `${f.accountId}-synthetic-second`;
  const update = (account: string) => tx(f.db, () => store.updateThreadCollabState(f.db, account, "shared", { status: "waiting" }, actor, 1));
  expect(update(a).revision).toBe(1);
  expect(update(b).revision).toBe(1);
  const noteA = tx(f.db, () => store.addThreadComment(f.db, a, "shared", "Synthetic A", actor, 1));
  const noteB = tx(f.db, () => store.addThreadComment(f.db, b, "shared", "Synthetic B", actor, 1));
  expect(noteA.state.revision).toBe(2); expect(noteB.state.revision).toBe(2);
  tx(f.db, () => store.remapThreadCollab(f.db, a, [{ id: "synthetic-a", oldThreadId: "shared", newThreadId: "target", dateValue: 1 }]));
  expect(store.getThreadCollabState(f.db, a, "shared").revision).toBe(3);
  expect(store.getThreadCollabState(f.db, a, "target").revision).toBe(1);
  expect(store.getThreadCollabState(f.db, b, "shared").revision).toBe(2);
  expect(store.listThreadComments(f.db, b, "shared")).toEqual([noteB.comment]);
  expect(update(b).revision).toBe(3);
});

it("R6-remap: A to B then B to A then reuse vacated A never resets either counter", async () => {
  const f = await createCollabFixture(); const [message] = await f.seed(f.message("A"));
  const added = tx(f.db, () => store.addThreadComment(f.db, f.accountId, "A", "Synthetic movable", actor, 100));
  const move = (from: string, to: string) => tx(f.db, () => {
    f.db.prepare("UPDATE messages SET threadId=? WHERE id=?").run(to, message.id);
    store.remapThreadCollab(f.db, f.accountId, [{ id: message.id, oldThreadId: from, newThreadId: to, dateValue: 1 }]);
  });
  move("A", "B");
  expect(store.getThreadCollabState(f.db, f.accountId, "A").revision).toBe(2);
  expect(store.getThreadCollabState(f.db, f.accountId, "B").revision).toBe(1);
  move("B", "A");
  expect(store.getThreadCollabState(f.db, f.accountId, "A").revision).toBe(3);
  expect(store.getThreadCollabState(f.db, f.accountId, "B").revision).toBe(2);
  move("A", "B"); // Vacate A a second time before reusing it for a new message.
  await f.seed(f.message("A", { messageId: "<synthetic-reused-A@example.test>" }));
  const reused = await store.mutateThreadCollab(f.accountId, "A", (db, now) => store.addThreadComment(db, f.accountId, "A", "Synthetic reuse", actor, now));
  expect(reused!.state.revision).toBe(5);
  expect(reused!.comment.revision).toBe(5);
  expect(store.getThreadCollabState(f.db, f.accountId, "B").revision).toBe(3);
  expect(store.getThreadComment(f.db, f.accountId, "B", added.comment.id)?.revision).toBe(3);
  expect(store.listThreadComments(f.db, f.accountId, "A")).toEqual([reused!.comment]);
});

for (const shape of ["swap", "chain"] as const) it(`R6-remap: simultaneous ${shape} snapshots do not cascade and retain vacated counters on reuse`, async () => {
  const f = await createCollabFixture();
  // Storage seam accepts historical source states with no remaining messages.
  const a = tx(f.db, () => store.addThreadComment(f.db, f.accountId, "A", "Synthetic A", actor, 1));
  const b = tx(f.db, () => store.addThreadComment(f.db, f.accountId, "B", "Synthetic B", actor, 1));
  tx(f.db, () => store.updateThreadCollabState(f.db, f.accountId, "B", { status: "waiting" }, actor, 1));
  const target = shape === "swap" ? "A" : "C";
  tx(f.db, () => store.remapThreadCollab(f.db, f.accountId, [
    { id: "synthetic-a", oldThreadId: "A", newThreadId: "B", dateValue: 1 },
    { id: "synthetic-b", oldThreadId: "B", newThreadId: target, dateValue: 2 },
  ]));
  expect(store.listThreadComments(f.db, f.accountId, "B").map(c => c.id)).toEqual([a.comment.id]);
  expect(store.listThreadComments(f.db, f.accountId, target).map(c => c.id)).toEqual([b.comment.id]);
  expect(store.getThreadCollabState(f.db, f.accountId, "A").revision).toBe(2);
  expect(store.getThreadCollabState(f.db, f.accountId, "B").revision).toBe(3);
  expect(store.getThreadCollabState(f.db, f.accountId, target).revision).toBe(shape === "swap" ? 2 : 1);
  expect(store.listThreadComments(f.db, f.accountId, target)[0].revision).toBe(shape === "swap" ? 2 : 1);
  // In the chain A is vacated; in the swap it retains B content. Reuse never restarts.
  await f.seed(f.message("A", { messageId: "<synthetic-reused-A@example.test>" }));
  const reused = await store.mutateThreadCollab(f.accountId, "A", (db, now) => store.updateThreadCollabState(db, f.accountId, "A", { status: "closed" }, actor, now));
  expect(reused!.revision).toBe(3);
});

it("R6-server: edit and delete in one wall-clock window have distinct committed revisions and an unchanged no-op comment revision", async () => {
  const f = await createCollabFixture(); await f.seed(f.message("X"));
  const add = await store.mutateThreadCollab(f.accountId, "X", db => store.addThreadComment(db, f.accountId, "X", "Synthetic original", actor, 100));
  const edit = await store.mutateThreadCollab(f.accountId, "X", db => store.editThreadComment(db, { ...add!.comment }, "Synthetic edited", actor, 100));
  const noOp = await store.mutateThreadCollab(f.accountId, "X", db => store.editThreadComment(db, { ...edit!.comment }, "Synthetic edited", actor, 100));
  const del = await store.mutateThreadCollab(f.accountId, "X", db => store.deleteThreadComment(db, f.accountId, "X", add!.comment.id, actor, 100));
  expect([add!.state.revision, edit!.state.revision, noOp!.state.revision, del!.state.revision]).toEqual([1, 2, 3, 4]);
  expect([add!.comment.revision, edit!.comment.revision, noOp!.comment.revision]).toEqual([1, 2, 2]);
  const deleted = store.getThreadComment(f.db, f.accountId, "X", add!.comment.id)!;
  expect(deleted).toMatchObject({ revision: 4, body: "Synthetic edited", deletedAt: 100, updatedAt: 100 });
  expect((await getThreadCollabSnapshot(f.accountId, "X")).comments).toEqual([]);
});

it("R6-migration: independent connections concurrently migrate legacy revision columns exactly once", async () => {
  // Barrier is reached AFTER both connections read the old schema but BEFORE either
  // acquires the immediate lock. This forces the duplicate-column TOCTOU window.
  for (let round = 0; round < 4; round++) {
    const dir = mkdtempSync(join(tmpdir(), "r6-migration-")), file = join(dir, "synthetic.sqlite"), go = join(dir, "go");
    const db = new Database(file);
    try {
      ensureThreadCollabRuntimeSchema(db);
      db.exec("ALTER TABLE thread_collab_state DROP COLUMN revision; ALTER TABLE thread_comments DROP COLUMN revision");
      db.exec(`INSERT INTO thread_collab_state(accountId,threadId,lastActivityAt,updatedAt) VALUES (\x27synthetic-a\x27,\x27X\x27,100,100);
        INSERT INTO thread_comments(id,accountId,threadId,authorUserId,body,createdAt,updatedAt) VALUES (\x27synthetic-id\x27,\x27synthetic-a\x27,\x27X\x27,\x27synthetic-user\x27,\x27Synthetic legacy\x27,100,100)`);
      const script = `
        import { Database } from "bun:sqlite";
        import { existsSync } from "node:fs";
        import { ensureThreadCollabRuntimeSchema } from ${JSON.stringify(new URL("./db/schema.ts", import.meta.url).pathname)};
        const db = new Database(process.env.R6_DB); db.exec("PRAGMA busy_timeout=5000");
        const facade = { prepare: (...args) => db.prepare(...args), exec: (...args) => db.exec(...args), transaction: fn => {
          console.log("ready-after-preflight");
          const cell = new Int32Array(new SharedArrayBuffer(4));
          const deadline = Date.now() + 5000;
          while (!existsSync(process.env.R6_GO)) { if (Date.now() > deadline) throw new Error("Synthetic migration barrier timeout"); Atomics.wait(cell, 0, 0, 5); }
          return db.transaction(fn);
        }};
        ensureThreadCollabRuntimeSchema(facade); ensureThreadCollabRuntimeSchema(facade);
        console.log("migrated", JSON.stringify([db.prepare("PRAGMA table_info(thread_collab_state)").all(), db.prepare("PRAGMA table_info(thread_comments)").all()].map(cols => cols.filter(c => c.name === "revision").length)));
        db.close();
      `;
      const workers = Array.from({ length: 2 }, () => {
        const child = spawn(process.execPath, ["--eval", script], { env: { ...process.env, R6_DB: file, R6_GO: go }, stdio: ["ignore", "pipe", "pipe"] });
        let output = "", errors = "", readyResolve!: () => void;
        const ready = new Promise<void>(resolve => { readyResolve = resolve; });
        child.stdout.on("data", chunk => { output += chunk; if (output.includes("ready-after-preflight")) readyResolve(); });
        child.stderr.on("data", chunk => { errors += chunk; });
        const done = new Promise<{ code: number | null; output: string; errors: string }>(resolve => child.on("close", code => resolve({ code, output, errors })));
        return { ready, done };
      });
      await Promise.all(workers.map(w => w.ready)); writeFileSync(go, "synthetic-start");
      const results = await Promise.all(workers.map(w => w.done));
      console.log("R6-migration", round, JSON.stringify(results));
      for (const result of results) { expect(result.code).toBe(0); expect(result.errors).toBe(""); expect(result.output).toContain("migrated [1,1]"); }
      expect(store.getThreadCollabState(db, "synthetic-a", "X").revision).toBe(0);
      expect(store.getThreadComment(db, "synthetic-a", "X", "synthetic-id")?.revision).toBe(0);
    } finally { db.close(); rmSync(dir, { recursive: true, force: true }); }
  }
}, 20000);

it("R6-REST: each mutation returns exactly the revision read by a following GET", async () => {
  const f = await createCollabFixture(); await f.seed(f.message("X"));
  const session = await createAuthenticatedTestSession(f.accountId);
  await session.addMembership(session.user.id, f.accountId, "editor");
  const route = (commentId?: string) => ({ params: Promise.resolve({ accountId: f.accountId, threadId: "X", ...(commentId ? { commentId } : {}) }) });
  const request = (method = "GET", body?: unknown) => new Request("http://localhost:3000/api/collab", { method, headers: session.jar.headers({ origin: "http://localhost:3000", "content-type": "application/json" }), ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const assertGet = async (mutation: Response, expected: number) => {
    expect(mutation.ok).toBe(true); const written = await mutation.json();
    const readResponse = await GET(request(), route()); expect(readResponse.status).toBe(200);
    const read = await readResponse.json(); expect(written.state.revision).toBe(expected); expect(read.state).toEqual(written.state);
    if (written.comment) expect(read.comments.find((c: { id: string }) => c.id === written.comment.id)).toEqual(written.comment);
    return written;
  };
  await assertGet(await PATCH(request("PATCH", { status: "waiting" }), route()), 1);
  await assertGet(await PATCH(request("PATCH", { status: "waiting" }), route()), 2);
  const added = await assertGet(await POST(request("POST", { body: "Synthetic REST note" }), route()), 3);
  await assertGet(await DELETE(request("DELETE"), route(added.comment.id)), 4);
  await assertGet(await DELETE(request("DELETE"), route(added.comment.id)), 5);
});

it("R6-lifecycle-contract: real snapshots change visible comments/activity at the same revision when messages disappear and reappear", async () => {
  const f = await createCollabFixture(); const [message] = await f.seed(f.message("X"));
  const added = await store.mutateThreadCollab(f.accountId, "X", (db, now) => store.addThreadComment(db, f.accountId, "X", "Synthetic historical", actor, now));
  const live = await getThreadCollabSnapshot(f.accountId, "X");
  f.db.prepare("UPDATE messages SET deleted=1 WHERE accountId=? AND id=?").run(f.accountId, message.id);
  const hidden = await getThreadCollabSnapshot(f.accountId, "X");
  f.db.prepare("UPDATE messages SET deleted=0 WHERE accountId=? AND id=?").run(f.accountId, message.id);
  const restored = await getThreadCollabSnapshot(f.accountId, "X");
  expect(live.state).toEqual(added!.state); expect(hidden.state).toEqual(live.state); expect(restored.state).toEqual(live.state);
  expect(live.comments).toHaveLength(1); expect(live.activity).toHaveLength(1);
  expect(hidden.comments).toEqual([]); expect(hidden.activity).toEqual([]);
  expect(restored).toEqual(live);
  console.log("R6-lifecycle actual service", JSON.stringify({ revision: live.state.revision, live: [live.comments.length, live.activity.length], hidden: [hidden.comments.length, hidden.activity.length], restored: [restored.comments.length, restored.activity.length] }));
});

for (const shape of ["swap", "chain"] as const) it(`R6-remap-live: real message ${shape} honors live-old-key retention without resetting revisions`, async () => {
  const f = await createCollabFixture(); const [a, b] = await f.seed(f.message("A"), f.message("B"));
  const noteA = tx(f.db, () => store.addThreadComment(f.db, f.accountId, "A", "Synthetic live A", actor, 1));
  const noteB = tx(f.db, () => store.addThreadComment(f.db, f.accountId, "B", "Synthetic live B", actor, 1));
  const secondTarget = shape === "swap" ? "A" : "C";
  tx(f.db, () => {
    f.db.prepare("UPDATE messages SET threadId=? WHERE id=?").run("B", a.id);
    f.db.prepare("UPDATE messages SET threadId=? WHERE id=?").run(secondTarget, b.id);
    store.remapThreadCollab(f.db, f.accountId, [
      { id: a.id, oldThreadId: "A", newThreadId: "B", dateValue: 1 },
      { id: b.id, oldThreadId: "B", newThreadId: secondTarget, dateValue: 2 },
    ]);
  });
  // A source with any remaining live message retains all metadata (§3.2).
  if (shape === "swap") {
    expect(store.getThreadCollabState(f.db, f.accountId, "A").revision).toBe(1);
    expect(store.getThreadCollabState(f.db, f.accountId, "B").revision).toBe(1);
    expect(store.listThreadComments(f.db, f.accountId, "A")).toEqual([noteA.comment]);
    expect(store.listThreadComments(f.db, f.accountId, "B")).toEqual([noteB.comment]);
  } else {
    expect(store.getThreadCollabState(f.db, f.accountId, "A").revision).toBe(2);
    expect(store.getThreadCollabState(f.db, f.accountId, "B").revision).toBe(2);
    expect(store.listThreadComments(f.db, f.accountId, "B").map(c => c.id).sort()).toEqual([noteA.comment.id, noteB.comment.id].sort());
    expect(store.getThreadCollabState(f.db, f.accountId, "C").revision).toBe(0);
    // Restore A through a fresh synthetic identity; its retained counter advances.
    await f.seed(f.message("A", { messageId: "<synthetic-fresh-A@example.test>" }));
    const reused = await store.mutateThreadCollab(f.accountId, "A", (db, now) => store.updateThreadCollabState(db, f.accountId, "A", { status: "waiting" }, actor, now));
    expect(reused!.revision).toBe(3);
  }
});

it("R6-lifecycle-public: deleteMessageById and reimport change GET visibility without changing revision", async () => {
  const f = await createCollabFixture(); const [message] = await f.seed(f.message("<synthetic-lifecycle@example.test>"));
  await store.mutateThreadCollab(f.accountId, message.threadId, (db, now) => store.addThreadComment(db, f.accountId, message.threadId, "Synthetic retained", actor, now));
  const live = await getThreadCollabSnapshot(f.accountId, message.threadId);
  await f.api.deleteMessageById(f.accountId, message.id);
  const hidden = await getThreadCollabSnapshot(f.accountId, message.threadId);
  await f.seed(message);
  const restored = await getThreadCollabSnapshot(f.accountId, message.threadId);
  expect(hidden.state).toEqual(live.state); expect(restored.state).toEqual(live.state);
  expect(live.comments).toHaveLength(1); expect(hidden.comments).toEqual([]); expect(restored.comments).toEqual(live.comments);
  expect(hidden.activity).toEqual([]); expect(restored.activity).toEqual(live.activity);
  console.log("R6-lifecycle public deletion/reimport", JSON.stringify({ revision: live.state.revision, lengths: [live.comments.length, hidden.comments.length, restored.comments.length] }));
});
