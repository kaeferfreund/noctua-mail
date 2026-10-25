import { getAttachmentData, getMessageSource, saveAttachmentData } from "@/lib/storage";
import { extractAttachmentBufferFromSource } from "@/lib/mail/attachmentFromSource";

type StoredAttachmentMeta = {
  id: string;
  filename: string;
  contentType: string;
  cid?: string | null;
};

/**
 * Bytes of a stored attachment: the cached attachment file, else extracted from
 * the cached raw source (and cached for the next read). Null when neither is
 * available locally.
 */
export async function readStoredAttachmentData(accountId: string, messageId: string, attachment: StoredAttachmentMeta) {
  const cached = await getAttachmentData(accountId, messageId, attachment.id);
  if (cached) return cached;
  const source = await getMessageSource(accountId, messageId);
  if (!source) return null;
  try {
    const extracted = await extractAttachmentBufferFromSource(source, {
      id: attachment.id,
      filename: attachment.filename,
      contentType: attachment.contentType,
      cid: attachment.cid ?? undefined
    });
    if (!extracted) return null;
    const data = Buffer.from(extracted);
    await saveAttachmentData(accountId, messageId, attachment.id, data);
    return data;
  } catch {
    return null;
  }
}
