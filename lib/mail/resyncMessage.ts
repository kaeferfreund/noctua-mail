// Re-fetch a single message from IMAP and re-ingest it into the local shard,
// replacing the stored row (attachments, htmlBody, imapUid, source) with a fresh
// parse. Used by the resync route and by attachment removal — after removal
// rewrites the message on the server its UID changes, and attachment ids are
// UID-derived, so the row must be re-parsed to pick up the new ids.
import type { Database } from "bun:sqlite";
import type { Account, Message } from "@/lib/data";
import {
  getAttachmentIds,
  getMessageById,
  resolveThreadingForAccountMessages,
  updateMessageImapUid,
  upsertMessages,
  UpsertPreconditionError
} from "@/lib/db";
import { ImapUidValidityChangedError, syncImapMessage } from "@/lib/mail/imap";
import { mergeLocalOnlyMessageState } from "@/lib/messageLocalState";
import { getAttachmentContentBuffer, sanitizeSyncedMessage } from "@/lib/mail/syncMessageSanitizer";
import { deleteAttachmentData } from "@/lib/storage";

type ExistingMessage = Message & { mailboxPath?: string | null };
export const resyncMessageDeps = { getAttachmentIds, getMessageById, resolveThreadingForAccountMessages,
  updateMessageImapUid, upsertMessages, syncImapMessage, sanitizeSyncedMessage, deleteAttachmentData };
export type ResyncMessageDeps = typeof resyncMessageDeps;

/** Conditions a guarded resync checks before it writes anything. */
export type ResyncGuard = {
  /** Open the mailbox with EXAMINE instead of SELECT. */
  readOnly?: boolean;
  /** UIDVALIDITY the UID was verified under; the fetch is refused under another one. */
  uidValidity?: string;
  /** Message-ID the fetched message must resolve to (header value, not the UID fallback). */
  messageId?: string;
  /** Re-checked on the shard inside the upsert's write transaction; false writes nothing. */
  stillCurrent?: (db: Database) => boolean;
};

export type GuardedResyncResult =
  | { outcome: "resynced"; message: Message | null }
  /** No mailbox path, or the UID is no longer on the server. */
  | { outcome: "gone" }
  | { outcome: "uidvalidity-changed" }
  /** The UID now holds a message with another Message-ID. */
  | { outcome: "message-id-mismatch" }
  /** `stillCurrent` failed inside the write transaction. */
  | { outcome: "changed" };

/**
 * Fetches `uid` from `mailboxPath`, re-ingests it onto `existing`'s row, and
 * returns the freshly hydrated message. Returns null when the UID is no longer
 * on the server. Attachment blobs the re-parse no longer writes are dropped
 * after the upsert, so re-id'd attachments don't leak stale cache files.
 */
export async function resyncImapMessageIntoDb(
  account: Account,
  existing: ExistingMessage,
  uid: number,
  clientId?: string,
  deps: ResyncMessageDeps = resyncMessageDeps
): Promise<Message | null> {
  const result = await resyncImapMessageGuarded(account, existing, uid, {}, clientId, deps);
  return result.outcome === "resynced" ? result.message : null;
}

/**
 * `resyncImapMessageIntoDb` with the checks of `guard`: nothing is written
 * unless the mailbox still has the expected UIDVALIDITY, the fetched message
 * the expected Message-ID and `stillCurrent` holds inside the write.
 */
export async function resyncImapMessageGuarded(
  account: Account,
  existing: ExistingMessage,
  uid: number,
  guard: ResyncGuard,
  clientId?: string,
  deps: ResyncMessageDeps = resyncMessageDeps
): Promise<GuardedResyncResult> {
  const { getAttachmentIds, getMessageById, resolveThreadingForAccountMessages,
    updateMessageImapUid, upsertMessages, syncImapMessage, sanitizeSyncedMessage, deleteAttachmentData } = deps;
  const mailboxPath = existing.mailboxPath?.trim();
  if (!mailboxPath) return { outcome: "gone" };

  let message: Message | null;
  try {
    message = await syncImapMessage(account, mailboxPath, uid, clientId,
      { readOnly: guard.readOnly, uidValidity: guard.uidValidity });
  } catch (error) {
    if (error instanceof ImapUidValidityChangedError) return { outcome: "uidvalidity-changed" };
    throw error;
  }
  if (!message) return { outcome: "gone" };
  if (guard.messageId !== undefined && message.messageId !== guard.messageId) return { outcome: "message-id-mismatch" };

  // Align the stored row to `uid` first. Otherwise a re-sync of a
  // server-rewritten copy (same Message-ID, new UID) is treated by the upsert
  // as a distinct second copy and written to a collision-variant row, leaving
  // this row — and its stale attachment ids — untouched. Skipped when
  // re-syncing the row's own UID (the manual re-sync path).
  if (existing.imapUid !== uid) await updateMessageImapUid(account.id, existing.id, uid);

  const attachmentIds = await getAttachmentIds(account.id, existing.id);

  const [resolved] = await resolveThreadingForAccountMessages(account.id, [message]);
  const sanitized = await sanitizeSyncedMessage(
    { ...message, id: existing.id, threadId: resolved.threadId, parentId: resolved.parentId },
    account.id
  );
  const merged = mergeLocalOnlyMessageState(sanitized, existing);
  let stored: Awaited<ReturnType<typeof upsertMessages>>;
  try {
    stored = await upsertMessages(account.id, message.folderId, [merged], false, { precondition: guard.stillCurrent });
  } catch (error) {
    if (error instanceof UpsertPreconditionError) return { outcome: "changed" };
    throw error;
  }

  // The upsert committed and replaced this row's blobs it had bytes for; drop the rest.
  const written = new Set(stored.messageRowIds.get(merged.id) === existing.id
    ? (merged.attachments ?? []).filter((attachment) => getAttachmentContentBuffer(attachment)).map((attachment) => attachment.id)
    : []);
  await Promise.all(attachmentIds
    .filter((attachmentId) => !written.has(attachmentId))
    .map((attachmentId) => deleteAttachmentData(account.id, existing.id, attachmentId)));

  return { outcome: "resynced", message: await getMessageById(account.id, existing.id) };
}
