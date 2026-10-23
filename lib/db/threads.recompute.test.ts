import { expect, spyOn, test } from "bun:test";
import { createCollabFixture } from "../testThreadCollabHarness";
import { getAccountDb, getDb } from "./connection";
import { getDefaultAccountDbPath } from "../runtimePaths";
import { recomputeThreadsForAccount } from "./threads";
import { bulkUpdateMessageFlags } from "./messages/flags";

async function fixture() {
  const f = await createCollabFixture();
  const fromValues = [
    '"Legacy Sender" <LEGACY@example.test>',
    "not an address <broken>",
    '"Unicode Sender" <alias@bücher.example>',
    "other@example.test",
    "last@example.test"
  ];
  await f.seed(...fromValues.map((from, i) => f.message(i < 3 ? "one" : "two", {
    id: `local-${i}`, messageId: `<local-${i}@example.test>`, from,
    dateValue: 1000 + i, unread: true
  })));
  f.db.prepare("INSERT INTO thread_topics VALUES ('one','synthetic-topic',?,1)").run(f.accountId);
  const resetLegacy = () => f.db.prepare("UPDATE messages SET fromEmail='stale@example.test' WHERE accountId=?").run(f.accountId);
  const snapshot = () => ({
    authors: f.db.prepare("SELECT id,fromAddr,fromEmail FROM messages WHERE accountId=? ORDER BY id").all(f.accountId) as Array<{ id: string; fromAddr: string; fromEmail: string | null }>,
    signals: f.db.prepare("SELECT * FROM thread_signals WHERE accountId=? ORDER BY threadId,signalType,signalValue").all(f.accountId),
    learning: f.db.prepare("SELECT threadId,topicId,signalType,signalValue FROM topic_learning_signals WHERE accountId=? ORDER BY threadId,topicId,signalType,signalValue").all(f.accountId),
    threads: f.db.prepare("SELECT * FROM threads WHERE accountId=? ORDER BY threadId").all(f.accountId)
  });
  return { ...f, resetLegacy, snapshot };
}

test("scoped legacy author repair matches full recompute for malformed, Unicode and multiple threads", async () => {
  const f = await fixture();
  f.resetLegacy();
  await recomputeThreadsForAccount(f.accountId);
  const expected = f.snapshot();
  expect(expected.authors.map(row => row.fromEmail)).toEqual([
    "legacy@example.test", null, "alias@xn--bcher-kva.example", "other@example.test", "last@example.test"
  ]);
  f.resetLegacy();
  await recomputeThreadsForAccount(f.accountId, [" one ", "two", "one", "missing"]);
  expect(f.snapshot()).toEqual(expected);
  f.resetLegacy();
  await recomputeThreadsForAccount(f.accountId, []);
  expect(f.snapshot()).toEqual(expected);
});

test("one-thread bulk flag recompute scans only its three authors and preserves other threads", async () => {
  const f = await fixture();
  await recomputeThreadsForAccount(f.accountId);
  const expected = f.snapshot();
  f.resetLegacy();
  await bulkUpdateMessageFlags(f.accountId, [{ id: "local-0", flags: ["\\Seen", "\\Flagged"] }]);
  const prepare = f.db.prepare.bind(f.db);
  let scanned = 0;
  const spy = spyOn(f.db, "prepare").mockImplementation((sql: string, ...args: unknown[]) => {
    const statement = prepare(sql, ...args);
    if (!sql.startsWith("SELECT id,fromAddr,fromEmail FROM messages")) return statement;
    return new Proxy(statement, {
      get(target, key) {
        if (key === "all") return (...bindings: unknown[]) => {
          const rows = target.all(...bindings);
          scanned += rows.length;
          return rows;
        };
        const value = Reflect.get(target, key);
        return typeof value === "function" ? value.bind(target) : value;
      }
    });
  });
  try {
    await recomputeThreadsForAccount(f.accountId, ["one"]);
  } finally { spy.mockRestore(); }
  expect(scanned).toBe(3);
  const after = f.snapshot();
  expect(after.authors.slice(0, 3)).toEqual(expected.authors.slice(0, 3));
  expect(after.authors.slice(3).map(row => row.fromEmail)).toEqual(["stale@example.test", "stale@example.test"]);
  expect(after.signals).toEqual(expected.signals);
  expect(after.learning).toEqual(expected.learning);
  expect(after.threads[0]).toMatchObject({ messageCount: 3, unreadCount: 2 });
  expect(after.threads[1]).toEqual(expected.threads[1]);
});

test("scoped recompute isolates accounts sharing a shard and identical local ids", async () => {
  const a = await fixture();
  const b = await createCollabFixture();
  (await getDb()).prepare("UPDATE accounts SET dbPath=? WHERE id=?").run(getDefaultAccountDbPath(a.accountId), b.accountId);
  const shared = await getAccountDb(b.accountId);
  expect(shared).toBe(a.db);
  await b.api.upsertMessages(b.accountId, b.folderId, [b.message("one", {
    id: "local-0", from: "second@example.test", messageId: "<second@example.test>"
  })]);
  await recomputeThreadsForAccount(b.accountId);
  shared.prepare("UPDATE messages SET fromEmail='second-legacy@example.test' WHERE accountId=?").run(b.accountId);
  const before = {
    messages: shared.prepare("SELECT * FROM messages WHERE accountId=?").all(b.accountId),
    signals: shared.prepare("SELECT * FROM thread_signals WHERE accountId=?").all(b.accountId),
    threads: shared.prepare("SELECT * FROM threads WHERE accountId=?").all(b.accountId)
  };
  a.resetLegacy();
  await recomputeThreadsForAccount(a.accountId, ["one"]);
  expect(shared.prepare("SELECT fromEmail FROM messages WHERE accountId=? AND id='local-0'").get(a.accountId).fromEmail).toBe("legacy@example.test");
  expect({
    messages: shared.prepare("SELECT * FROM messages WHERE accountId=?").all(b.accountId),
    signals: shared.prepare("SELECT * FROM thread_signals WHERE accountId=?").all(b.accountId),
    threads: shared.prepare("SELECT * FROM threads WHERE accountId=?").all(b.accountId)
  }).toEqual(before);
});

test("author normalization batches scoped ids without treating a blank scope as a full rebuild", async () => {
  const f = await fixture();
  f.resetLegacy();
  await recomputeThreadsForAccount(f.accountId, [" ", ""]);
  expect(f.snapshot().authors.every(row => row.fromEmail === "stale@example.test")).toBe(true);
  await recomputeThreadsForAccount(f.accountId, [...Array.from({ length: 401 }, (_, i) => `missing-${i}`), "one"]);
  expect(f.snapshot().authors.slice(0, 3).map(row => row.fromEmail)).toEqual([
    "legacy@example.test", null, "alias@xn--bcher-kva.example"
  ]);
});
