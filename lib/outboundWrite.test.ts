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
