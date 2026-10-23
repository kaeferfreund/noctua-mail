import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { createHash } from "crypto";
import { getMessageSource } from "../storage";
import { seedLegacySourceCollision } from "../testFixtures/sourceOwnership";
import { expect, test } from "bun:test";
import { createCollabFixture } from "../testThreadCollabHarness";
import { buildImapMessageRowId } from "../messageIds";
import { buildFolderId } from "./imap/_shared";
import { drainImapConnectionPool } from "./imap/connectionPool";
import { resyncImapMessageIntoDb } from "./resyncMessage";
import { startImapServer } from "../../scripts/dev-fixture/imap-server";

// Pool unit tests intentionally mock connectImapClient across Bun's module graph.
// Real protocol fixtures need a fresh graph, as the collaboration send tests do.
// Keep the original cases/assertions and the CI 20-second budget in each child.
// The named pass marker comes from the child's JUnit report: Bun omits "(pass)"
// lines from stdout when it detects an AI agent (CLAUDECODE=1, AGENT=1, ...).
const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const escapeXml = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;")
  .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

function realResyncTest(name: string, run: () => Promise<void>) {
  if (process.env.NOCTUA_REAL_RESYNC_SENDER_KEY === "1") {
    test(name, run);
    return;
  }
  test(name, async () => {
    const pattern = "^" + escapeRegExp(name) + "$";
    const reportDir = await mkdtemp(join(tmpdir(), "resync-sender-key-"));
    try {
      const report = join(reportDir, "junit.xml");
      const { stdout, stderr } = await promisify(execFile)(process.execPath, [
        "test", "--timeout", "20000", "--test-name-pattern", pattern,
        "--reporter=junit", `--reporter-outfile=${report}`, fileURLToPath(import.meta.url)
      ], { cwd: process.cwd(), env: { ...process.env, NOCTUA_REAL_RESYNC_SENDER_KEY: "1" },
        timeout: 20_000, maxBuffer: 10 * 1024 * 1024 });
      const output = stdout + stderr;
      // A self-closing <testcase .../> carries no <failure> or <skipped> child.
      expect(await readFile(report, "utf8"))
        .toMatch(new RegExp(`<testcase name="${escapeRegExp(escapeXml(name))}"[^>]*/>`));
      expect(output).toContain("0 fail");
    } finally {
      await rm(reportDir, { recursive: true, force: true });
    }
  }, 20_000);
}

realResyncTest("real IMAP resync replaces an unkeyed legacy row with the parsed sender key", async () => {
  const f = await createCollabFixture();
  const server = await startImapServer({ port: 0, user: "team@example.test", pass: "synthetic" });
  try {
    const account = { ...f.account, imap: { ...f.account.imap, host: "127.0.0.1", port: server.port, secure: false } };
    const folderId = buildFolderId(account.id, "INBOX");
    await f.api.saveFoldersForAccount(account.id, [{ id: folderId, accountId: account.id, name: "INBOX", count: 0, unreadCount: 0 }]);
    const messageId = "<sender-key-resync@example.test>";
    const wire = server.store.append("INBOX", Buffer.from(
      `From: tést@example.test\r\nTo: team@example.test\r\nMessage-ID: ${messageId}\r\nContent-Type: text/html; charset=utf-8\r\n\r\n<p>Synthetic resync</p>`));
    const legacy = f.message(messageId, {
      id: buildImapMessageRowId(messageId), folderId, mailboxPath: "INBOX", imapUid: wire.uid,
      from: "attacker:trusted@example.test", senderKey: null
    });
    await f.api.upsertMessages(account.id, null, [legacy]);
    const refreshed = await resyncImapMessageIntoDb(account, legacy, wire.uid);
    expect(refreshed?.senderKey).toBe("tést@example.test");
    expect(f.db.prepare("SELECT sourceSha256 FROM messages WHERE accountId = ? AND id = ?").get(account.id, legacy.id))
      .toEqual({ sourceSha256: createHash("sha256").update((await getMessageSource(account.id, legacy.id, { exact: true }))!).digest("hex") });
    expect(refreshed?.from).toBe("tést@example.test");
    expect((await f.api.getMessageById(account.id, legacy.id))?.senderKey).toBe("tést@example.test");
  } finally {
    await drainImapConnectionPool();
    await server.stop();
  }
});

realResyncTest("collision-variant resync preserves the base source and refreshes only the variant's ownership and sender", async () => {
  const f = await createCollabFixture();
  const { base, baseSource, copy, copySource } = await seedLegacySourceCollision(f);
  // Model a previously indexed collision variant with an unowned legacy cache.
  const variant = { ...copy, id: `${base.id}-0123456789ab`, source: undefined, senderKey: null, attachments: [] };
  await f.api.upsertMessages(f.accountId, null, [variant]);
  const server = await startImapServer({ port: 0, user: "team@example.test", pass: "synthetic" });
  try {
    const account = { ...f.account, imap: { ...f.account.imap, host: "127.0.0.1", port: server.port, secure: false } };
    server.store.append("Archive", Buffer.from("From: unused@example.test\r\n\r\nSynthetic"));
    const wire = server.store.append("Archive", Buffer.from(copySource));
    const refreshed = await resyncImapMessageIntoDb(account, variant, wire.uid);
    expect(refreshed?.id).toBe(variant.id);
    expect(refreshed?.senderKey).toBe("second@example.test");
    expect(await getMessageSource(account.id, base.id, { exact: true })).toBe(baseSource);
    expect(await getMessageSource(account.id, variant.id, { exact: true })).toBe(copySource);
    expect((await f.api.getMessageById(account.id, base.id))?.senderKey).toBeNull();
    const ownership = f.db.prepare("SELECT sourceSha256 FROM messages WHERE accountId = ? AND id = ?")
      .get(account.id, variant.id) as { sourceSha256: string };
    expect(ownership.sourceSha256).toBe(createHash("sha256").update(copySource).digest("hex"));
  } finally {
    await drainImapConnectionPool();
    await server.stop();
  }
});
