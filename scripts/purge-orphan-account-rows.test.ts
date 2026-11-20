import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import path from "node:path";
import { createCollabFixture } from "../lib/testThreadCollabHarness";
import { createSharedShardFixture } from "../lib/testSharedShardHarness";
import { getDataDir, getDefaultAccountDbPath } from "../lib/runtimePaths";
import { closeAccountDbConnection, getAccountDb, getDb } from "../lib/db/connection";
import { ACCOUNT_SHARD_RUNTIME_TABLES, ACCOUNT_SHARD_TABLES } from "../lib/db/shardFormat";
import { createTopic } from "../lib/topics";
import { createApiToken } from "../lib/addons/outreach/contacts/apiTokens";
import { createContactList, upsertContact } from "../lib/addons/outreach/contacts/records";
import { getOutreachDb } from "../lib/addons/outreach/db";
import { saveOutreachSettings } from "../lib/addons/outreach/settings";
import { applyOrphanPurge, formatOrphanScan, isOrphanScanClean, scanOrphanAccountRows } from "./purge-orphan-account-rows";

const thread = "<orphan-purge-root@example.test>";
const MASTER_TABLES = ["user_accounts", "sender_identities", "scheduled_sends", "mailbox_watcher_auth"];

function countRows(db: any, tables: string[], accountId: string) {
  return Object.fromEntries(tables
    .map(table => [table, (db.prepare(`SELECT COUNT(*) AS n FROM "${table}" WHERE accountId = ?`).get(accountId) as { n: number }).n])
    .filter(([, n]) => n));
}

function outreachRows(db: any, accountId: string) {
  const tables = (db.query(`SELECT m.name FROM pragma_table_list m WHERE m.schema = 'main' AND m.type = 'table'
    AND EXISTS (SELECT 1 FROM pragma_table_info(m.name) WHERE name = 'accountId')`).all() as Array<{ name: string }>).map(row => row.name);
  return countRows(db, tables, accountId);
}

describe("purge-orphan-account-rows", () => {
  test("finds exactly the mailboxes deleted the old way, removes only their rows and files, and leaves the live mailbox", async () => {
    // Other test files share this data dir; start from a dir without leftovers so "exactly" holds.
    await getDb();
    expect(await applyOrphanPurge(scanOrphanAccountRows())).toEqual([]);

    const { a, b, master } = await createSharedShardFixture();
    const c = await createCollabFixture();
    await a.seed(a.message(thread, { subject: "Deleted A", body: "syntheticorphanword" }));
    await b.seed(b.message(thread, { subject: "Live B", body: "syntheticliveword" }));
    await c.seed(c.message(thread, { subject: "Deleted C" }));
    await createTopic(a.accountId, "A topic", "blue");
    const now = Date.now();
    for (const mailbox of [a, b]) {
      master.prepare("INSERT INTO user_accounts (userId, accountId) VALUES ('synthetic-user', ?)").run(mailbox.accountId);
      master.prepare(`INSERT INTO scheduled_sends (id, accountId, userId, draftId, sendAt, status, nextAttemptAt, createdAt, updatedAt)
        VALUES (?, ?, 'synthetic-user', 'draft-1', ?, 'queued', ?, ?, ?)`).run(crypto.randomUUID(), mailbox.accountId, now + 60_000, now + 60_000, now, now);
      master.prepare("INSERT INTO mailbox_watcher_auth (accountId, identity) VALUES (?, 'synthetic')").run(mailbox.accountId);
      await saveOutreachSettings(mailbox.accountId, { enabled: true }, "synthetic-manager");
      const list = await createContactList(mailbox.accountId, { name: "Synthetic list" });
      await upsertContact(mailbox.accountId, { email: "reader@example.test", firstName: "Synthetic" });
      await createApiToken(mailbox.accountId, "synthetic-manager", { name: "Website", listIds: [list.id] });
    }
    // Spam settings are keyed by scope: the prefixed and the legacy bare-id row of A are orphans, B's row and "global" are not.
    const spamScopes = [`account:${a.accountId}`, a.accountId, `account:${b.accountId}`, "global"];
    for (const scope of spamScopes) {
      master.prepare(`INSERT INTO spam_settings (scope, settings, updatedAt, updatedByUserId) VALUES (?, '{"enabled":false}', 0, NULL)
        ON CONFLICT(scope) DO NOTHING`).run(scope);
    }
    const spamRows = () => (master.prepare("SELECT scope FROM spam_settings WHERE scope IN (?, ?, ?, ?) ORDER BY scope")
      .all(...spamScopes) as Array<{ scope: string }>).map(row => row.scope);
    const outreach = await getOutreachDb();
    const liveOutreachBefore = outreachRows(outreach, b.accountId);
    const sharedFile = getDefaultAccountDbPath(a.accountId);
    const shared = await getAccountDb(b.accountId);
    const shardTables = [...ACCOUNT_SHARD_TABLES, ...ACCOUNT_SHARD_RUNTIME_TABLES]
      .filter(table => shared.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(table));
    const liveShardBefore = countRows(shared, shardTables, b.accountId);
    const cFile = getDefaultAccountDbPath(c.accountId);
    closeAccountDbConnection(cFile);

    // The deletion path before the fix: the accounts row went, everything else stayed.
    master.prepare("DELETE FROM accounts WHERE id IN (?, ?)").run(a.accountId, c.accountId);

    const scan = scanOrphanAccountRows();
    expect(scan.master).toEqual({
      [a.accountId]: { user_accounts: 1, sender_identities: 1, scheduled_sends: 1, mailbox_watcher_auth: 1, spam_settings: 2 },
      [c.accountId]: { sender_identities: 1 }
    });
    const withRows = scan.shards.filter(shard => Object.keys(shard.orphans).length || shard.removable);
    expect(withRows.map(shard => [path.basename(shard.path), shard.role, shard.removable, Object.keys(shard.orphans)])).toEqual([
      [path.basename(sharedFile), "referenced", false, [a.accountId]],
      [path.basename(cFile), "unreferenced", true, [c.accountId]]
    ]);
    expect(withRows[0].orphans[a.accountId]).toMatchObject({ messages: 1, folders: 1, topics: 1, message_fts_identity: 1, message_fts_v3: 1 });
    expect(Object.keys(scan.outreach ?? {})).toEqual([a.accountId]);
    expect(scan.outreach![a.accountId]).toMatchObject({ account_settings: 1, contacts: 1, lists: 1, api_tokens: 1 });
    expect(scan.outreach![a.accountId].erased_addresses).toBeUndefined();
    const report = formatOrphanScan(scan);
    expect(report).toContain(a.accountId);
    expect(report).not.toContain(`  ${b.accountId}:`);
    // B's own file from before it moved to the shared shard still holds B's rows: listed, kept.
    const staleB = getDefaultAccountDbPath(b.accountId);
    expect(report).toContain(`unreferenced shard file db/accounts/${path.basename(staleB)}: kept`);
    for (const secret of ["example.test", "Deleted A", "syntheticorphanword", "Synthetic list"]) expect(report).not.toContain(secret);
    expect(isOrphanScanClean(scan)).toBe(false);

    expect(await applyOrphanPurge(scan)).toEqual([]);

    expect(existsSync(cFile)).toBe(false);
    expect(existsSync(sharedFile)).toBe(true);
    expect(existsSync(staleB)).toBe(true);
    expect(countRows(shared, shardTables, a.accountId)).toEqual({});
    expect(shared.prepare("SELECT COUNT(*) AS n FROM message_fts_v3 WHERE accountId = ?").get(a.accountId)).toEqual({ n: 0 });
    expect(countRows(master, MASTER_TABLES, a.accountId)).toEqual({});
    expect(countRows(master, MASTER_TABLES, c.accountId)).toEqual({});
    expect(spamRows()).toEqual([`account:${b.accountId}`, "global"].sort());
    expect(outreachRows(outreach, a.accountId)).toEqual({ erased_addresses: 1 });
    // The live mailbox sharing the shard keeps everything.
    expect(countRows(shared, shardTables, b.accountId)).toEqual(liveShardBefore);
    expect(countRows(master, MASTER_TABLES, b.accountId)).toEqual({ user_accounts: 1, sender_identities: 1, scheduled_sends: 1, mailbox_watcher_auth: 1 });
    expect(outreachRows(outreach, b.accountId)).toEqual(liveOutreachBefore);
    expect((await b.api.listMessages({ accountId: b.accountId, page: 1, pageSize: 30, query: "syntheticliveword" })).items).toHaveLength(1);

    const again = scanOrphanAccountRows();
    expect(isOrphanScanClean(again)).toBe(true);
    expect(formatOrphanScan(again)).toContain("nothing to remove");

    // The command line reads the same data dir via --data-dir and changes nothing in a dry run.
    const cli = Bun.spawnSync(["bun", path.join(import.meta.dir, "purge-orphan-account-rows.ts"), "--data-dir", getDataDir()],
      { env: { ...process.env, NOCTUA_DATA_DIR: "" } });
    expect(cli.exitCode).toBe(0);
    expect(cli.stdout.toString()).toContain("nothing to remove");
  });

  test("refuses --apply when a mailbox's shard path lies outside the data dir (copied data dir)", async () => {
    const master = await getDb();
    const outside = path.join(path.dirname(getDataDir()), "original-data-dir", "db", "accounts", "synthetic.db");
    const id = "synthetic-outside-shard";
    master.prepare(`INSERT INTO accounts (id, name, email, avatar, dbPath, imapHost, imapPort, imapSecure, imapUser, imapPassword,
      smtpHost, smtpPort, smtpSecure, smtpUser, smtpPassword)
      VALUES (?, 'Outside', 'outside@example.test', '', ?, 'imap.example.test', 993, 1, 'u', 'p', 'smtp.example.test', 465, 1, 'u', 'p')`).run(id, outside);
    try {
      const scan = scanOrphanAccountRows();
      expect(scan.shardsOutsideDataDir).toEqual([id]);
      expect(scan.shards.some(shard => shard.path === outside)).toBe(false);
      expect(formatOrphanScan(scan)).toContain("--apply refused");
      await expect(applyOrphanPurge(scan)).rejects.toThrow("Refusing to apply");
    } finally {
      master.prepare("DELETE FROM accounts WHERE id = ?").run(id);
    }
  });
});
