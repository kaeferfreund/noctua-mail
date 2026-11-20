import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { createCollabFixture } from "../testThreadCollabHarness";
import { createSharedShardFixture } from "../testSharedShardHarness";
import { getDefaultAccountDbPath } from "../runtimePaths";
import { getAccountDb, getDb } from "./connection";
import { ACCOUNT_SHARD_RUNTIME_TABLES, ACCOUNT_SHARD_TABLES } from "./shardFormat";
import { getSenderProfile, recordSenderProfileMail, saveSpamExample } from "./spam";
import { trustedFacts } from "../mail/spam/testProfiles";
import { loadMailboxSpamSettings, saveMailboxSpamSettings } from "../mail/spam/settings";
import { validateFtsIdentity } from "./ftsIdentity";
import { createApiToken, authenticateSubscribeToken } from "../addons/outreach/contacts/apiTokens";
import { createContactList, upsertContact } from "../addons/outreach/contacts/records";
import { getOutreachDb } from "../addons/outreach/db";
import { saveOutreachSettings } from "../addons/outreach/settings";
import { createTopic, listTopics } from "../topics";

const thread = "<lifecycle-root@example.test>";

function rowsOf(db: any, accountId: string) {
  return Object.fromEntries([...ACCOUNT_SHARD_TABLES, ...ACCOUNT_SHARD_RUNTIME_TABLES]
    .map(table => [table, (db.prepare(`SELECT COUNT(*) AS n FROM "${table}" WHERE accountId = ?`).get(accountId) as { n: number }).n])
    .filter(([, count]) => count));
}

describe("mailbox deletion lifecycle", () => {
  test("another spelling of the same shard path keeps the other mailbox's shard", async () => {
    const a = await createCollabFixture();
    const b = await createCollabFixture();
    await a.seed(a.message(thread, { subject: "A keeps this" }));
    const file = getDefaultAccountDbPath(a.accountId);
    const slash = file.lastIndexOf("/");
    const alias = `${file.slice(0, slash)}/./${file.slice(slash + 1)}`;
    expect(alias).not.toBe(file);
    (await getDb()).prepare("UPDATE accounts SET dbPath = ? WHERE id = ?").run(alias, b.accountId);
    expect(await b.api.deleteAccountControlPlane(b.accountId)).toBe(true);
    expect(existsSync(file)).toBe(true);
    expect((await a.api.listThreads({ accountId: a.accountId, page: 1, pageSize: 30 })).items).toHaveLength(1);
  });

  test("a retained shared shard loses every row of the deleted mailbox, and a recreated mailbox inherits none", async () => {
    const { a, b } = await createSharedShardFixture();
    await a.seed(a.message(thread, { subject: "Private A", body: "syntheticdeletedword",
      attachments: [{ id: "att", filename: "A.pdf", contentType: "application/pdf", size: 1, inline: false }] }));
    await b.seed(b.message(thread, { subject: "B stays", body: "syntheticretainedword" }));
    await createTopic(a.accountId, "A topic", "blue");
    // Spam learning keeps subjects/snippets and sender trust per mailbox (SD5).
    await saveSpamExample(a.accountId, { messageId: null, senderEmail: "sender@example.test", senderDomain: "example.test",
      subject: "Private A subject", snippet: "syntheticdeletedword", label: "ham", source: "user", decidedByUserId: null, createdAt: 1_000 });
    await recordSenderProfileMail(a.accountId, trustedFacts({ date: 1_000 }), "m1");
    const senderKey = trustedFacts({ date: 1_000 }).senderKey;
    const before = rowsOf(await getAccountDb(b.accountId), a.accountId);
    expect(before.messages).toBe(1);
    expect(before.folders).toBe(1);
    expect(before.spam_examples).toBe(1);
    expect(before.spam_sender_profiles).toBe(1);

    expect(await a.api.deleteAccountControlPlane(a.accountId)).toBe(true);
    const file = getDefaultAccountDbPath(a.accountId);
    expect(existsSync(file)).toBe(true);
    const shard = await getAccountDb(b.accountId);
    expect(rowsOf(shard, a.accountId)).toEqual({});
    expect(shard.prepare("SELECT COUNT(*) AS n FROM message_fts_v3 WHERE accountId = ?").get(a.accountId)).toEqual({ n: 0 });
    validateFtsIdentity(shard);
    expect((await b.api.listMessages({ accountId: b.accountId, page: 1, pageSize: 30, query: "syntheticretainedword" })).items).toHaveLength(1);

    // Same id and default path as before: nothing of the old mailbox comes back.
    await a.api.upsertAccount(a.account);
    expect(await getAccountDb(a.accountId)).toBe(await getAccountDb(b.accountId));
    expect(await a.api.getFolders(a.accountId)).toEqual([]);
    expect((await a.api.listMessages({ accountId: a.accountId, page: 1, pageSize: 30, query: "syntheticdeletedword" })).items).toEqual([]);
    expect(await listTopics(a.accountId)).toEqual([]);
    expect(await getSenderProfile(a.accountId, senderKey)).toBeNull();
  });

  test("the purge list covers every account-scoped table of a shard", async () => {
    const f = await createCollabFixture();
    const scoped = (f.db.prepare(`SELECT m.name FROM pragma_table_list m
      WHERE m.schema = 'main' AND m.type = 'table' AND EXISTS (SELECT 1 FROM pragma_table_info(m.name) WHERE name = 'accountId')
      ORDER BY m.name`).all() as Array<{ name: string }>).map(row => row.name);
    expect(scoped).toContain("spam_examples");
    const purged = new Set([...ACCOUNT_SHARD_TABLES, ...ACCOUNT_SHARD_RUNTIME_TABLES]);
    expect(scoped.filter(table => !purged.has(table))).toEqual([]);
  });

  test("scheduled sends and watcher state of the deleted mailbox are removed", async () => {
    const f = await createCollabFixture();
    const master = await getDb();
    const now = Date.now();
    master.prepare(`INSERT INTO scheduled_sends (id, accountId, userId, draftId, sendAt, status, nextAttemptAt, createdAt, updatedAt)
      VALUES (?, ?, 'synthetic-user', 'draft-1', ?, 'queued', ?, ?, ?)`).run(crypto.randomUUID(), f.accountId, now + 60_000, now + 60_000, now, now);
    master.prepare("INSERT INTO mailbox_watcher_auth (accountId, identity) VALUES (?, 'synthetic')").run(f.accountId);
    expect(await f.api.deleteAccountControlPlane(f.accountId)).toBe(true);
    expect(master.prepare("SELECT COUNT(*) AS n FROM scheduled_sends WHERE accountId = ?").get(f.accountId)).toEqual({ n: 0 });
    expect(master.prepare("SELECT COUNT(*) AS n FROM mailbox_watcher_auth WHERE accountId = ?").get(f.accountId)).toEqual({ n: 0 });
  });

  test("the mailbox's spam settings (prefixed and legacy scope) end with it; global and other mailboxes stay", async () => {
    const f = await createCollabFixture();
    const other = await createCollabFixture();
    const master = await getDb();
    await saveMailboxSpamSettings(f.accountId, { enabled: false, autoMove: true, threshold: 0.5 }, "synthetic-admin");
    await saveMailboxSpamSettings(other.accountId, { enabled: false }, "synthetic-admin");
    master.prepare(`INSERT INTO spam_settings (scope, settings, updatedAt) VALUES (?, '{"enabled":false}', 0)`).run(f.accountId);
    master.prepare(`INSERT INTO spam_settings (scope, settings, updatedAt) VALUES ('global', '{}', 0) ON CONFLICT(scope) DO NOTHING`).run();
    const scopes = [`account:${f.accountId}`, f.accountId, `account:${other.accountId}`, "global"];
    const stored = () => (master.prepare("SELECT scope FROM spam_settings WHERE scope IN (?, ?, ?, ?) ORDER BY scope")
      .all(...scopes) as Array<{ scope: string }>).map(row => row.scope);
    expect(stored()).toHaveLength(4);

    expect(await f.api.deleteAccountControlPlane(f.accountId)).toBe(true);
    expect(stored()).toEqual([`account:${other.accountId}`, "global"].sort());
    // A mailbox recreated for the same address starts with the defaults.
    expect(await loadMailboxSpamSettings(f.accountId)).toEqual({});
  });

  test("newsletter data and subscribe tokens end with the mailbox; only the hashed suppression stays", async () => {
    const f = await createCollabFixture();
    await saveOutreachSettings(f.accountId, { enabled: true }, "synthetic-manager");
    const list = await createContactList(f.accountId, { name: "Synthetic list" });
    await upsertContact(f.accountId, { email: "reader@example.test", firstName: "Synthetic" });
    const { secret } = await createApiToken(f.accountId, "synthetic-manager", { name: "Website", listIds: [list.id] });
    await expect(authenticateSubscribeToken(`Bearer ${secret}`)).resolves.toMatchObject({ accountId: f.accountId });

    expect(await f.api.deleteAccountControlPlane(f.accountId)).toBe(true);
    await expect(authenticateSubscribeToken(`Bearer ${secret}`)).rejects.toThrow("Invalid bearer token");
    const db = await getOutreachDb();
    const tables = (db.query(`SELECT m.name FROM pragma_table_list m WHERE m.schema = 'main' AND m.type = 'table'
      AND EXISTS (SELECT 1 FROM pragma_table_info(m.name) WHERE name = 'accountId')`).all() as Array<{ name: string }>).map(row => row.name);
    const left = Object.fromEntries(tables.map(table => [table,
      (db.query(`SELECT COUNT(*) AS n FROM "${table}" WHERE accountId = ?`).get(f.accountId) as { n: number }).n]).filter(([, n]) => n));
    expect(left).toEqual({ erased_addresses: 1 });
  });
});
