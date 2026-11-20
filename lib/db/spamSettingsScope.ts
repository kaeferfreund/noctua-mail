/**
 * Scopes of the master table `spam_settings`: "global" for the admin settings, `account:<id>` for
 * a mailbox, and the bare mailbox id for rows written before the prefix. Pure, so the deletion
 * path and the orphan purge script share it with lib/mail/spam/settings.ts.
 */
export const GLOBAL_SPAM_SCOPE = "global";
const MAILBOX_SCOPE_PREFIX = "account:";

/** Mailbox rows are keyed `account:<id>`, so no account id can address the global row. */
export const mailboxSpamScope = (accountId: string) => `${MAILBOX_SCOPE_PREFIX}${accountId}`;

/** Rows written before the prefix used the bare account id; never "global" or an id that looks prefixed. */
export function legacyMailboxSpamScope(accountId: string) {
  return accountId === GLOBAL_SPAM_SCOPE || accountId.startsWith(MAILBOX_SCOPE_PREFIX) ? undefined : accountId;
}

/** The mailbox a stored scope belongs to; null for the global row. */
export function spamScopeAccountId(scope: string) {
  if (scope === GLOBAL_SPAM_SCOPE) return null;
  return scope.startsWith(MAILBOX_SCOPE_PREFIX) ? scope.slice(MAILBOX_SCOPE_PREFIX.length) : scope;
}

/** Removes the mailbox's own settings rows (both scope spellings); never the global row. */
export function deleteSpamSettingsRowsForAccount(db: any, accountId: string) {
  db.prepare(`DELETE FROM spam_settings WHERE scope = ?`).run(mailboxSpamScope(accountId));
  const legacy = legacyMailboxSpamScope(accountId);
  if (legacy) db.prepare(`DELETE FROM spam_settings WHERE scope = ?`).run(legacy);
}
