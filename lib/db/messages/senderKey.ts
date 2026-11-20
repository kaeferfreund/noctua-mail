import type { Database } from "bun:sqlite";
import { getMessageSourceBuffer, messageSourceSha256 } from "../../storage";
import { withDbWriteRetry } from "../../dbWriteRetry";
import { getHeaderValue, normalizeEnvelopeHeaderId, parseHeaderMap, resolveMessageSenderKey } from "../../mail/imap/parser";
import { extractUnambiguousPrimaryEmail } from "../../senderIdentity";
import { rawMessageSourceBytes, type RawMessageSource } from "../../messageSource";

/** Backfill only on opening a message, using its retained wire From header. */
export async function backfillMessageSenderKey(
  db: Database,
  row: { id: string; accountId: string; fromAddr: string; senderKey?: string | null; sourceSha256?: string | null }
) {
  if (row.senderKey != null || !row.sourceSha256) return;
  // A collision variant's base-id fallback may belong to a different copy.
  // A matching filename alone does not establish ownership for legacy files.
  // Require the digest recorded with this final row id by the fixed writer.
  // The digest was taken over the bytes the writer stored, so compare bytes.
  const source = await getMessageSourceBuffer(row.accountId, row.id, { exact: true });
  if (!source?.length || messageSourceSha256(source) !== row.sourceSha256) return;
  const key = resolveMessageSenderKey(undefined, parseHeaderMap(source));
  if (!key) return;
  await withDbWriteRetry("backfillMessageSenderKey", async () => {
    db.prepare(`UPDATE messages SET senderKey = ?
      WHERE accountId = ? AND id = ? AND senderKey IS NULL AND fromAddr = ? AND sourceSha256 = ?`)
      .run(key, row.accountId, row.id, row.fromAddr, row.sourceSha256);
    // A concurrent resync may already have written a different key.
    const stored = db.prepare(`SELECT senderKey FROM messages WHERE accountId = ? AND id = ?`)
      .get(row.accountId, row.id) as { senderKey: string | null } | null;
    row.senderKey = stored?.senderKey ?? null;
  });
}

export type LegacySourceSkipReason = "size" | "message-id" | "no-sender-key" | "sender";

/**
 * Ownership check for a source retained under a row's exact final id before
 * the writer recorded `sourceSha256` (scripts/backfill-sender-keys.ts).
 * The legacy writer could publish another copy with the same Message-ID under
 * this id, so the file must match the row on every field that copy would
 * change: byte size (recorded from the row's own source at ingestion),
 * Message-ID, and the From mailbox shown in the row. Anything else is skipped.
 */
export function checkLegacySourceOwnership(
  row: { messageId: string | null; fromAddr: string; sizeBytes: number | null },
  source: RawMessageSource
): { senderKey: string; sourceSha256: string } | { skip: LegacySourceSkipReason } {
  const bytes = rawMessageSourceBytes(source);
  if (bytes.length !== row.sizeBytes) return { skip: "size" };
  // parseHeaderMap stops at the first empty line: split only the header block
  // (up to the newline before that line) instead of a possibly large body.
  const lfEnd = bytes.indexOf("\n\n");
  const crlfEnd = bytes.indexOf("\n\r\n");
  const headerEnd = lfEnd < 0 ? crlfEnd : crlfEnd < 0 ? lfEnd : Math.min(lfEnd, crlfEnd);
  const headers = parseHeaderMap(headerEnd < 0 ? bytes : bytes.subarray(0, headerEnd + 1));
  const messageId = normalizeEnvelopeHeaderId(getHeaderValue(headers, "message-id"));
  if (!messageId || messageId !== row.messageId) return { skip: "message-id" };
  // The same derivation as ingestion without an envelope and as the lazy backfill above.
  const senderKey = resolveMessageSenderKey(undefined, headers);
  if (!senderKey) return { skip: "no-sender-key" };
  if (senderKey !== extractUnambiguousPrimaryEmail(row.fromAddr)) return { skip: "sender" };
  return { senderKey, sourceSha256: messageSourceSha256(bytes) };
}
