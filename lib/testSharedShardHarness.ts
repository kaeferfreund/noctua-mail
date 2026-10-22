import { createCollabFixture } from "./testThreadCollabHarness";
import { getDb, getAccountDb } from "./db/connection";

/** Two synthetic accounts using the same supported physical shard. */
export async function createSharedShardFixture() {
  const a = await createCollabFixture();
  const b = await createCollabFixture();
  const master = await getDb();
  const { dbPath } = master.prepare("SELECT dbPath FROM accounts WHERE id = ?").get(a.accountId) as { dbPath: string };
  master.prepare("UPDATE accounts SET dbPath = ? WHERE id = ?").run(dbPath, b.accountId);
  const shared = await getAccountDb(b.accountId);
  if (shared !== a.db) throw new Error("Shared shard fixture must use the same connection");
  await b.api.saveFoldersForAccount(b.accountId, [
    { id: b.folderId, accountId: b.accountId, name: "INBOX", count: 0, specialUse: "\\Inbox" }
  ]);
  return { a, b: { ...b, db: shared }, db: shared, master };
}
