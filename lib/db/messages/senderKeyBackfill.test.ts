import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { expect, test } from "bun:test";
import { createCollabFixture } from "../../testThreadCollabHarness";
import { isolatedImapTest } from "../../testFixtures/isolatedImapTest";
import { getDataDir } from "../../runtimePaths";
import { getExactMessageSourcePath, messageSourceSha256 } from "../../storage";
import { syncImapMessage } from "../../mail/imap";
import { drainImapConnectionPool } from "../../mail/imap/connectionPool";
import { sanitizeSyncedMessage } from "../../mail/syncMessageSanitizer";
import { resyncImapMessageIntoDb } from "../../mail/resyncMessage";
import { startImapServer } from "../../../scripts/dev-fixture/imap-server";
import { checkLegacySourceOwnership } from "./senderKey";
import { parseSenderKeyBackfillArgs, runSenderKeyBackfill, type SenderKeyBackfillResult } from "./senderKeyBackfill";

const script = fileURLToPath(new URL("../../../scripts/backfill-sender-keys.ts", import.meta.url));

async function runScript(args: string[]) {
  const { stdout } = await promisify(execFile)(process.execPath, [script, "--data", getDataDir(), ...args],
    { cwd: process.cwd(), env: process.env, timeout: 15_000 });
  return stdout;
}

const wire = (messageId: string, from: string, subject: string) => Buffer.from(
  `From: ${from}\r\nTo: team@example.test\r\nSubject: ${subject}\r\nDate: Thu, 01 Oct 2026 08:00:00 +0000\r\n`
  + `Message-ID: ${messageId}\r\nContent-Type: text/html; charset=utf-8\r\n\r\n<p>Synthetic ${subject}</p>\r\n`);

isolatedImapTest(import.meta.url, "NOCTUA_REAL_SENDER_KEY_BACKFILL",
  "backfill stamps legacy rows like a fresh resync, skips foreign sources and is idempotent", async () => {
    const f = await createCollabFixture();
    const server = await startImapServer({ port: 0, user: "team@example.test", pass: "synthetic" });
    const outDir = await mkdtemp(join(tmpdir(), "sender-key-backfill-"));
    try {
      const account = { ...f.account, imap: { ...f.account.imap, host: "127.0.0.1", port: server.port, secure: false } };
      const wires = {
        plain: wire("<plain@example.test>", "Plain Sender <plain@example.test>", "plain"),
        encoded: wire("<encoded@example.test>", "=?UTF-8?Q?J=C3=BCrgen_M=C3=BCller?= <juergen@example.test>", "encoded"),
        utf8Local: wire("<utf8@example.test>", "tést@example.test", "utf8"),
        quotedCase: wire("<quoted@example.test>", "\"Muster, Erika\" <Erika.Muster@Example.TEST>", "quoted"),
        foreignSender: wire("<foreign@example.test>", "Trusted <trusted@example.test>", "foreign"),
        foreignMessageId: wire("<mid-a@example.test>", "Plain Sender <plain@example.test>", "mid"),
        resized: wire("<resized@example.test>", "Plain Sender <plain@example.test>", "resized"),
        missing: wire("<missing@example.test>", "Plain Sender <plain@example.test>", "missing"),
        keyed: wire("<keyed@example.test>", "Plain Sender <plain@example.test>", "keyed")
      };
      // Ingest through the same fetch → sanitize → upsert path as sync and resync.
      const ids = {} as Record<keyof typeof wires, string>;
      const uids = {} as Record<keyof typeof wires, number>;
      for (const [name, bytes] of Object.entries(wires) as Array<[keyof typeof wires, Buffer]>) {
        const { uid } = server.store.append("INBOX", bytes);
        const message = await syncImapMessage(account, "INBOX", uid);
        if (!message) throw new Error(`fixture message ${name} not fetched`);
        await f.api.upsertMessages(account.id, message.folderId, [await sanitizeSyncedMessage(message, account.id)]);
        ids[name] = message.id;
        uids[name] = uid;
      }
      const keyColumns = () => Object.fromEntries((f.db.prepare(`SELECT id, senderKey, sourceSha256 FROM messages WHERE accountId = ?`)
        .all(account.id) as Array<{ id: string; senderKey: string | null; sourceSha256: string | null }>)
        .map(row => [row.id, { senderKey: row.senderKey, sourceSha256: row.sourceSha256 }]));
      const fresh = keyColumns();
      expect(fresh[ids.encoded].senderKey).toBe("juergen@example.test");
      expect(fresh[ids.quotedCase].senderKey).toBe("erika.muster@example.test");
      for (const id of Object.values(ids)) expect(fresh[id].sourceSha256).toMatch(/^[0-9a-f]{64}$/);

      // Legacy state: no key and no digest. Model a source another copy with
      // the same Message-ID overwrote (same size), a mismatching Message-ID,
      // a changed size and a lost source.
      f.db.prepare(`UPDATE messages SET senderKey = NULL, sourceSha256 = NULL WHERE accountId = ? AND id != ?`).run(account.id, ids.keyed);
      const replace = async (id: string, from: string, to: string) => {
        const file = getExactMessageSourcePath(account.id, id);
        const source = await readFile(file, "utf8");
        expect(source).toContain(from);
        await writeFile(file, source.replace(from, to));
      };
      await replace(ids.foreignSender, "trusted@example.test", "attack1@example.test");
      await replace(ids.foreignMessageId, "<mid-a@example.test>", "<mid-b@example.test>");
      await replace(ids.resized, "Synthetic resized", "Synthetic resized and padded");
      await unlink(getExactMessageSourcePath(account.id, ids.missing));
      const snapshot = () => f.db.prepare(`SELECT * FROM messages WHERE accountId = ? ORDER BY id`).all(account.id) as Array<Record<string, unknown>>;
      const before = snapshot();

      const dryOut = join(outDir, "dry.json");
      const dryStdout = await runScript(["--account", account.id, "--out", dryOut]);
      expect(dryStdout).toContain("Dry run (read-only)");
      expect(dryStdout).toContain("4 would be stamped");
      expect(snapshot()).toEqual(before);
      const dry = JSON.parse(await readFile(dryOut, "utf8")) as SenderKeyBackfillResult;
      expect(dry.accounts).toEqual([expect.objectContaining({
        accountId: account.id, refused: null, missingShard: false, rows: 9, nullKey: 8, withDigest: 0, legacy: 8, legacyHasSource: 8,
        examined: 8, sourcePresent: 7, withoutSource: 1, accepted: 4, stamped: 0,
        skipped: { size: 1, "message-id": 1, "no-sender-key": 0, sender: 1 }
      })]);
      expect(JSON.stringify(dry.accounts)).not.toContain("team@example.test");
      const expectedSkips = [
        { accountId: account.id, id: ids.foreignSender, reason: "sender" },
        { accountId: account.id, id: ids.foreignMessageId, reason: "message-id" },
        { accountId: account.id, id: ids.resized, reason: "size" }
      ];
      expect(dry.skippedRows).toEqual(expect.arrayContaining(expectedSkips));
      expect(dry.skippedRows).toHaveLength(3);

      const writeOut = join(outDir, "write.json");
      const writeStdout = await runScript(["--account", account.id, "--write", "--batch", "3", "--out", writeOut]);
      expect(writeStdout).toContain(`${account.id} batch 3:`);
      const written = JSON.parse(await readFile(writeOut, "utf8")) as SenderKeyBackfillResult;
      expect(written.accounts[0]).toMatchObject({ accepted: 4, stamped: 4 });
      expect(written.skippedRows).toEqual(expect.arrayContaining(expectedSkips));
      // Stamped rows equal a fresh sync; every other column and row is unchanged.
      const stamped = new Set([ids.plain, ids.encoded, ids.utf8Local, ids.quotedCase]);
      expect(snapshot()).toEqual(before.map(row => stamped.has(row.id as string) ? { ...row, ...fresh[row.id as string] } : row));

      // Resumable and idempotent: a second run finds nothing left to write.
      const again = await runSenderKeyBackfill({ dataDir: getDataDir(), account: account.id, write: true });
      expect(again.accounts[0]).toMatchObject({ legacy: 4, examined: 4, accepted: 0, stamped: 0 });
      expect(again.skippedRows).toHaveLength(3);

      // A fresh resync of every stamped row writes the same values.
      for (const name of ["plain", "encoded", "utf8Local", "quotedCase"] as const) {
        const existing = await f.api.getMessageById(account.id, ids[name]);
        const refreshed = await resyncImapMessageIntoDb(account, existing!, uids[name]);
        expect(refreshed?.senderKey).toBe(fresh[ids[name]].senderKey);
      }
      const resynced = keyColumns();
      for (const id of stamped) expect(resynced[id]).toEqual(fresh[id]);
    } finally {
      await drainImapConnectionPool();
      await server.stop();
      await rm(outDir, { recursive: true, force: true });
    }
  });

test("write refuses a shard older than the app's format and changes nothing", async () => {
  const f = await createCollabFixture();
  await f.seed(f.message("<old-format@example.test>", { senderKey: null, hasSource: true }));
  const before = f.db.prepare(`SELECT * FROM messages WHERE accountId = ?`).all(f.accountId);
  f.db.exec("PRAGMA user_version = 2");
  try {
    await expect(runSenderKeyBackfill({ dataDir: getDataDir(), account: f.accountId, write: true }))
      .rejects.toThrow(/older than 3/);
    const dry = await runSenderKeyBackfill({ dataDir: getDataDir(), account: f.accountId, write: false });
    expect(dry.accounts[0].refused).toMatch(/older than 3/);
    expect(dry.accounts[0].examined).toBe(0);
  } finally {
    f.db.exec("PRAGMA user_version = 3");
  }
  expect(f.db.prepare(`SELECT * FROM messages WHERE accountId = ?`).all(f.accountId)).toEqual(before);
});

test("legacy ownership needs the row's size, Message-ID and From mailbox", () => {
  const source = "From: \"first:second\"@example.test\r\nMessage-ID: <lossy@example.test>\r\n\r\nSynthetic";
  const row = { messageId: "<lossy@example.test>", fromAddr: "\"first:second\"@example.test", sizeBytes: Buffer.byteLength(source) };
  expect(checkLegacySourceOwnership(row, source)).toEqual({ senderKey: "\"first:second\"@example.test", sourceSha256: messageSourceSha256(source) });
  // A legacy display string that lost the quotes names a different mailbox.
  expect(checkLegacySourceOwnership({ ...row, fromAddr: "first:second@example.test" }, source)).toEqual({ skip: "sender" });
  expect(checkLegacySourceOwnership({ ...row, sizeBytes: null }, source)).toEqual({ skip: "size" });
  expect(checkLegacySourceOwnership({ ...row, messageId: null }, source)).toEqual({ skip: "message-id" });
  expect(checkLegacySourceOwnership(row, source.replace("From: \"first:second\"@example.test", "From: undisclosed"))).toEqual({ skip: "size" });
  const noSender = "From: undisclosed-recipients:;\r\nMessage-ID: <lossy@example.test>\r\n\r\nSynthetic";
  expect(checkLegacySourceOwnership({ ...row, sizeBytes: Buffer.byteLength(noSender) }, noSender)).toEqual({ skip: "no-sender-key" });
});

test("argument parsing keeps the dry run default and the report outside the data dir", () => {
  expect(parseSenderKeyBackfillArgs(["--data", "/srv/data"])).toEqual(
    { kind: "run", dataDir: "/srv/data", account: null, write: false, batch: 500, limit: null, out: null });
  expect(parseSenderKeyBackfillArgs(["--data", "/srv/data", "--write", "--batch", "50", "--limit", "10", "--account", "acc"]))
    .toMatchObject({ kind: "run", write: true, batch: 50, limit: 10, account: "acc" });
  expect(parseSenderKeyBackfillArgs([])).toMatchObject({ kind: "error" });
  expect(parseSenderKeyBackfillArgs(["--data", "/srv/data", "--batch", "0"])).toMatchObject({ kind: "error" });
  expect(parseSenderKeyBackfillArgs(["--data", "/srv/data", "--write", "--dry-run"])).toMatchObject({ kind: "error" });
  expect(parseSenderKeyBackfillArgs(["--data", "/srv/data", "--out", "/srv/data/report.json"])).toMatchObject({ kind: "error" });
  expect(parseSenderKeyBackfillArgs(["--data", "/srv/data", "--immutable"])).toMatchObject({ kind: "error" });
});
