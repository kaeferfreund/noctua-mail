import { moveMessageToJunk } from "@/app/api/_helpers/message/junkMove";
import type { Message } from "@/lib/data";
import { getAccountById } from "@/lib/serverDb";
import { recordSpamDecision, type SpamExampleSource } from "./examples";

/**
 * "Als Spam" without a request (POST …/messages/:id/spam without the trust
 * revocation): Junk folder resolution, `$NotJunk` cleanup on IMAP, move and
 * local relocation, flag cleanup and a spam example. Used by
 * `scripts/spam-apply.ts` and the admin rescan's move (rescan.ts).
 * `datedAtArrival` dates the example at the mail's `dateValue`, so backfilled
 * decisions do not crowd the users' recent ones out of the prompt. Tests pass
 * `moveToJunk` instead of the IMAP move.
 */
export async function moveMessageToJunkAsSpam(params: {
  accountId: string;
  message: Message;
  source: SpamExampleSource;
  userId: string | null;
  datedAtArrival?: boolean;
  moveToJunk?: typeof moveMessageToJunk;
}) {
  const { accountId, message } = params;
  if (typeof message.imapUid !== "number" || !message.mailboxPath) throw new Error("message is missing IMAP metadata");
  const account = await getAccountById(accountId);
  if (!account) throw new Error("account not found");
  const moved = await (params.moveToJunk ?? moveMessageToJunk)({ account, accountId, message: { ...message, imapUid: message.imapUid, mailboxPath: message.mailboxPath } });
  await recordSpamDecision({ accountId, message, label: "spam", source: params.source, userId: params.userId,
    createdAt: params.datedAtArrival && Number.isFinite(message.dateValue) ? message.dateValue : undefined });
  return moved;
}
