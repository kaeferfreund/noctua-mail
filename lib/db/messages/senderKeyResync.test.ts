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
import { getAttachmentData, getExactMessageSourcePath, messageSourceSha256, saveAttachmentData } from "../../storage";
import type { Account } from "../../data";
import { inspectStoredMailboxCopies, syncImapMessage } from "../../mail/imap";
import { buildFolderId } from "../../mail/imap/_shared";
import { drainImapConnectionPool } from "../../mail/imap/connectionPool";
import { resyncMessageDeps } from "../../mail/resyncMessage";
import { sanitizeSyncedMessage } from "../../mail/syncMessageSanitizer";
import { runSenderKeyResync, type SenderKeyResyncResult } from "../../mail/senderKeyResync";
import { startImapServer } from "../../../scripts/dev-fixture/imap-server";

const script = fileURLToPath(new URL("../../../scripts/backfill-sender-keys.ts", import.meta.url));

async function runScript(args: string[]) {
  const { stdout } = await promisify(execFile)(process.execPath, [script, "--data", getDataDir(), ...args],
    { cwd: process.cwd(), env: process.env, timeout: 15_000 });
  return stdout;
}

const wire = (messageId: string | null, fromHeader: string, subject: string) => Buffer.from(
  `${fromHeader}\r\nTo: team@example.test\r\nSubject: ${subject}\r\nDate: Thu, 01 Oct 2026 08:00:00 +0000\r\n`
  + `${messageId ? `Message-ID: ${messageId}\r\n` : ""}Content-Type: text/html; charset=utf-8\r\n\r\n<p>Synthetic ${subject}</p>\r\n`);

type Fixture = Awaited<ReturnType<typeof createCollabFixture>>;

/** Appends each wire to `mailbox` and ingests it like the regular sync. */
async function syncWires<Name extends string>(f: Fixture, server: Awaited<ReturnType<typeof startImapServer>>,
  account: Account, mailbox: string, wires: Record<Name, Buffer>) {
  const ids = {} as Record<Name, string>;
  const uids = {} as Record<Name, number>;
  for (const [name, bytes] of Object.entries(wires) as Array<[Name, Buffer]>) {
    const { uid } = server.store.append(mailbox, bytes);
    const message = await syncImapMessage(account, mailbox, uid);
    if (!message) throw new Error(`fixture message ${name} not fetched`);
    await f.api.upsertMessages(account.id, message.folderId, [await sanitizeSyncedMessage(message, account.id)]);
    ids[name] = message.id;
    uids[name] = uid;
  }
  return { ids, uids };
}

/** What the regular sync stores per folder; the resync only trusts UIDs under it. */
function storeUidValidity(f: Fixture, mailbox: string, uidValidity: string) {
  f.db.prepare(`INSERT OR REPLACE INTO mailbox_state (folderId, accountId, mailboxPath, uidValidity) VALUES (?, ?, ?, ?)`)
    .run(buildFolderId(f.account.id, mailbox), f.account.id, mailbox, uidValidity);
}

const snapshotRows = (f: Fixture) => Object.fromEntries((f.db.prepare(`SELECT * FROM messages WHERE accountId = ? ORDER BY id`)
  .all(f.account.id) as Array<Record<string, unknown>>).map(row => [row.id as string, row]));

isolatedImapTest(import.meta.url, "NOCTUA_REAL_SENDER_KEY_RESYNC",
  "resync re-fetches legacy rows from IMAP like a fresh sync, reports gone and foreign UIDs and is idempotent", async () => {
    const commands: string[][] = [];
    const server = await startImapServer({ port: 0, user: "team@example.test", pass: "synthetic",
      onCommand: (command, args) => commands.push([command, ...args]) });
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
        keyed: wire("<keyed@example.test>", "From: Plain Sender <plain@example.test>", "keyed"),
        // Without Message-ID the stored id is the UID fallback: nothing ties the row to the server message.
        noIdOld: wire(null, "From: Plain Sender <plain@example.test>", "no id old"),
        noIdNew: wire(null, "From: Plain Sender <plain@example.test>", "no id new")
      };
      const { ids, uids } = await syncWires(f, server, account, "INBOX", wires);
      // A folder the regular sync never recorded a UIDVALIDITY for.
      server.store.create("Akten");
      const unrecorded = await syncWires(f, server, account, "Akten",
        { project: wire("<project@example.test>", "From: Plain Sender <plain@example.test>", "project") });
      storeUidValidity(f, "INBOX", String(server.store.get("INBOX").uidValidity));
      storeUidValidity(f, "Archiv/Alt", "1");
      const [local, lostFolder] = await f.seed(
        f.message("<local-only@example.test>", { senderKey: null }),
        f.message("<lost-folder@example.test>", { senderKey: null, mailboxPath: "Archiv/Alt", imapUid: 7 })
      );
      const snapshot = () => snapshotRows(f);
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
      // The old message without Message-ID is gone and its UID reused by the new one.
      server.store.expunge(server.store.get("INBOX"), message => message.uid === uids.noIdOld);
      f.db.prepare(`UPDATE messages SET imapUid = ?, messageId = ? WHERE accountId = ? AND id = ?`)
        .run(uids.noIdNew, `imap-msg-${uids.noIdNew}`, account.id, ids.noIdOld);
      const flags = () => server.store.get("INBOX").messages.map(message => [message.uid, [...message.flags].sort()]);
      const serverFlags = flags();
      const before = snapshot();
      commands.length = 0;

      const dryOut = join(outDir, "dry.json");
      const dryStdout = await runScript(["--account", account.id, "--resync", "--out", dryOut]);
      expect(dryStdout).toContain("Dry run (read-only, IMAP check only)");
      expect(dryStdout).toContain("5 on IMAP would be resynced");
      expect(dryStdout).toContain("mailbox refused by the server, 1 rows left unchanged");
      expect(snapshot()).toEqual(before);
      const dry = JSON.parse(await readFile(dryOut, "utf8")) as SenderKeyResyncResult;
      expect(dry.accounts).toEqual([expect.objectContaining({
        accountId: account.id, refused: null, rows: 13, legacy: 12, examined: 12, noImapLocation: 1, noMessageId: 2,
        uidValidityChanged: 1, mailboxUnavailable: 1, gone: 1, uidMismatch: 1, present: 5, presentWithoutSenderKey: 1,
        changed: 0, resynced: 0, stampedSenderKey: 0
      })]);
      expect(JSON.stringify(dry.accounts)).not.toContain("team@example.test");
      const unfixable = [
        { accountId: account.id, id: ids.gone, outcome: "gone", mailboxPath: "INBOX", imapUid: uids.gone },
        { accountId: account.id, id: ids.moved, outcome: "uid-mismatch", mailboxPath: "INBOX", imapUid: uids.keyed },
        { accountId: account.id, id: local.id, outcome: "no-imap-location", mailboxPath: null, imapUid: null },
        { accountId: account.id, id: lostFolder.id, outcome: "mailbox-unavailable", mailboxPath: "Archiv/Alt", imapUid: 7 },
        { accountId: account.id, id: ids.noIdOld, outcome: "no-message-id", mailboxPath: "INBOX", imapUid: uids.noIdNew },
        { accountId: account.id, id: ids.noIdNew, outcome: "no-message-id", mailboxPath: "INBOX", imapUid: uids.noIdNew },
        { accountId: account.id, id: unrecorded.ids.project, outcome: "uidvalidity-changed", mailboxPath: "Akten",
          imapUid: unrecorded.uids.project }
      ];
      const noSenderKey = { accountId: account.id, id: ids.noSender, outcome: "no-sender-key", mailboxPath: "INBOX", imapUid: uids.noSender };
      expect(dry.reportedRows).toEqual(expect.arrayContaining([...unfixable, noSenderKey]));
      expect(dry.reportedRows).toHaveLength(8);

      const writeOut = join(outDir, "write.json");
      const writeStdout = await runScript(["--account", account.id, "--resync", "--write", "--batch", "3", "--out", writeOut]);
      expect(writeStdout).toContain(`${account.id} batch 3:`);
      const written = JSON.parse(await readFile(writeOut, "utf8")) as SenderKeyResyncResult;
      expect(written.accounts[0]).toMatchObject({ present: 5, presentWithoutSenderKey: 1, changed: 0, resynced: 5, stampedSenderKey: 4 });
      expect(written.reportedRows).toEqual(expect.arrayContaining([...unfixable, noSenderKey]));
      expect(written.reportedRows).toHaveLength(8);

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
      // Read-only FETCH (PEEK) in mailboxes opened with EXAMINE: no flag changed on the server.
      expect(flags()).toEqual(serverFlags);
      expect(commands.filter(([command]) => command === "SELECT" || command === "STORE")).toEqual([]);
      expect(commands.filter(([command]) => command === "EXAMINE").map(([, mailbox]) => mailbox))
        .toEqual(expect.arrayContaining(["INBOX", "Archiv/Alt"]));

      // Resumable and idempotent: only the unfixable rows are left, nothing is written.
      const again = await runSenderKeyResync({ dataDir: getDataDir(), account: account.id, write: true });
      expect(again.accounts[0]).toMatchObject({ legacy: 7, examined: 7, present: 0, resynced: 0 });
      expect(again.reportedRows).toEqual(expect.arrayContaining(unfixable));
      expect(again.reportedRows).toHaveLength(7);
      expect(snapshot()).toEqual(after);
    } finally {
      await drainImapConnectionPool();
      await server.stop();
      await rm(outDir, { recursive: true, force: true });
    }
  });

isolatedImapTest(import.meta.url, "NOCTUA_REAL_SENDER_KEY_RESYNC",
  "resync writes nothing when UIDVALIDITY, the UID or the row changes between the check and the write", async () => {
    const server = await startImapServer({ port: 0, user: "team@example.test", pass: "synthetic" });
    const f = await createCollabFixture({
      imap: { host: "127.0.0.1", port: server.port, secure: false, user: "team@example.test", password: "synthetic" }
    });
    try {
      const { account } = f;
      const plain = "From: Plain Sender <plain@example.test>";
      const withAttachment = Buffer.from(`${plain}\r\nTo: team@example.test\r\nSubject: raced\r\n`
        + `Message-ID: <raced@example.test>\r\nMIME-Version: 1.0\r\nContent-Type: multipart/mixed; boundary="b"\r\n\r\n`
        + `--b\r\nContent-Type: text/plain\r\n\r\nSynthetic raced\r\n--b\r\nContent-Type: text/plain; name="note.txt"\r\n`
        + `Content-Disposition: attachment; filename="note.txt"\r\nContent-Transfer-Encoding: base64\r\n\r\n`
        + `${Buffer.from("synthetic attachment").toString("base64")}\r\n--b--\r\n`);
      const inbox = await syncWires(f, server, account, "INBOX", {
        raced: withAttachment,
        vanished: wire("<vanished@example.test>", plain, "vanished"),
        kept: wire("<kept@example.test>", plain, "kept")
      });
      server.store.create("Neu");
      server.store.create("Ablage");
      const renumbered = await syncWires(f, server, account, "Neu", {
        first: wire("<renumbered-1@example.test>", plain, "renumbered 1"),
        second: wire("<renumbered-2@example.test>", plain, "renumbered 2")
      });
      const stale = await syncWires(f, server, account, "Ablage", { stale: wire("<stale@example.test>", plain, "stale") });
      storeUidValidity(f, "INBOX", String(server.store.get("INBOX").uidValidity));
      storeUidValidity(f, "Neu", String(server.store.get("Neu").uidValidity));
      storeUidValidity(f, "Ablage", String(server.store.get("Ablage").uidValidity + 1000));
      const fresh = snapshotRows(f);
      const [attachmentId] = await f.api.getAttachmentIds(account.id, inbox.ids.raced);
      expect(attachmentId).toBeTruthy();
      // The blob cache a download leaves behind.
      await saveAttachmentData(account.id, inbox.ids.raced, attachmentId, Buffer.from("synthetic attachment"));

      f.db.prepare(`UPDATE messages SET senderKey = NULL, sourceSha256 = NULL WHERE accountId = ?`).run(account.id);
      const racedSource = getExactMessageSourcePath(account.id, inbox.ids.raced);
      await writeFile(racedSource, (await readFile(racedSource, "utf8")).replace("Synthetic raced", "Synthetic legacy"));
      const legacySource = await readFile(racedSource, "utf8");
      const before = snapshotRows(f);

      const result = await runSenderKeyResync({ dataDir: getDataDir(), account: account.id, write: true, deps: {
        // Between the read-only check and the fetch: the UID is expunged, the folder renumbered.
        inspectStoredMailboxCopies: async (...args) => {
          const states = await inspectStoredMailboxCopies(...args);
          if (args[1] === "INBOX") server.store.expunge(server.store.get("INBOX"), message => message.uid === inbox.uids.vanished);
          if (args[1] === "Neu") server.store.get("Neu").uidValidity += 1;
          return states;
        },
        resyncMessage: { ...resyncMessageDeps, syncImapMessage: async (...args) => {
          const message = await resyncMessageDeps.syncImapMessage(...args);
          // After the fetch, before the write: a concurrent sync stamps the row.
          if (args[1] === "INBOX" && args[2] === inbox.uids.raced) {
            f.db.prepare(`UPDATE messages SET sourceSha256 = 'concurrent' WHERE accountId = ? AND id = ?`).run(account.id, inbox.ids.raced);
          }
          return message;
        } }
      } });
      expect(result.accounts[0]).toMatchObject({ legacy: 6, examined: 6, uidValidityChanged: 3, present: 5, gone: 1, changed: 1,
        resynced: 1, stampedSenderKey: 1 });
      const row = (id: string, outcome: string, mailboxPath: string, imapUid: number) =>
        ({ accountId: account.id, id, outcome, mailboxPath, imapUid });
      expect(result.reportedRows).toEqual(expect.arrayContaining([
        row(inbox.ids.raced, "changed", "INBOX", inbox.uids.raced),
        row(inbox.ids.vanished, "gone", "INBOX", inbox.uids.vanished),
        row(renumbered.ids.first, "uidvalidity-changed", "Neu", renumbered.uids.first),
        row(renumbered.ids.second, "uidvalidity-changed", "Neu", renumbered.uids.second),
        row(stale.ids.stale, "uidvalidity-changed", "Ablage", stale.uids.stale)
      ]));
      expect(result.reportedRows).toHaveLength(5);

      // Only the untouched row was resynced; the raced row keeps the concurrent write, its source and attachment.
      expect(snapshotRows(f)).toEqual({ ...before, [inbox.ids.kept]: fresh[inbox.ids.kept],
        [inbox.ids.raced]: { ...before[inbox.ids.raced], sourceSha256: "concurrent" } });
      expect(await readFile(racedSource, "utf8")).toBe(legacySource);
      expect(await getAttachmentData(account.id, inbox.ids.raced, attachmentId)).not.toBeNull();
    } finally {
      await drainImapConnectionPool();
      await server.stop();
    }
  });
