import { expect, test } from "bun:test";
import { createHash } from "crypto";
import { readdir } from "fs/promises";
import { createCollabFixture } from "../testThreadCollabHarness";
import { seedLegacySourceCollision } from "../testFixtures/sourceOwnership";
import { getAttachmentData, getMessageSource, listMessageSourceSizes } from "../storage";
import { getAttachmentsAccountDir, getSourcesAccountDir } from "../runtimePaths";
import { ingestCopiedMessages } from "../crossAccountCopy";
import { sanitizeSyncedMessage } from "./syncMessageSanitizer";

for (const path of ["normal ingestion", "copied-message ingestion", "batched ingestion"] as const) {
  test(`${path} publishes collision sources and attachments only under their final row ids`, async () => {
    const f = await createCollabFixture();
    const collision = await seedLegacySourceCollision(f);
    const { base, copy, baseSource, copySource, attachmentId, baseAttachment, copyAttachment } = collision;
    if (path === "copied-message ingestion") {
      await ingestCopiedMessages(f.accountId, [copy], {
        sanitizeSyncedMessage, upsertMessages: f.api.upsertMessages,
        resolveThreadingForAccountMessages: f.api.resolveThreadingForAccountMessages
      });
    } else {
      const batch = path === "batched ingestion"
        ? [...Array.from({ length: 201 }, () => f.message(`<${crypto.randomUUID()}@example.test>`)), copy]
        : [copy];
      const sanitized = await Promise.all(batch.map(message => sanitizeSyncedMessage(message, f.accountId)));
      // Sanitization alone must never modify an existing row's files.
      expect(await getMessageSource(f.accountId, base.id, { exact: true })).toBe(baseSource);
      await f.api.upsertMessages(f.accountId, null, sanitized);
    }
    const row = f.db.prepare("SELECT id, senderKey, sourceSha256 FROM messages WHERE accountId = ? AND imapUid = 2")
      .get(f.accountId) as { id: string; senderKey: string; sourceSha256: string };
    expect(row.id).not.toBe(base.id);
    expect(row.senderKey).toBe("second@example.test");
    expect(row.sourceSha256).toBe(createHash("sha256").update(copySource).digest("hex"));
    expect(await getMessageSource(f.accountId, base.id, { exact: true })).toBe(baseSource);
    expect(await getMessageSource(f.accountId, row.id, { exact: true })).toBe(copySource);
    expect(await getAttachmentData(f.accountId, base.id, attachmentId)).toEqual(baseAttachment);
    expect(await getAttachmentData(f.accountId, row.id, attachmentId)).toEqual(copyAttachment);
    expect((await f.api.getMessageById(f.accountId, base.id))?.senderKey).toBeNull();
    // Re-ingestion is idempotent and keeps both copies independently retrievable.
    await f.api.upsertMessages(f.accountId, null, [await sanitizeSyncedMessage(copy, f.accountId)]);
    expect(await getMessageSource(f.accountId, base.id, { exact: true })).toBe(baseSource);
    expect(await getMessageSource(f.accountId, row.id, { exact: true })).toBe(copySource);
    expect((await listMessageSourceSizes(f.accountId)).size).toBe(2);
    for (const directory of [getSourcesAccountDir(f.accountId), getAttachmentsAccountDir(f.accountId)]) {
      expect((await readdir(directory)).filter(name => name.startsWith(".pending-"))).toEqual([]);
    }
  });
}

test("a failed batch restores existing files and removes new files and ownership markers", async () => {
  const f = await createCollabFixture();
  const [existing] = await f.seed(f.message("<existing@example.test>", {
    source: "From: first@example.test\r\n\r\nSynthetic original"
  }));
  const fresh = f.message("<fresh@example.test>", { source: "From: second@example.test\r\n\r\nSynthetic new" });
  const invalid = f.message("<reject@example.test>", { id: "synthetic-reject" });
  f.db.exec(`CREATE TEMP TRIGGER reject_synthetic_batch BEFORE INSERT ON messages
    WHEN NEW.id = 'synthetic-reject' BEGIN SELECT RAISE(ABORT, 'Synthetic rejection'); END`);
  try {
    await expect(f.seed({ ...existing, source: "From: second@example.test\r\n\r\nSynthetic replacement" }, fresh,
      invalid)).rejects.toThrow("Synthetic rejection");
  } finally {
    f.db.exec("DROP TRIGGER reject_synthetic_batch");
  }
  expect(await getMessageSource(f.accountId, existing.id, { exact: true })).toBe(existing.source!);
  expect(await getMessageSource(f.accountId, fresh.id, { exact: true })).toBeNull();
  expect((await f.api.getMessageById(f.accountId, existing.id))?.senderKey).toBe("first@example.test");
  expect(await f.api.getMessageById(f.accountId, fresh.id)).toBeNull();
  expect((await readdir(getSourcesAccountDir(f.accountId))).filter(name => name.startsWith(".pending-"))).toEqual([]);
});
