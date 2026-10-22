import type { Database } from "bun:sqlite";
import { getMessageSource } from "../../storage";
import { withDbWriteRetry } from "../../dbWriteRetry";
import { parseHeaderMap, resolveMessageSenderKey } from "../../mail/imap/parser";

/** Backfill only on opening a message, using its retained wire From header. */
export async function backfillMessageSenderKey(
  db: Database,
  row: { id: string; accountId: string; fromAddr: string; senderKey?: string | null }
) {
  if (row.senderKey != null) return;
  // A collision variant's base-id fallback may belong to a different copy.
  // Permission identities require this row's own retained source.
  const source = await getMessageSource(row.accountId, row.id, { exact: true });
  if (!source) return;
  const key = resolveMessageSenderKey(undefined, parseHeaderMap(Buffer.from(source)));
  if (!key) return;
  await withDbWriteRetry("backfillMessageSenderKey", async () => {
    db.prepare(`UPDATE messages SET senderKey = ?
      WHERE accountId = ? AND id = ? AND senderKey IS NULL AND fromAddr = ?`)
      .run(key, row.accountId, row.id, row.fromAddr);
    // A concurrent resync may already have written a different key.
    const stored = db.prepare(`SELECT senderKey FROM messages WHERE accountId = ? AND id = ?`)
      .get(row.accountId, row.id) as { senderKey: string | null } | null;
    row.senderKey = stored?.senderKey ?? null;
  });
}
