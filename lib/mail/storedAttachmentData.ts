import {
  getAttachmentData,
  getMessageSource,
  saveAttachmentData,
  statAttachmentData,
  statMessageSource
} from "@/lib/storage";
import { extractAttachmentBufferFromSource } from "@/lib/mail/attachmentFromSource";

type StoredAttachmentMeta = {
  id: string;
  filename: string;
  contentType: string;
  cid?: string | null;
};

/** Byte caps checked before a file is read into memory. */
export type StoredAttachmentReadLimits = {
  /** Largest attachment (cached file or extracted part) that may be returned. */
  maxBytes: number;
  /** Largest raw message source that may be parsed to extract an uncached attachment. */
  maxSourceBytes: number;
};

/** The attachment, or the raw source it would be extracted from, exceeds a read limit. */
export class StoredAttachmentTooLargeError extends Error {
  constructor(readonly kind: "attachment" | "source", readonly size: number, readonly cap: number) {
    super(`${kind === "attachment" ? "Attachment" : "Message source"} is ${size} bytes; the limit is ${cap} bytes.`);
    this.name = "StoredAttachmentTooLargeError";
  }
}

function assertWithin(kind: "attachment" | "source", size: number | undefined, cap: number | undefined) {
  if (cap !== undefined && size !== undefined && size > cap) throw new StoredAttachmentTooLargeError(kind, size, cap);
}

/**
 * Bytes of a stored attachment: the cached attachment file, else extracted from
 * the cached raw source (and cached for the next read). Null when neither is
 * available locally. With `limits`, sizes are checked on disk before anything is
 * read, and an over-limit file throws StoredAttachmentTooLargeError.
 */
export async function readStoredAttachmentData(
  accountId: string,
  messageId: string,
  attachment: StoredAttachmentMeta,
  limits?: StoredAttachmentReadLimits
) {
  if (limits) assertWithin("attachment", (await statAttachmentData(accountId, messageId, attachment.id))?.size, limits.maxBytes);
  const cached = await getAttachmentData(accountId, messageId, attachment.id);
  if (cached) {
    assertWithin("attachment", cached.length, limits?.maxBytes);
    return cached;
  }
  if (limits) assertWithin("source", (await statMessageSource(accountId, messageId))?.size, limits.maxSourceBytes);
  const source = await getMessageSource(accountId, messageId);
  if (!source) return null;
  let data: Buffer<ArrayBuffer>;
  try {
    const extracted = await extractAttachmentBufferFromSource(source, {
      id: attachment.id,
      filename: attachment.filename,
      contentType: attachment.contentType,
      cid: attachment.cid ?? undefined
    });
    if (!extracted) return null;
    data = Buffer.from(extracted);
  } catch {
    return null;
  }
  assertWithin("attachment", data.length, limits?.maxBytes);
  try {
    await saveAttachmentData(accountId, messageId, attachment.id, data);
  } catch {
    return null;
  }
  return data;
}
