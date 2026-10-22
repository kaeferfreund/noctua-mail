import type { Account } from "@/lib/data";
import { withPooledImapClient } from "./connectionPool";
import { buildLogContext } from "./_shared";

/** UIDPLUS fallback. A successful APPEND without a UID must never be appended again. */
export async function findImapMessageUid(account: Account, mailbox: string, messageId: string, clientId?: string) {
  return withPooledImapClient(account, buildLogContext(account, clientId), async client => {
    await client.mailboxOpen(mailbox);
    const uids = await client.search({ header: { "Message-ID": messageId } }, { uid: true });
    return uids && uids.length ? Math.max(...uids) : null;
  });
}
