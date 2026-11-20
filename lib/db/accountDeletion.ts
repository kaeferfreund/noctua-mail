import { deleteMcpTokenAccountRows } from "./mcpTokens";
import { deleteSpamRescanRowsForAccount } from "./spamRescan";
import { deleteSpamSettingsRowsForAccount } from "./spamSettingsScope";
import { deleteUserAccountPrefRowsForAccount } from "./userAccountPrefs";

/**
 * Master tables keyed by a mailbox id that a mailbox deletion clears, besides `accounts`
 * itself. `spam_rescan_items` hang off `spam_rescan_jobs` by job id. A mailbox recreated
 * for the same address gets the same id, so none of these rows may outlive the mailbox.
 * `spam_settings` is keyed by scope, not accountId (`spamSettingsScope.ts`), so it is not listed
 * here but cleared by deleteAccountKeyedMasterRows as well.
 */
export const ACCOUNT_KEYED_MASTER_TABLES: readonly string[] = [
  "user_accounts", "user_account_prefs", "mcp_token_accounts", "mcp_tokens", "sender_identities",
  "spam_rescan_jobs", "scheduled_sends", "mailbox_watcher_auth"
];

/** Removes the mailbox's rows from ACCOUNT_KEYED_MASTER_TABLES; run inside the caller's transaction. */
export function deleteAccountKeyedMasterRows(db: any, accountId: string) {
  db.prepare(`DELETE FROM user_accounts WHERE accountId = ?`).run(accountId);
  deleteUserAccountPrefRowsForAccount(db, accountId);
  deleteMcpTokenAccountRows(db, accountId);
  db.prepare(`DELETE FROM sender_identities WHERE accountId = ?`).run(accountId);
  deleteSpamRescanRowsForAccount(db, accountId);
  // Control-plane rows keyed by the address-derived id would pass to a mailbox recreated later.
  db.prepare(`DELETE FROM scheduled_sends WHERE accountId = ?`).run(accountId);
  db.prepare(`DELETE FROM mailbox_watcher_auth WHERE accountId = ?`).run(accountId);
  deleteSpamSettingsRowsForAccount(db, accountId);
}
