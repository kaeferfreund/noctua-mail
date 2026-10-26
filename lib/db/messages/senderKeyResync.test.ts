import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { expect } from "bun:test";
import { createCollabFixture } from "../../testThreadCollabHarness";
import { isolatedImapTest } from "../../testFixtures/isolatedImapTest";
import { getDataDir } from "../../runtimePaths";
import { getExactMessageSourcePath, messageSourceSha256 } from "../../storage";
import { syncImapMessage } from "../../mail/imap";
import { drainImapConnectionPool } from "../../mail/imap/connectionPool";
import { sanitizeSyncedMessage } from "../../mail/syncMessageSanitizer";
import { runSenderKeyResync, type SenderKeyResyncResult } from "../../mail/senderKeyResync";
import { startImapServer } from "../../../scripts/dev-fixture/imap-server";

const script = fileURLToPath(new URL("../../../scripts/backfill-sender-keys.ts", import.meta.url));

async function runScript(args: string[]) {
  const { stdout } = await promisify(execFile)(process.execPath, [script, "--data", getDataDir(), ...args],
    { cwd: process.cwd(), env: process.env, timeout: 15_000 });
  return stdout;
}

const wire = (messageId: string, fromHeader: string, subject: string) => Buffer.from(
  `${fromHeader}\r\nTo: team@example.test\r\nSubject: ${subject}\r\nDate: Thu, 01 Oct 2026 08:00:00 +0000\r\n`
  + `Message-ID: ${messageId}\r\nContent-Type: text/html; charset=utf-8\r\n\r\n<p>Synthetic ${subject}</p>\r\n`);

isolatedImapTest(import.meta.url, "NOCTUA_REAL_SENDER_KEY_RESYNC",
  "resync re-fetches legacy rows from IMAP like a fresh sync, reports gone and foreign UIDs and is idempotent", async () => {
    const server = await startImapServer({ port: 0, user: "team@example.test", pass: "synthetic" });
    const f = await createCollabFixture({
      imap: { host: "127.0.0.1", port: server.port, secure: false, user: "team@example.test", password: "synthetic" }
    });
    const outDir = await mkdtemp(join(tmpdir(), "sender-key-resync-"));
    try {
      const { account } = f;
      // The classes the retained-source backfill leaves behind, plus rows it cannot fix at all.
      const wires = {
        resized: wire("<resized@example.test>", "From: Plain Sender <plain@example.test>", "resized"),
        foreignMessageId: wire("<mid-a@example.test>", "From: Plain Sender <plain@example.test>", "mid"),
        foreignSender: wire("<foreign@example.test>", "From: =?UTF-8?Q?J=C3=BCrgen?= <juergen@example.test>", "foreign"),
        missing: wire("<missing@example.test>", "From: \"Muster, Erika\" <Erika.Muster@Example.TEST>", "missing"),
        noSender: wire("<no-sender@example.test>", "From: undisclosed-recipients:;", "no sender"),
        gone: wire("<gone@example.test>", "From: Plain Sender <plain@example.test>", "gone"),
        moved: wire("<moved@example.test>", "From: Plain Sender <plain@example.test>", "moved"),
        keyed: wire("<keyed@example.test>", "From: Plain Sender <plain@example.test>", "keyed")
      };
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
      const [local, lostFolder] = await f.seed(
        f.message("<local-only@example.test>", { senderKey: null }),
        f.message("<lost-folder@example.test>", { senderKey: null, mailboxPath: "Archiv/Alt", imapUid: 7 })
      );
      const snapshot = () => Object.fromEntries((f.db.prepare(`SELECT * FROM messages WHERE accountId = ? ORDER BY id`)
        .all(account.id) as Array<Record<string, unknown>>).map(row => [row.id as string, row]));
      const fresh = snapshot();
      expect(fresh[ids.foreignSender].senderKey).toBe("juergen@example.test");
      expect(fresh[ids.noSender]).toMatchObject({ senderKey: null, sourceSha256: messageSourceSha256(wires.noSender.toString()) });

      // Legacy state: neither column; sources overwritten, resized or lost.
      f.db.prepare(`UPDATE messages SET senderKey = NULL, sourceSha256 = NULL WHERE accountId = ? AND id != ?`).run(account.id, ids.keyed);
      const replace = async (id: string, from: string, to: string) => {
        const file = getExactMessageSourcePath(account.id, id);
        await writeFile(file, (await readFile(file, "utf8")).replace(from, to));
      };
      await replace(ids.resized, "Synthetic resized", "Synthetic resized and padded");
      await replace(ids.foreignMessageId, "<mid-a@example.test>", "<mid-b@example.test>");
      await replace(ids.foreignSender, "juergen@example.test", "attack1@example.test");
      await unlink(getExactMessageSourcePath(account.id, ids.missing));
      // Deleted on the server; and a row whose UID now holds another message.
      server.store.expunge(server.store.get("INBOX"), message => message.uid === uids.gone);
      f.db.prepare(`UPDATE messages SET imapUid = ? WHERE accountId = ? AND id = ?`).run(uids.keyed, account.id, ids.moved);
      const flags = () => server.store.get("INBOX").messages.map(message => [message.uid, [...message.flags].sort()]);
      const serverFlags = flags();
      const before = snapshot();

      const dryOut = join(outDir, "dry.json");
      const dryStdout = await runScript(["--account", account.id, "--resync", "--out", dryOut]);
      expect(dryStdout).toContain("Dry run (read-only, IMAP check only)");
      expect(dryStdout).toContain("5 on IMAP would be resynced");
      expect(dryStdout).toContain("mailbox refused by the server, 1 rows left unchanged");
      expect(snapshot()).toEqual(before);
      const dry = JSON.parse(await readFile(dryOut, "utf8")) as SenderKeyResyncResult;
      expect(dry.accounts).toEqual([expect.objectContaining({
        accountId: account.id, refused: null, rows: 10, legacy: 9, examined: 9, noImapLocation: 1, mailboxUnavailable: 1,
        gone: 1, uidMismatch: 1, present: 5, presentWithoutSenderKey: 1, changed: 0, resynced: 0, stampedSenderKey: 0
      })]);
      expect(JSON.stringify(dry.accounts)).not.toContain("team@example.test");
      const unfixable = [
        { accountId: account.id, id: ids.gone, outcome: "gone", mailboxPath: "INBOX", imapUid: uids.gone },
        { accountId: account.id, id: ids.moved, outcome: "uid-mismatch", mailboxPath: "INBOX", imapUid: uids.keyed },
        { accountId: account.id, id: local.id, outcome: "no-imap-location", mailboxPath: null, imapUid: null },
        { accountId: account.id, id: lostFolder.id, outcome: "mailbox-unavailable", mailboxPath: "Archiv/Alt", imapUid: 7 }
      ];
      const noSenderKey = { accountId: account.id, id: ids.noSender, outcome: "no-sender-key", mailboxPath: "INBOX", imapUid: uids.noSender };
      expect(dry.reportedRows).toEqual(expect.arrayContaining([...unfixable, noSenderKey]));
      expect(dry.reportedRows).toHaveLength(5);

      const writeOut = join(outDir, "write.json");
      const writeStdout = await runScript(["--account", account.id, "--resync", "--write", "--batch", "3", "--out", writeOut]);
      expect(writeStdout).toContain(`${account.id} batch 3:`);
      const written = JSON.parse(await readFile(writeOut, "utf8")) as SenderKeyResyncResult;
      expect(written.accounts[0]).toMatchObject({ present: 5, presentWithoutSenderKey: 1, changed: 0, resynced: 5, stampedSenderKey: 4 });
      expect(written.reportedRows).toEqual(expect.arrayContaining([...unfixable, noSenderKey]));
      expect(written.reportedRows).toHaveLength(5);

      // Resynced rows equal the fresh sync, sources included; every other row is unchanged.
      const resynced = ["resized", "foreignMessageId", "foreignSender", "missing", "noSender"] as const;
      const after = snapshot();
      expect(after).toEqual({ ...before, ...Object.fromEntries(resynced.map(name => [ids[name], fresh[ids[name]]])) });
      for (const name of resynced) {
        expect(await readFile(getExactMessageSourcePath(account.id, ids[name]), "utf8")).toBe(wires[name].toString());
      }
      // The noSender row keeps senderKey NULL; its digest ends the legacy state.
      expect(after[ids.noSender]).toMatchObject({ senderKey: null, sourceSha256: messageSourceSha256(wires.noSender.toString()) });
      expect((await f.api.getMessageById(account.id, ids.noSender))?.senderKey).toBeNull();
      // Read-only FETCH (PEEK): no flag changed on the server.
      expect(flags()).toEqual(serverFlags);

      // Resumable and idempotent: only the unfixable rows are left, nothing is written.
      const again = await runSenderKeyResync({ dataDir: getDataDir(), account: account.id, write: true });
      expect(again.accounts[0]).toMatchObject({ legacy: 4, examined: 4, present: 0, resynced: 0 });
      expect(again.reportedRows).toEqual(expect.arrayContaining(unfixable));
      expect(again.reportedRows).toHaveLength(4);
      expect(snapshot()).toEqual(after);
    } finally {
      await drainImapConnectionPool();
      await server.stop();
      await rm(outDir, { recursive: true, force: true });
    }
  });
