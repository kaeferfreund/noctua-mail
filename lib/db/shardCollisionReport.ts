/** Read-only inventory; surviving rows cannot reveal rows already replaced. */
export function getShardCollisionReport(db: any) {
  const counts = db.prepare(`WITH shared_headers AS (
    SELECT lower(trim(messageId)) AS header, COUNT(*) AS rowCount
    FROM messages WHERE trim(COALESCE(messageId, '')) <> ''
    GROUP BY lower(trim(messageId)) HAVING COUNT(DISTINCT accountId) > 1
  ) SELECT COUNT(*) AS sharedMessageIdCount, COALESCE(SUM(rowCount), 0) AS sharedMessageRowCount
    FROM shared_headers`).get() as { sharedMessageIdCount: number; sharedMessageRowCount: number };
  const key = (db.prepare("PRAGMA table_info(messages)").all() as Array<{ name: string; pk: number }>)
    .filter(column => column.pk).sort((a, b) => a.pk - b.pk).map(column => column.name);
  const legacyMessageKey = key.join(",") !== "accountId,id";
  return {
    ...counts,
    storedAccountCount: (db.prepare("SELECT COUNT(DISTINCT accountId) AS count FROM messages").get() as { count: number }).count,
    legacyMessageKey,
    // A zero count is not evidence that a legacy shared file never lost rows.
    resyncRequiredForLegacySharedShard: legacyMessageKey,
    note: "Counts cover surviving rows only. If this file was shared before account keys, resync every mapped account even when the count is zero."
  };
}
