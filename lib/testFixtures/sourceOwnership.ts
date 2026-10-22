import type { ImapFlow } from "imapflow";
import type { createCollabFixture } from "../testThreadCollabHarness";
import { buildImapMessageRowId } from "../messageIds";
import { parseImapMessage } from "../mail/imap/sync";
import { saveAttachmentData, saveMessageSource } from "../storage";

/** Synthetic round-6 reproduction: the unkeyed base cache predates ownership tracking. */
export async function seedLegacySourceCollision(
  f: Awaited<ReturnType<typeof createCollabFixture>>,
  html = "<p>Synthetic collision</p>"
) {
  const messageId = "<collision@example.test>";
  const baseId = buildImapMessageRowId(messageId);
  const source = (from: string) => `From: ${from}\r\nTo: team@example.test\r\nMessage-ID: ${messageId}\r\nContent-Type: text/html; charset=utf-8\r\n\r\n${html}`;
  const baseSource = source('"first:second"@example.test');
  const copySource = source("second@example.test");
  const attachmentId = `att-${crypto.randomUUID()}`;
  const baseAttachment = Buffer.from("Synthetic original attachment");
  const copyAttachment = Buffer.from("Synthetic copied attachment");
  const base = f.message(messageId, {
    id: baseId, from: "first:second@example.test", senderKey: null,
    mailboxPath: "INBOX", imapUid: 1, htmlBody: html, hasSource: true,
    attachments: [{ id: attachmentId, filename: "synthetic.txt", contentType: "text/plain", inline: false, size: baseAttachment.length }]
  });
  await f.seed(base);
  await saveMessageSource(f.accountId, base.id, baseSource);
  await saveAttachmentData(f.accountId, base.id, attachmentId, baseAttachment);
  const copy = await parseImapMessage(f.account, "Archive", {
    uid: 2, source: Buffer.from(copySource)
  }, {} as ImapFlow);
  const copiedAttachment = {
    id: attachmentId, filename: "synthetic.txt", contentType: "text/plain",
    inline: false, size: copyAttachment.length, content: copyAttachment
  };
  copy.attachments = [copiedAttachment];
  return { base, baseSource, copy, copySource, attachmentId, baseAttachment, copyAttachment };
}
