import { parseAddressEmails } from "../../ownAddresses";
/**
 * The single write path that takes a batch of parsed RFC 5322 messages
 * and installs them into the local SQLite store. The function is large
 * because it maintains several invariants atomically:
 *
 *   - **Row identity under mailbox collision.** When the same Message-Id
 *     appears in two different mailboxes, a deterministic variant id
 *     (`buildMessageCollisionVariantId`) is minted so both copies can
 *     coexist. The incoming (colliding) row is assigned the variant id;
 *     the pre-existing row keeps its base id and its on-disk
 *     source/attachment files untouched.
 *   - **Same-mailbox duplicate purge.** If a message arrives with a
 *     Message-Id that already exists in the same folder but under a
 *     different row id (sync delta, for example), the older row plus
 *     its attachment / FTS / calendar-event siblings are deleted.
 *   - **Flag reconciliation.** Raw IMAP flags are normalized and
 *     preserved alongside any local-only flags the user has added. The
 *     JSON `flags` column and the system-flag bitset are projected from
 *     the same normalized list.
 *   - **Manual category preservation.** Rows that the user explicitly
 *     marked "cleared" stay cleared across re-upserts even if the
 *     incoming message carries an automatic classification.
 *   - **Calendar-invite state preservation.** When a message is
 *     re-upserted, its existing `message_calendar_events` entries for
 *     the same event UIDs are re-emitted with their prior processed
 *     state so invite bookkeeping (processedAtMs, processedByUserId,
 *     processedAutomatically) survives.
 *   - **Thread signal + topic learning recompute.** After the batch
 *     lands, the affected threads have their signals rebuilt and topic
 *     learning state refreshed. `replaceExisting` + account-scoped
 *     writes escalate to a full-account recompute.
 */
import { publishThreadCollabEvent } from "../../threadCollabEvents";
import { SHARD_FTS_TABLE } from "../shardFormat";
import type { Message } from "../../data";
import { stageMessageFiles } from "../../storage";
import { getAttachmentContentBuffer } from "../../mail/syncMessageSanitizer";
import { remapThreadCollab, type ThreadRemapPair } from "../threadCollab";
import { createHash } from "crypto";
import { withDbWriteRetry } from "../../dbWriteRetry";
import { normalizeImapFlags, preserveLocalOnlyMessageFlags } from "../../messageFlags";
import {
  normalizeCalendarEventUid,
  normalizeCalendarEventUidKey,
  normalizeCalendarEventUids
} from "../../calendarEventUids";
import { isSameMailboxMessageCopy } from "../../messageCopies";
import { getAccountDb } from "../connection";
import {
  pruneThreadTopicsWithoutMessages,
  rebuildAllThreadSignalsForAccount,
  rebuildThreadSignalsForThreadIds,
  recomputeThreadsForAccountInternal
} from "../threads";
import { upsertTopicLearningSignalsForThreadIds } from "../topics";
import {
  type CategoryManualState,
  deriveSystemFlagState,
  normalizeCategory,
  safeParseJson
} from "./_shared";

/**
 * Derives a deterministic variant id for a message that collides with
 * an existing row from a different mailbox. The suffix hashes mailbox
 * path + UID so the same (message, mailbox, uid) triple always yields
 * the same variant, which keeps attachment file paths stable across
 * re-upserts.
 */
function buildMessageCollisionVariantId(
  baseId: string,
  mailboxPath?: string | null,
  imapUid?: number | null
) {
  const normalizedMailboxPath = (mailboxPath ?? "").trim().toLowerCase();
  const normalizedUid =
    typeof imapUid === "number" && Number.isFinite(imapUid) ? String(imapUid) : "";
  const suffix = createHash("sha1")
    .update(`${baseId}|${normalizedMailboxPath}|${normalizedUid}`)
    .digest("hex")
    .slice(0, 12);
  return `${baseId}-${suffix}`;
}

/** Narrows a stored `categoryManualState` value to the known union. */
function normalizeCategoryManualState(value?: string | null): CategoryManualState | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === "cleared") return "cleared";
  return null;
}

export async function upsertMessages(
  accountId: string,
  folderId: string | null,
  nextMessages: Message[],
  replaceExisting = false,
  options: { recomputeThreads?: boolean } = {}
) {
  return withDbWriteRetry("upsertMessages", async () => {
    const shouldRecomputeThreads = options.recomputeThreads ?? true;
    if (nextMessages.some(message => message.accountId !== accountId)) {
      throw new Error("Message accountId must match the destination account; message belongs to another account");
    }
    // Expose the final storage identity to callers that persist source/attachment files.
    const messageRowIds = new Map<string, string>();
    const UPSERT_BATCH_SIZE = 200;
    const db = await getAccountDb(accountId);
    const deleteSql = folderId
      ? `DELETE FROM messages WHERE accountId = ? AND folderId = ?`
      : `DELETE FROM messages WHERE accountId = ?`;
    const deleteArgs = folderId ? [accountId, folderId] : [accountId];
    const deleteAttachmentsByScope = folderId
      ? db.prepare(
          `DELETE FROM attachments WHERE EXISTS (SELECT 1 FROM messages m WHERE m.accountId = attachments.accountId AND m.id = attachments.messageId AND m.accountId = ? AND m.folderId = ?)`
        )
      : db.prepare(
          `DELETE FROM attachments WHERE accountId = ?`
        );
    const deleteCalendarEventsByScope = folderId
      ? db.prepare(
          `DELETE FROM message_calendar_events
           WHERE accountId = ?
             AND messageId IN (SELECT id FROM messages WHERE accountId = ? AND folderId = ?)`
        )
      : db.prepare(`DELETE FROM message_calendar_events WHERE accountId = ?`);
    const deleteAttachmentsForMessage = db.prepare(
      `DELETE FROM attachments WHERE accountId = ? AND messageId = ?`
    );
    const deleteCalendarEventsForMessage = db.prepare(
      `DELETE FROM message_calendar_events WHERE accountId = ? AND messageId = ?`
    );
    const selectCalendarEventsForMessage = db.prepare(
      `SELECT
         eventUid,
         eventUidKey,
         eventFirstStartAtMs,
         eventLastEndAtMs,
         inviteActionType,
         processedAtMs,
         processedByUserId,
         processedAutomatically,
         unprocessedReason,
         snapshotJson,
         snapshotVersion
       FROM message_calendar_events
       WHERE accountId = ? AND messageId = ?`
    );
    const deleteMessageById = db.prepare(`DELETE FROM messages WHERE accountId = ? AND id = ?`);
    const findMessageById = db.prepare(
      `SELECT id, threadId, messageId, dateValue, folderId, mailboxPath, imapUid, flags, sizeBytes, deliveredTo, originalTo, senderIdentityId, sourceSha256
       FROM messages
       WHERE accountId = ? AND id = ?`
    );
    const findFolderMessageDuplicates = db.prepare(
      `SELECT id, threadId, messageId, dateValue, folderId, mailboxPath, imapUid, flags, sizeBytes, deliveredTo, originalTo, senderIdentityId
       FROM messages
       WHERE accountId = ? AND folderId = ? AND messageId = ? AND id <> ?`
    );
    const deleteFtsByScope = folderId
      ? db.prepare(
          `DELETE FROM ${SHARD_FTS_TABLE} WHERE EXISTS (SELECT 1 FROM messages m WHERE m.accountId = ${SHARD_FTS_TABLE}.accountId AND m.id = ${SHARD_FTS_TABLE}.messageId AND m.accountId = ? AND m.folderId = ?)`
        )
      : db.prepare(
          `DELETE FROM ${SHARD_FTS_TABLE} WHERE accountId = ?`
        );
    const insertAttachment = db.prepare(
      `INSERT INTO attachments (accountId, id, messageId, filename, contentType, size, inline, cid, url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(accountId, messageId, id) DO UPDATE SET
         filename=excluded.filename, contentType=excluded.contentType, size=excluded.size,
         inline=excluded.inline, cid=excluded.cid, url=excluded.url`
    );
    const insertCalendarEvent = db.prepare(
      `INSERT OR REPLACE INTO message_calendar_events (
         accountId,
         messageId,
         eventUid,
         eventUidKey,
         eventFirstStartAtMs,
         eventLastEndAtMs,
         inviteActionType,
         processedAtMs,
         processedByUserId,
         processedAutomatically,
         unprocessedReason,
         snapshotJson,
         snapshotVersion
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    const insertMessage = db.prepare(`
      INSERT INTO messages (
        id, accountId, folderId, threadId, parentId, messageId, inReplyTo, "references", xForwardedMessageId, xComposeFormat, quotedHtmlEdited,
        subject, fromAddr, fromEmail, senderKey, sourceSha256, replyToAddr, toAddr, ccAddr, bccAddr, mailboxPath, imapUid, preview, date, dateValue,
        body, htmlBody, priority, hasSource, unread, flags, seen, answered, flagged, deleted, draft, recent,
        category, categoryScore, categorySignals, categoryManualState, listUnsubscribe, listId, sizeBytes, deliveredTo, originalTo, senderIdentityId
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(accountId, id) DO UPDATE SET
        folderId=excluded.folderId,
        threadId=excluded.threadId,
        parentId=excluded.parentId,
        messageId=excluded.messageId,
        inReplyTo=excluded.inReplyTo,
        "references"=excluded."references",
        xForwardedMessageId=excluded.xForwardedMessageId,
        xComposeFormat=excluded.xComposeFormat,
        quotedHtmlEdited=excluded.quotedHtmlEdited,
        subject=excluded.subject,
        fromAddr=excluded.fromAddr,
        fromEmail=excluded.fromEmail,
        senderKey=excluded.senderKey,
        sourceSha256=excluded.sourceSha256,
        replyToAddr=excluded.replyToAddr,
        toAddr=excluded.toAddr,
        ccAddr=excluded.ccAddr,
        bccAddr=excluded.bccAddr,
        mailboxPath=excluded.mailboxPath,
        imapUid=excluded.imapUid,
        preview=excluded.preview,
        date=excluded.date,
        dateValue=excluded.dateValue,
        body=excluded.body,
        htmlBody=excluded.htmlBody,
        priority=excluded.priority,
        hasSource=excluded.hasSource,
        unread=excluded.unread,
        flags=excluded.flags,
        seen=excluded.seen,
        answered=excluded.answered,
        flagged=excluded.flagged,
        deleted=excluded.deleted,
        draft=excluded.draft,
        recent=excluded.recent,
        category=excluded.category,
        categoryScore=excluded.categoryScore,
        categorySignals=excluded.categorySignals,
        categoryManualState=excluded.categoryManualState,
        listUnsubscribe=excluded.listUnsubscribe,
        listId=excluded.listId,
        sizeBytes=excluded.sizeBytes,
        deliveredTo=excluded.deliveredTo,
        originalTo=excluded.originalTo,
        senderIdentityId=excluded.senderIdentityId,
        pendingMoveSourceFolderId=NULL,
        pendingMoveSourceMailboxPath=NULL,
        pendingMoveSourceUid=NULL,
        pendingMoveStartedAt=NULL
    `);
    const insertFts = db.prepare(`
      INSERT INTO ${SHARD_FTS_TABLE} (accountId, messageId, subject, fromAddr, toAddr, ccAddr, bccAddr, body, preview)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const deleteFts = db.prepare(`DELETE FROM ${SHARD_FTS_TABLE} WHERE accountId = ? AND messageId = ?`);
    const deleteMessages = db.prepare(deleteSql);
    const existingScopeThreadIds =
      replaceExisting && folderId
        ? new Set(
            (
              db
                .prepare(
                  `SELECT DISTINCT threadId
                   FROM messages
                   WHERE accountId = ? AND folderId = ?`
                )
                .all(accountId, folderId) as Array<{ threadId: string | null }>
            )
              .map((row) => row.threadId)
              .filter((id): id is string => Boolean(id))
          )
        : null;
    const existingAccountThreadIds =
      replaceExisting && !folderId
        ? new Set(
            (
              db
                .prepare(
                  `SELECT DISTINCT threadId
                   FROM messages
                   WHERE accountId = ?`
                )
                .all(accountId) as Array<{ threadId: string | null }>
            )
              .map((row) => row.threadId)
              .filter((id): id is string => Boolean(id))
          )
        : null;
    const manualCategoryStateByMessageId = new Map<string, CategoryManualState>();
    const rememberManualCategoryState = (rows: Array<{ id?: string | null; categoryManualState?: string | null }>) => {
      rows.forEach((row) => {
        const id = (row.id ?? "").trim();
        if (!id) return;
        const manualState = normalizeCategoryManualState(row.categoryManualState);
        if (manualState) {
          manualCategoryStateByMessageId.set(id, manualState);
        }
      });
    };
    const loadManualCategoryStatesForMessageIds = (messageIds: string[]) => {
      const uniqueIds = Array.from(new Set(messageIds.map((id) => id.trim()).filter(Boolean)));
      if (uniqueIds.length === 0) return;
      const QUERY_BATCH_SIZE = 400;
      for (let start = 0; start < uniqueIds.length; start += QUERY_BATCH_SIZE) {
        const chunk = uniqueIds.slice(start, start + QUERY_BATCH_SIZE);
        if (chunk.length === 0) continue;
        const rows = db
          .prepare(
            `SELECT id, categoryManualState
             FROM messages
             WHERE accountId = ?
               AND categoryManualState IS NOT NULL
               AND id IN (${chunk.map(() => "?").join(",")})`
          )
          .all(accountId, ...chunk) as Array<{ id?: string | null; categoryManualState?: string | null }>;
        rememberManualCategoryState(rows);
      }
    };
    if (replaceExisting) {
      const rows = (folderId
        ? db
            .prepare(
              `SELECT id, categoryManualState
               FROM messages
               WHERE accountId = ? AND folderId = ? AND categoryManualState IS NOT NULL`
            )
            .all(accountId, folderId)
        : db
            .prepare(
              `SELECT id, categoryManualState
               FROM messages
               WHERE accountId = ? AND categoryManualState IS NOT NULL`
            )
            .all(accountId)) as Array<{ id?: string | null; categoryManualState?: string | null }>;
      rememberManualCategoryState(rows);
    } else {
      loadManualCategoryStatesForMessageIds(nextMessages.map((message) => message.id));
    }
    // Identity snapshots are scoped to account + header ID + exact mailbox copy,
    // independent of storage row IDs. Capture only inside the immediate writer.
    type IdentitySnapshot = {
      id: string; threadId: string; dateValue: number; messageId?: string | null; folderId?: string | null; mailboxPath?: string | null;
      imapUid?: number | null; flags?: string | null; sizeBytes?: number | null;
      deliveredTo?: string | null; originalTo?: string | null; senderIdentityId?: string | null; sourceSha256?: string | null;
    };
    const replacedMetadata = new Map<string, IdentitySnapshot>();
    const replacedMetadataByHeader = new Map<string, IdentitySnapshot[]>();
    const captureIdentitySnapshots = () => {
      if (!replaceExisting) return;
      const rows = db.prepare(`SELECT id,threadId,dateValue,messageId,folderId,mailboxPath,imapUid,flags,sizeBytes,deliveredTo,originalTo,senderIdentityId,sourceSha256
        FROM messages WHERE accountId=? ${folderId ? "AND folderId=?" : ""}`).all(...deleteArgs) as IdentitySnapshot[];
      for (const row of rows) {
        replacedMetadata.set(row.id, row);
        if (row.messageId) replacedMetadataByHeader.set(row.messageId, [...(replacedMetadataByHeader.get(row.messageId) ?? []), row]);
      }
    };
    const dedupedThreadIds = new Set<string>();
    const remaps: ThreadRemapPair[] = [];
    type ReplacedRow = { id: string; threadId: string; messageId: string | null; dateValue: number };
    const replacedById = new Map<string, ReplacedRow>();
    const replacedByHeader = new Map<string, ReplacedRow>();
    const upsertBatch = (batch: Message[], shouldDeleteAttachments: boolean) => {
      batch.forEach((message) => {
        // Resolve the prior same copy before selecting a storage row ID. In
        // particular, a now-free base ID must not erase a shared-shard variant.
        const priorCopy = message.messageId
          ? [...(replacedMetadataByHeader.get(message.messageId) ?? []),
              ...findFolderMessageDuplicates.all(accountId, message.folderId, message.messageId, "") as IdentitySnapshot[]]
              .find(row => isSameMailboxMessageCopy(row, message))
          : undefined;
        let rowId = priorCopy?.id ?? message.id;
        const existingById = (findMessageById.get(accountId, rowId) ?? replacedMetadata.get(rowId) ?? priorCopy) as
          | {
              id: string;
              threadId: string;
              messageId: string | null;
              dateValue: number;
              folderId?: string | null;
              mailboxPath?: string | null;
              imapUid?: number | null;
              flags?: string | null;
              sizeBytes?: number | null;
              deliveredTo?: string | null;
              originalTo?: string | null;
              senderIdentityId?: string | null;
              sourceSha256?: string | null;
            }
          | undefined;
        let existingRow = existingById;
        if (existingById && !isSameMailboxMessageCopy(existingById, message)) {
          rowId = buildMessageCollisionVariantId(
            message.id,
            message.mailboxPath ?? message.folderId,
            message.imapUid ?? null
          );
          // The base row keeps its own blobs. Publish this copy only under
          // its final id, alongside the row and its source ownership digest.
          existingRow = (findMessageById.get(accountId, rowId) ?? replacedMetadata.get(rowId)) as typeof existingById;
        }
        messageRowIds.set(message.id, rowId);
        const previous = existingRow ?? replacedById.get(rowId) ?? (message.messageId ? replacedByHeader.get(message.messageId) : undefined);
        if (previous?.threadId && previous.threadId !== message.threadId) remaps.push({
          ...previous, oldThreadId: previous.threadId, newThreadId: message.threadId
        });
        if (message.messageId) {
          const duplicates = findFolderMessageDuplicates.all(
            accountId,
            message.folderId,
            message.messageId,
            rowId
          ) as Array<{
            id: string;
            threadId: string | null;
            messageId: string | null;
            dateValue: number;
            folderId?: string | null;
            mailboxPath?: string | null;
            imapUid?: number | null;
          }>;
          duplicates.forEach((row) => {
            if (!isSameMailboxMessageCopy(row, message)) {
              return;
            }
            deleteAttachmentsForMessage.run(accountId, row.id);
            deleteCalendarEventsForMessage.run(accountId, row.id);
            deleteFts.run(accountId, row.id);
            deleteMessageById.run(accountId, row.id);
            if (row.threadId) {
              dedupedThreadIds.add(row.threadId);
              if (row.threadId !== message.threadId) {
                remaps.push({ ...row, oldThreadId: row.threadId, newThreadId: message.threadId });
              }
            }
          });
        }
        if (shouldDeleteAttachments) {
          deleteAttachmentsForMessage.run(accountId, rowId);
        }
        const preservedCalendarInviteStateByUid = new Map(
          (
            selectCalendarEventsForMessage.all(accountId, rowId) as Array<{
              eventUid?: string | null;
              eventUidKey?: string | null;
              eventFirstStartAtMs?: number | null;
              eventLastEndAtMs?: number | null;
              inviteActionType?: string | null;
              processedAtMs?: number | null;
              processedByUserId?: string | null;
              processedAutomatically?: number | boolean | null;
              unprocessedReason?: string | null;
              snapshotJson?: string | null;
              snapshotVersion?: number | null;
            }>
          )
            .map((row) => {
              const eventUid = normalizeCalendarEventUid(row.eventUid);
              if (!eventUid) return null;
              return [
                eventUid,
                {
                  eventUidKey:
                    typeof row.eventUidKey === "string" && row.eventUidKey.trim()
                      ? row.eventUidKey.trim()
                      : normalizeCalendarEventUidKey(eventUid),
                  eventFirstStartAtMs:
                    typeof row.eventFirstStartAtMs === "number" &&
                    Number.isFinite(row.eventFirstStartAtMs) &&
                    row.eventFirstStartAtMs > 0
                      ? row.eventFirstStartAtMs
                      : null,
                  eventLastEndAtMs:
                    row.eventLastEndAtMs === null || row.eventLastEndAtMs === undefined
                      ? null
                      : typeof row.eventLastEndAtMs === "number" &&
                          Number.isFinite(row.eventLastEndAtMs) &&
                          row.eventLastEndAtMs > 0
                        ? row.eventLastEndAtMs
                        : null,
                  inviteActionType: row.inviteActionType ?? null,
                  processedAtMs:
                    typeof row.processedAtMs === "number" && Number.isFinite(row.processedAtMs)
                      ? row.processedAtMs
                      : null,
                  processedByUserId:
                    typeof row.processedByUserId === "string" && row.processedByUserId.trim()
                      ? row.processedByUserId.trim()
                      : null,
                  processedAutomatically:
                    typeof row.processedAutomatically === "boolean"
                      ? row.processedAutomatically
                      : typeof row.processedAutomatically === "number"
                        ? row.processedAutomatically !== 0
                        : null,
                  unprocessedReason:
                    typeof row.unprocessedReason === "string" && row.unprocessedReason.trim()
                      ? row.unprocessedReason.trim()
                      : null,
                  snapshotJson:
                    typeof row.snapshotJson === "string" && row.snapshotJson.trim()
                      ? row.snapshotJson
                      : null,
                  snapshotVersion:
                    typeof row.snapshotVersion === "number" &&
                    Number.isFinite(row.snapshotVersion)
                      ? row.snapshotVersion
                      : null
                }
              ] as const;
            })
            .filter(
              (
                entry
              ): entry is readonly [
                string,
                {
                  eventUidKey: string | null;
                  eventFirstStartAtMs: number | null;
                  eventLastEndAtMs: number | null;
                  inviteActionType: string | null;
                  processedAtMs: number | null;
                  processedByUserId: string | null;
                  processedAutomatically: boolean | null;
                  unprocessedReason: string | null;
                  snapshotJson: string | null;
                  snapshotVersion: number | null;
                }
              ] => Boolean(entry)
            )
        );
        deleteCalendarEventsForMessage.run(accountId, rowId);
        const hasRawFlags = Array.isArray(message.flags);
        const existingFlags = safeParseJson<string[]>(existingById?.flags);
        const normalizedFlags = hasRawFlags
          ? preserveLocalOnlyMessageFlags(message.flags, existingFlags)
          : normalizeImapFlags(message.flags);
        const normalizedSystemFlags = deriveSystemFlagState(normalizedFlags);
        const seen = hasRawFlags ? Boolean(normalizedSystemFlags.seen) : Boolean(message.seen);
        const answered = hasRawFlags
          ? Boolean(normalizedSystemFlags.answered)
          : Boolean(message.answered);
        const flagged = hasRawFlags
          ? Boolean(normalizedSystemFlags.flagged)
          : Boolean(message.flagged);
        const deleted = hasRawFlags ? Boolean(normalizedSystemFlags.deleted) : Boolean(message.deleted);
        const draft = hasRawFlags ? Boolean(normalizedSystemFlags.draft) : Boolean(message.draft);
        const recent = hasRawFlags ? Boolean(normalizedSystemFlags.recent) : Boolean(message.recent);
        const unread = hasRawFlags
          ? Boolean(normalizedSystemFlags.unread)
          : typeof message.unread === "boolean"
            ? message.unread
            : !seen;
        const manualCategoryState =
          manualCategoryStateByMessageId.get(rowId) ??
          manualCategoryStateByMessageId.get(message.id) ??
          null;
        // A source-less upsert updates the row (envelope-only sync fallback),
        // so preserve a size the
        // stored .eml still backs.
        const sizeBytes =
          message.source !== undefined
            ? Buffer.byteLength(message.source)
            : typeof message.sizeBytes === "number" && Number.isFinite(message.sizeBytes)
              ? message.sizeBytes
              : typeof existingRow?.sizeBytes === "number"
                ? existingRow.sizeBytes
                : null;
        const category =
          manualCategoryState === "cleared" ? null : normalizeCategory(message.category) ?? null;
        const categoryScore =
          manualCategoryState === "cleared"
            ? null
            : typeof message.categoryScore === "number"
              ? message.categoryScore
              : null;
        const categorySignals =
          manualCategoryState === "cleared"
            ? ["manual-category:cleared", "manual-feedback:negative"]
            : message.categorySignals;
        const fromEmail = parseAddressEmails(message.from)[0] ?? null;
        // Attachment URLs embed the message id as a path segment
        // (/messages/<id>/attachments/<att>), so a collision variant must
        // rewrite that segment. Sanitization baked the base id into htmlBody
        // before this upsert assigned the variant; leaving it stale makes the
        // inline <img> 404 and appendUnreferencedInlineImages tack on a second
        // copy, so the image renders once broken and once correct.
        const baseMessagePathSegment = `/messages/${encodeURIComponent(message.id)}/`;
        const rowMessagePathSegment = `/messages/${encodeURIComponent(rowId)}/`;
        const rewriteAttachmentUrl = (url?: string) => {
          if (!url || rowId === message.id) return url ?? null;
          return url.replaceAll(baseMessagePathSegment, rowMessagePathSegment);
        };
        const rewrittenHtmlBody =
          rowId !== message.id && message.htmlBody
            ? message.htmlBody.replaceAll(baseMessagePathSegment, rowMessagePathSegment)
            : message.htmlBody;
        insertMessage.run(
          rowId,
          accountId,
          message.folderId,
          message.threadId,
          message.parentId ?? null,
          message.messageId ?? null,
          message.inReplyTo ?? null,
          message.references ? JSON.stringify(message.references) : null,
          message.xForwardedMessageId ?? null,
          message.xComposeFormat ?? null,
          message.quotedHtmlEdited ? 1 : 0,
          message.subject,
          message.from,
          fromEmail,
          message.senderKey ?? null,
          fileEntries.get(message)?.sourceSha256 ?? existingRow?.sourceSha256 ?? null,
          message.replyTo?.trim() || null,
          message.to,
          message.cc ?? null,
          message.bcc ?? null,
          message.mailboxPath ?? null,
          typeof message.imapUid === "number" ? message.imapUid : null,
          message.preview,
          message.date,
          message.dateValue,
          message.body,
          rewrittenHtmlBody ?? null,
          message.priority ?? null,
          message.source !== undefined || message.hasSource ? 1 : 0,
          unread ? 1 : 0,
          message.flags ? JSON.stringify(normalizedFlags) : null,
          seen ? 1 : 0,
          answered ? 1 : 0,
          flagged ? 1 : 0,
          deleted ? 1 : 0,
          draft ? 1 : 0,
          recent ? 1 : 0,
          category,
          categoryScore,
          categorySignals ? JSON.stringify(categorySignals) : null,
          manualCategoryState,
          message.listUnsubscribe ?? null,
          message.listId ?? null,
          sizeBytes,
          // Sender identities: retain metadata only from this exact mailbox copy.
          message.deliveredTo === undefined ? existingRow?.deliveredTo ?? null : JSON.stringify(message.deliveredTo),
          message.originalTo === undefined ? existingRow?.originalTo ?? null : JSON.stringify(message.originalTo),
          message.senderIdentityId ?? existingRow?.senderIdentityId ?? null
          // End sender identity metadata.
        );
        deleteFts.run(accountId, rowId);
        insertFts.run(
          accountId,
          rowId,
          message.subject,
          message.from,
          message.to,
          message.cc ?? "",
          message.bcc ?? "",
          message.body,
          message.preview
        );
        normalizeCalendarEventUids(message.calendarEventUids).forEach((eventUid) => {
          const existing = preservedCalendarInviteStateByUid.get(eventUid);
          insertCalendarEvent.run(
            accountId,
            rowId,
            eventUid,
            existing?.eventUidKey ?? normalizeCalendarEventUidKey(eventUid),
            existing?.eventFirstStartAtMs ?? null,
            existing?.eventLastEndAtMs ?? null,
            existing?.inviteActionType ?? null,
            existing?.processedAtMs ?? null,
            existing?.processedByUserId ?? null,
            typeof existing?.processedAutomatically === "boolean"
              ? (existing.processedAutomatically ? 1 : 0)
              : null,
            existing?.unprocessedReason ?? null,
            existing?.snapshotJson ?? null,
            existing?.snapshotVersion ?? null
          );
        });
        (message.attachments ?? []).forEach((att) => {
          insertAttachment.run(
            accountId,
            att.id,
            rowId,
            att.filename,
            att.contentType,
            att.size,
            att.inline ? 1 : 0,
            att.cid ?? null,
            rewriteAttachmentUrl(att.url) ?? null
          );
        });
        files.install(fileIndexes.get(message)!, rowId);
      });
    };

    const files = await stageMessageFiles(accountId, nextMessages.map(message => ({
      source: message.source,
      attachments: (message.attachments ?? []).flatMap(attachment => {
        const data = getAttachmentContentBuffer(attachment);
        return data ? [{ id: attachment.id, data }] : [];
      })
    })));
    const fileIndexes = new Map(nextMessages.map((message, index) => [message, index]));
    const fileEntries = new Map(nextMessages.map((message, index) => [message, files.entries[index]]));

    // Message rewrite and metadata remap are a single immediate unit. In
    // particular, a split spanning batches must see every final message id.
    try {
      const collabChanges = db.transaction(() => {
        try {
          captureIdentitySnapshots();
          if (replaceExisting) {
            // Capture identities under the same writer lock as delete + remap.
            const replacedRows = db.prepare(`SELECT id,threadId,messageId,dateValue FROM messages
              WHERE accountId=?${folderId ? " AND folderId=?" : ""}`).all(...deleteArgs) as ReplacedRow[];
            for (const row of replacedRows) {
              replacedById.set(row.id, row);
              if (row.messageId) replacedByHeader.set(row.messageId, row);
            }
            deleteAttachmentsByScope.run(...deleteArgs);
            if (folderId) deleteCalendarEventsByScope.run(accountId, accountId, folderId);
            else deleteCalendarEventsByScope.run(accountId);
            deleteFtsByScope.run(...deleteArgs);
            deleteMessages.run(...deleteArgs);
          }
          for (let start = 0; start < nextMessages.length; start += UPSERT_BATCH_SIZE) {
            upsertBatch(nextMessages.slice(start, start + UPSERT_BATCH_SIZE), !replaceExisting);
          }
          return remapThreadCollab(db, accountId, remaps);
        } catch (error) {
          // Restore overwritten files while the shard writer lock is held.
          files.rollback();
          throw error;
        }
      }).immediate();
      for (const event of collabChanges) publishThreadCollabEvent(event);
    } catch (error) {
      // Also cover a commit failure, after the callback has returned.
      files.rollback();
      throw error;
    } finally {
      await files.cleanup();
    }

    let affectedThreadIds: string[] = [];
    let requiresFullRecompute = false;

    if (replaceExisting) {
      if (folderId) {
        const affectedThreadIdSet = new Set<string>([
          ...(existingScopeThreadIds ?? new Set<string>()),
          ...dedupedThreadIds,
          ...remaps.map(pair => pair.oldThreadId)
        ]);
        nextMessages.forEach((message) => {
          if (message.threadId) {
            affectedThreadIdSet.add(message.threadId);
          }
        });
        const affected = Array.from(affectedThreadIdSet);
        if (shouldRecomputeThreads && affected.length > 0) {
          await recomputeThreadsForAccountInternal(accountId, affected);
        }
        await rebuildThreadSignalsForThreadIds(db, accountId, affected);
        upsertTopicLearningSignalsForThreadIds(db, accountId, affected);
        pruneThreadTopicsWithoutMessages(db, accountId, affected);
        return { affectedThreadIds: affected, requiresFullRecompute, messageRowIds };
      }
      requiresFullRecompute = true;
      if (shouldRecomputeThreads) {
        await recomputeThreadsForAccountInternal(accountId);
      }
      await rebuildAllThreadSignalsForAccount(db, accountId);
      const learningThreadIds = [
        ...(existingAccountThreadIds ?? new Set<string>()),
        ...nextMessages.map((message) => message.threadId).filter(Boolean)
      ];
      upsertTopicLearningSignalsForThreadIds(db, accountId, learningThreadIds);
      pruneThreadTopicsWithoutMessages(db, accountId, [
        ...(existingAccountThreadIds ?? new Set<string>()),
        ...nextMessages.map((message) => message.threadId).filter(Boolean)
      ]);
    } else {
      const affected = Array.from(
        new Set([
          ...nextMessages.map((message) => message.threadId).filter(Boolean),
          ...dedupedThreadIds,
          ...remaps.map(pair => pair.oldThreadId)
        ])
      );
      affectedThreadIds = affected;
      if (shouldRecomputeThreads && affected.length > 0) {
        await recomputeThreadsForAccountInternal(accountId, affected);
      }
      await rebuildThreadSignalsForThreadIds(db, accountId, affected);
      upsertTopicLearningSignalsForThreadIds(db, accountId, affected);
      pruneThreadTopicsWithoutMessages(db, accountId, affected);
    }
    return { affectedThreadIds, requiresFullRecompute, messageRowIds };
  });
}
