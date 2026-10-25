import { getAccounts, getFolders } from "@/lib/db";
import { getAccountDb } from "../../db/connection";
import type { Folder } from "@/lib/data";
import { findSentFolder } from "@/lib/specialFolders";
import { buildOwnIdentitySets } from "./allowlist";
import { createCorrespondentCheck, type ScanDb, type ServerFlagHousehold } from "./serverFlagBackfill";
import type { StaticRules } from "./staticRules";

/**
 * The server-flag selection's household over the app's DB layer (live data):
 * every mailbox's shard and folders, the own addresses and the Sent folders of
 * all mailboxes for the correspondent rule. Shared by the real run of
 * `scripts/spam-apply.ts --server-flagged` and the admin rescan (rescan.ts).
 */
export async function loadAppServerFlagContext(staticRules: StaticRules) {
  const accounts = await getAccounts();
  const shards = new Map<string, { db: ScanDb; folders: Folder[] }>();
  for (const account of accounts) shards.set(account.id, { db: await getAccountDb(account.id), folders: await getFolders(account.id) });
  const sentShards = accounts.flatMap((account) => {
    const shard = shards.get(account.id)!;
    const sent = findSentFolder(shard.folders, account.id);
    return sent ? [{ db: shard.db, accountId: account.id, sentFolderId: sent.id }] : [];
  });
  const household: ServerFlagHousehold = {
    ...buildOwnIdentitySets(accounts.flatMap((account) => [account.email, ...(account.ownAddresses ?? [])])),
    isCorrespondent: createCorrespondentCheck(sentShards),
    staticRules
  };
  return { accounts, shards, household };
}
