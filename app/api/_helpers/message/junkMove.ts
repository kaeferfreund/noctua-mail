import { updateMessageFlags } from "@/lib/db";
import type { Account, Message } from "@/lib/data";
import { withoutNonJunkAndRecentFlags } from "@/lib/messageFlags";
import { findJunkFolder } from "@/lib/specialFolders";
import { moveAndRelocateMessageWithFiles, resolveSpecialFolderAndMailbox } from "./routeHelpers";
import { clearImapNonJunkFlags } from "./flagMutationHelpers";

/**
 * Moves a message to the account's Junk folder: clears $NotJunk-style
 * keywords on IMAP, moves the message and relocates the local row and files.
 * Shared by "Als Spam" and the spam detector's per-mailbox auto-move.
 */
export async function moveMessageToJunk(params: {
  account: Account;
  accountId: string;
  message: Pick<Message, "id" | "folderId" | "flags"> & { mailboxPath: string; imapUid: number };
  clientId?: string;
}) {
  const { account, accountId, message, clientId } = params;
  const { folder: junkFolder, mailbox: junkMailbox } = await resolveSpecialFolderAndMailbox(
    accountId,
    findJunkFolder,
    { fallbackMailbox: "Junk" }
  );
  const junkMailboxPath = junkMailbox ?? "Junk";
  const currentMailbox = message.mailboxPath;

  const existingFlags = message.flags ?? [];
  await clearImapNonJunkFlags(account, currentMailbox, message.imapUid, existingFlags, clientId);

  const { relocated } = await moveAndRelocateMessageWithFiles({
    account,
    currentMailbox,
    imapUid: message.imapUid,
    destinationMailbox: junkMailboxPath,
    clientId,
    accountId,
    previousId: message.id,
    destinationFolderId: junkFolder?.id ?? message.folderId
  });

  const cleanedFlags = withoutNonJunkAndRecentFlags(existingFlags);
  if (cleanedFlags.length !== existingFlags.length) {
    await updateMessageFlags(accountId, relocated?.nextId ?? message.id, cleanedFlags);
  }
  return {
    junkFolderId: junkFolder?.id ?? null,
    junkMailbox: junkMailboxPath,
    flags: cleanedFlags.length !== existingFlags.length ? cleanedFlags : existingFlags,
    previousMessageId: relocated?.previousId ?? message.id,
    messageId: relocated?.nextId ?? message.id
  };
}
