import { createHash } from "crypto";
import type { Database } from "bun:sqlite";
import { getMessageSource } from "../../storage";
import { withDbWriteRetry } from "../../dbWriteRetry";
import { parseHeaderMap, resolveMessageSenderKey } from "../../mail/imap/parser";

/** Backfill only on opening a message, using its retained wire From header. */
export async function backfillMessageSenderKey(
  db: Database,
  row: { id: string; accountId: string; fromAddr: string; senderKey?: string | null; sourceSha256?: string | null }
) {
  if (row.senderKey != null || !row.sourceSha256) return;
  // A collision variant's base-id fallback may belong to a different copy.
  // A matching filename alone does not establish ownership for legacy files.
  // Require the digest recorded with this final row id by the fixed writer.
  const source = await getMessageSource(row.accountId, row.id, { exact: true });
  if (!source || createHash("sha256").update(source).digest("hex") !== row.sourceSha256) return;
  const key = resolveMessageSenderKey(undefined, parseHeaderMap(Buffer.from(source)));
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
