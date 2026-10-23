import type { Account, AccountRole } from "@/lib/data";

/** Mailbox and member list order: display name (or email), normalized email, then id. */
export function compareDisplayOrder(a: { name?: string | null; email: string; id: string }, b: { name?: string | null; email: string; id: string }) {
  return (a.name || a.email).localeCompare(b.name || b.email, "en") ||
    a.email.trim().toLowerCase().localeCompare(b.email.trim().toLowerCase(), "en") || a.id.localeCompare(b.id, "en");
}

export function sanitizeAccountForClient(account: Account, options: { role: AccountRole; viewerUserId: string; memberCount: number }): Account {
  const manager = options.role === "manager";
  return {
    ...account,
    accessRole: options.role,
    isOwner: account.ownerUserId === options.viewerUserId,
    shared: options.memberCount > 1,
    imap: {
      ...account.imap,
      host: manager ? account.imap.host : "",
      user: manager ? account.imap.user : "",
      password: ""
    },
    smtp: {
      ...account.smtp,
      host: manager ? account.smtp.host : "",
      user: manager ? account.smtp.user : "",
      password: ""
    },
    caldav: manager && account.caldav
      ? {
          ...account.caldav,
          password: ""
        }
      : undefined,
    deepl: account.deepl
      ? {
          enabled: account.deepl.enabled,
          targetLang: account.deepl.targetLang,
          // Never send the DeepL key to the browser; expose only whether one
          // is stored so the settings UI can show a "configured" state.
          ...(manager ? { apiKey: "", hasApiKey: Boolean(account.deepl.apiKey && account.deepl.apiKey.trim()) } : {})
        }
      : undefined
  };
}

/** Client DTOs for one access read (the entries of an `AccountAccessSnapshot`). */
export function sanitizeAccessEntriesForClient(userId: string, entries: ReadonlyArray<{ account: Account; role: AccountRole; memberCount: number }>) {
  return entries.map(({ account, role, memberCount }) => sanitizeAccountForClient(account, { role, viewerUserId: userId, memberCount }));
}

export async function sanitizeAccountsForClient(userId: string) {
  const { listAccessibleAccountsForUser } = await import("./accountAccess");
  return sanitizeAccessEntriesForClient(userId, await listAccessibleAccountsForUser(userId));
}
