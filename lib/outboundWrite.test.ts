import { createSharedShardFixture } from "./testSharedShardHarness";
import { Database } from "bun:sqlite";
import { expect, spyOn, test } from "bun:test";
import { createCollabFixture } from "./testThreadCollabHarness";
import { getDb } from "./db/connection";
import { withOutboundWrite } from "./outboundWrite";
import { getAttachmentData, getMessageSource } from "./storage";
import { SHARD_FTS_TABLE } from "./db/shardFormat";

for (const path of ["draft", "series", "occurrence"] as const) {
  test(`guarded ${path} acquires shard before master and releases master after shard commit`, async () => {
    const f = await createCollabFixture(), master = await getDb();
    const other = new Database(master.filename);
    other.exec("PRAGMA busy_timeout=0");
    const order: string[] = [];
    const shardExec = f.db.exec.bind(f.db), masterExec = master.exec.bind(master);
    const shardSpy = spyOn(f.db, "exec").mockImplementation((sql: string) => {
      order.push(`shard:${sql}`);
      if (sql === "COMMIT") {
        expect(master.inTransaction).toBe(true);
        expect(() => other.exec("BEGIN IMMEDIATE")).toThrow("locked");
      }
      return shardExec(sql);
    });
    const masterSpy = spyOn(master, "exec").mockImplementation((sql: string) => { order.push(`master:${sql}`); return masterExec(sql); });
    const beforeWrite = async () => ({ userId: "synthetic-actor", clientId: "synthetic", assertCurrent: () => {
      expect(f.db.inTransaction).toBe(true);
      expect(master.inTransaction).toBe(true);
      expect(() => other.exec("BEGIN IMMEDIATE")).toThrow("locked");
    } });
    const event = { id: "synthetic-event", eventUid: "synthetic-event", accountId: f.accountId,
      summary: "Synthetic", startAtMs: 1800000000000, allDay: false, sourceType: "email" as const, createdAtMs: 1, updatedAtMs: 1 };
    try {
      if (path === "draft") await f.api.upsertMessages(f.accountId, null, [f.message("<guard@example.test>")], false, { beforeWrite });
      if (path === "series") await f.api.upsertCalendarEvent(f.accountId, event, beforeWrite);
      if (path === "occurrence") await f.api.upsertCalendarParticipationOverride(f.accountId, { eventUid: event.eventUid, occurrenceStartAtMs: event.startAtMs, partstat: "ACCEPTED" }, beforeWrite);
      expect(order.filter(sql => /BEGIN|COMMIT|ROLLBACK/.test(sql))).toEqual([
        "shard:BEGIN IMMEDIATE", "master:BEGIN IMMEDIATE", "shard:COMMIT", "master:ROLLBACK"
      ]);
      other.exec("BEGIN IMMEDIATE"); other.exec("ROLLBACK");
      expect(f.db.inTransaction).toBe(false);
      expect(master.inTransaction).toBe(false);
    } finally { shardSpy.mockRestore(); masterSpy.mockRestore(); other.close(); }
  });
}

test("guarded replacement INSERT failure restores draft, attachments, FTS and source; assertion failure writes nothing", async () => {
  const f = await createCollabFixture(), master = await getDb();
  const old = f.message("<rollback@example.test>", { id: "synthetic-old", flags: ["\\Draft"], source: "Synthetic old source",
    attachments: [{ id: "synthetic-attachment", filename: "synthetic.txt", contentType: "text/plain", size: 3, inline: false, dataUrl: "data:text/plain;base64,b2xk" }] });
  await f.seed(old);
  const snapshot = () => JSON.stringify([
    f.db.prepare("SELECT * FROM messages WHERE accountId=?").all(f.accountId),
    f.db.prepare("SELECT * FROM attachments WHERE accountId=?").all(f.accountId),
    f.db.prepare(`SELECT * FROM ${SHARD_FTS_TABLE} WHERE accountId=?`).all(f.accountId)
  ]);
  const before = snapshot();
  const next = { ...old, id: "synthetic-replacement", source: "Synthetic new source" };
  const beforeWrite = async () => ({ userId: "synthetic-actor", clientId: "synthetic", assertCurrent: () => {} });
  f.db.exec("CREATE TEMP TRIGGER fail_synthetic_replacement BEFORE INSERT ON messages WHEN NEW.id='synthetic-replacement' BEGIN SELECT RAISE(ABORT,'synthetic INSERT failure'); END");
  try {
    await expect(f.api.upsertMessages(f.accountId, null, [next], false, { beforeWrite, replaceDraftId: old.id })).rejects.toThrow("synthetic INSERT failure");
    expect(snapshot()).toBe(before);
    expect(await getMessageSource(f.accountId, old.id)).toBe(old.source!);
    expect((await getAttachmentData(f.accountId, old.id, "synthetic-attachment"))?.toString()).toBe("old");
    await expect(f.api.upsertMessages(f.accountId, null, [next], false, { beforeWrite: async () => ({ ...await beforeWrite(), assertCurrent: () => { throw new Error("synthetic revocation"); } }), replaceDraftId: old.id })).rejects.toThrow("synthetic revocation");
    expect(snapshot()).toBe(before);
    expect(master.inTransaction || f.db.inTransaction).toBe(false);
    expect(master.prepare("PRAGMA integrity_check").get()).toEqual({ integrity_check: "ok" });
    expect(f.db.prepare("PRAGMA integrity_check").get()).toEqual({ integrity_check: "ok" });
  } finally { f.db.exec("DROP TRIGGER fail_synthetic_replacement"); }
});

test("guard refuses an outer shard or master transaction instead of reversing locks or releasing authorization early", async () => {
  const f = await createCollabFixture(), master = await getDb();
  const authorize = async () => ({ userId: "synthetic-actor", clientId: "synthetic", assertCurrent: () => {} });
  for (const db of [f.db, master]) {
    db.exec("BEGIN IMMEDIATE");
    try {
      await expect(withOutboundWrite("synthetic nesting", authorize, async write => write(f.db, () => {}))).rejects.toThrow("must own");
      expect(db.inTransaction).toBe(true);
    } finally { db.exec("ROLLBACK"); }
  }
});

test("read-only planning owns only shard; a committed revoke there is asserted before any effect", async () => {
  const f = await createCollabFixture(), master = await getDb();
  const other = new Database(master.filename);
  other.exec("PRAGMA busy_timeout=0");
  let revoked = false, effects = 0;
  const authorize = async () => ({ userId: "synthetic", clientId: "synthetic", assertCurrent: () => {
    expect(master.inTransaction && f.db.inTransaction).toBe(true);
    if (revoked) throw new Error("synthetic revoked during planning");
  } });
  try {
    await expect(withOutboundWrite("synthetic plan", authorize, async write => write(f.db, () => {
      effects++;
    }, () => {
      expect(f.db.inTransaction).toBe(true);
      expect(master.inTransaction).toBe(false);
      other.exec("BEGIN IMMEDIATE"); revoked = true; other.exec("COMMIT");
    }))).rejects.toThrow("revoked during planning");
    expect(effects).toBe(0);
    expect(master.inTransaction || f.db.inTransaction).toBe(false);
  } finally { other.close(); }
});

test("master acquisition retry rolls both locks back and prepares a fresh actor", async () => {
  const f = await createCollabFixture(), master = await getDb();
  const exec = master.exec.bind(master);
  let preparations = 0, plans = 0, begins = 0, effects = 0;
  const spy = spyOn(master, "exec").mockImplementation((sql: string) => {
    if (sql === "BEGIN IMMEDIATE" && begins++ < 2) throw new Error("SQLITE_BUSY");
    return exec(sql);
  });
  try {
    await withOutboundWrite("synthetic handshake", async () => {
      expect(master.inTransaction || f.db.inTransaction).toBe(false);
      preparations++;
      return { userId: "synthetic", clientId: "synthetic", assertCurrent: () => {
        expect(preparations).toBe(3);
        expect(master.inTransaction && f.db.inTransaction).toBe(true);
      } };
    }, async write => write(f.db, () => { effects++; }, () => { plans++; }));
    expect([preparations, plans, begins, effects]).toEqual([3, 3, 3, 1]);
    expect(master.inTransaction || f.db.inTransaction).toBe(false);
  } finally { spy.mockRestore(); }
});

test("guarded FTS plans preserve same-copy identity and repeated IDs within a batch", async () => {
  const f = await createCollabFixture();
  const old = f.message("<synthetic-plan@example.test>", { id: "synthetic-planned-old" });
  await f.seed(old);
  const beforeWrite = async () => ({ userId: "synthetic", clientId: "synthetic", assertCurrent: () => {} });
  const renamed = { ...old, id: "synthetic-new-id", subject: "Synthetic first" };
  await f.api.upsertMessages(f.accountId, null, [renamed, { ...renamed, subject: "Synthetic final" }], false, { beforeWrite });
  const rows = f.db.prepare(`SELECT messageId, subject FROM ${SHARD_FTS_TABLE} WHERE accountId=?`).all(f.accountId);
  expect(rows).toEqual([{ messageId: old.id, subject: "Synthetic final" }]);
  expect(f.db.prepare("SELECT id, subject FROM messages WHERE accountId=?").all(f.accountId))
    .toEqual([{ id: old.id, subject: "Synthetic final" }]);
});


test("guarded FTS plans preserve colliding mailbox copies and other accounts' rows", async () => {
  const { a: f, b } = await createSharedShardFixture();
  const old = f.message("<synthetic-collision@example.test>", { id: "synthetic-collision", mailboxPath: "INBOX", imapUid: 1 });
  await f.seed(old);
  await b.seed(b.message("<other-account@example.test>", { id: old.id, subject: "Synthetic other account" }));
  const beforeWrite = async () => ({ userId: "synthetic", clientId: "synthetic", assertCurrent: () => {} });
  const variant = { ...old, imapUid: 2, subject: "Synthetic second copy" };
  await f.api.upsertMessages(f.accountId, null, [variant, { ...variant, subject: "Synthetic final copy" }], false, { beforeWrite });
  const messages = f.db.prepare("SELECT id,subject FROM messages WHERE accountId=? ORDER BY id").all(f.accountId);
  const fts = f.db.prepare(`SELECT messageId AS id,subject FROM ${SHARD_FTS_TABLE} WHERE accountId=? ORDER BY messageId`).all(f.accountId);
  expect(messages).toHaveLength(2);
  expect(fts).toEqual(messages);
  expect(f.db.prepare(`SELECT subject FROM ${SHARD_FTS_TABLE} WHERE accountId=?`).all(b.accountId))
    .toEqual([{ subject: "Synthetic other account" }]);
  // FTS v3 supplies the identity validator after integration; v2 has no map.
  if (SHARD_FTS_TABLE === ("message_fts_v3" as string)) {
    const { validateFtsIdentity } = await import("./db/" + "ftsIdentity");
    validateFtsIdentity(f.db);
  }
});


test("a busy shard retains the coarse write policy and never acquires master first", async () => {
  const f = await createCollabFixture(), master = await getDb();
  const exec = f.db.exec.bind(f.db);
  let begins = 0, preparations = 0, effects = 0;
  const retry = spyOn(console, "warn");
  const shard = spyOn(f.db, "exec").mockImplementation((sql: string) => {
    if (sql === "BEGIN IMMEDIATE" && begins++ === 0) {
      expect(master.inTransaction).toBe(false);
      throw new Error("SQLITE_BUSY");
    }
    return exec(sql);
  });
  try {
    await withOutboundWrite("synthetic shard contention", async () => {
      preparations++;
      return { userId: "synthetic", clientId: "synthetic", assertCurrent: () => {} };
    }, async write => write(f.db, () => { effects++; }));
    const logs = retry.mock.calls.filter(call => call[0] === "[db-write-retry] retry" && call[1].operation === "synthetic shard contention");
    expect(logs).toHaveLength(1);
    expect(logs[0][1]).toMatchObject({ phase: "write", policy: "coarse" });
    expect(logs[0][1].delayMs).toBeGreaterThanOrEqual(96);
    expect(logs[0][1].delayMs).toBeLessThanOrEqual(144);
    expect([begins, preparations, effects]).toEqual([2, 2, 1]);
    expect(master.inTransaction || f.db.inTransaction).toBe(false);
  } finally { retry.mockRestore(); shard.mockRestore(); }
});
