import { expect, test } from "bun:test";
import { randomUUID } from "crypto";
import { dbModulePromise } from "@/lib/testDbHarness";
import { saveAttachmentData, saveMessageSource } from "@/lib/storage";
import { readStoredAttachmentData, StoredAttachmentTooLargeError } from "./storedAttachmentData";

await dbModulePromise;

const meta = { id: "att-0", filename: "notiz.txt", contentType: "text/plain" };
const source = [
  "From: alice@example.test", "To: owner@example.test", "Subject: Limits", "MIME-Version: 1.0",
  'Content-Type: multipart/mixed; boundary="b1"', "", "--b1", "Content-Type: text/plain", "", "Text", "--b1",
  'Content-Type: text/plain; name="notiz.txt"', 'Content-Disposition: attachment; filename="notiz.txt"',
  "", "Inhalt des Anhangs", "--b1--", ""
].join("\r\n");

test("limits reject an oversized cached attachment before reading it", async () => {
  const accountId = `stored-att-limits-${randomUUID()}`;
  await saveAttachmentData(accountId, "m1", "att-0", Buffer.alloc(64, 0x41));
  const error = await readStoredAttachmentData(accountId, "m1", meta, { maxBytes: 63, maxSourceBytes: 1000 }).catch(caught => caught);
  expect(error).toBeInstanceOf(StoredAttachmentTooLargeError);
  expect(error).toMatchObject({ kind: "attachment", size: 64, cap: 63 });
  expect((await readStoredAttachmentData(accountId, "m1", meta, { maxBytes: 64, maxSourceBytes: 1 }))?.length).toBe(64);
});

test("limits reject an oversized source before parsing and an oversized extracted part", async () => {
  const accountId = `stored-att-limits-${randomUUID()}`;
  await saveMessageSource(accountId, "m1", source);
  await expect(readStoredAttachmentData(accountId, "m1", meta, { maxBytes: 1000, maxSourceBytes: source.length - 1 }))
    .rejects.toMatchObject({ kind: "source", size: source.length, cap: source.length - 1 });
  await expect(readStoredAttachmentData(accountId, "m1", meta, { maxBytes: 5, maxSourceBytes: source.length }))
    .rejects.toMatchObject({ kind: "attachment", cap: 5 });
  // Within the limits the part is extracted (and cached); without limits the behaviour is unchanged.
  expect((await readStoredAttachmentData(accountId, "m1", meta, { maxBytes: 1000, maxSourceBytes: source.length }))?.toString())
    .toBe("Inhalt des Anhangs");
  expect((await readStoredAttachmentData(accountId, "m1", meta))?.toString()).toBe("Inhalt des Anhangs");
});
