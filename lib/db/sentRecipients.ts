import { parseAddressEmails } from "../ownAddresses";

const SENT_MATCH_ROWS = 25;

/**
 * Whether a Sent-folder message lists `email` as an exact To/Cc/Bcc entry. Takes
 * any shard handle and never imports the connection layer, so the read-only
 * spam eval script can use it too.
 */
export function sentToAddressInDb(db: any, accountId: string, sentFolderId: string, email: string) {
  const needle = email.trim().toLowerCase();
  if (!needle) return false;
  const rows = db.prepare(`SELECT toAddr, ccAddr, bccAddr FROM messages
    WHERE accountId = ? AND folderId = ?
      AND (instr(lower(toAddr), ?) > 0 OR instr(lower(COALESCE(ccAddr, '')), ?) > 0 OR instr(lower(COALESCE(bccAddr, '')), ?) > 0)
    LIMIT ?`).all(accountId, sentFolderId, needle, needle, needle, SENT_MATCH_ROWS) as Array<{ toAddr: string; ccAddr: string | null; bccAddr: string | null }>;
  // instr() only narrows; the parsed address list decides (no substring matches).
  return rows.some((row) => [row.toAddr, row.ccAddr, row.bccAddr]
    .some((value) => parseAddressEmails(value).some((address) => address.toLowerCase() === needle)));
}
