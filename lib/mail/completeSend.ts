import { postSendDeadlineAt, throwIfImapCancelled, withImapDeadline } from "./imapCancellation";
import type { Account } from "@/lib/data";
import type { CollabActor } from "@/lib/threadCollab";
import { recordReplySent, listReplySourceMessageIds } from "@/lib/threadCollab";
import { getFolders, getMessageById, saveFoldersForAccount, resolveThreadingForAccountMessages, upsertMessages } from "@/lib/serverDb";
import { appendImapMessage, findImapMessageUid, listImapFolders, syncImapMessage } from "@/lib/serverImap";
import { applyFlagMutationsToMessage } from "@/lib/messageFlagMutation";
import { DONE_FLAG, TODO_FLAG, hasDoneFlag, hasTodoFlag } from "@/lib/messageFlags";
import { findSentFolder } from "@/lib/specialFolders";
import { folderMailboxPath } from "@/lib/mailboxPaths";
import { sanitizeSyncedMessage } from "./syncMessageSanitizer";

export type SentCopyResult = {
  sentCopy: "appended" | "failed" | "no-sent-folder";
  sentFolderId: string | null;
  sentMessageUid: number | null;
  messageId: string;
  sentCopyWarning: string | null;
  postSendWarning: string | null;
};
function isMissingFolder(error: unknown) {
  const failure = error as { responseCode?: string; responseText?: string; message?: string };
  return /TRYCREATE|NONEXISTENT/i.test(failure?.responseCode ?? "") ||
    /(?:mailbox|folder).*(?:not found|does not exist|doesn.t exist|nonexistent|unknown)|(?:no such|unknown).*(?:mailbox|folder)/i
      .test(`${failure?.responseText ?? ""} ${failure?.message ?? ""}`);
}

/** Only call after SMTP acceptance. Nothing here can turn delivery into a send failure. */
export async function completeSend(params: {
  account: Account; raw: Buffer; messageId: string; actor: CollabActor; clientId?: string;
  inReplyTo?: string; references?: string[]; xForwardedMessageId?: string; deadlineAt?: number;
}): Promise<SentCopyResult> {
  const { account, raw, messageId, actor, clientId } = params;
  const result: SentCopyResult = { sentCopy: "failed", sentFolderId: null, sentMessageUid: null,
    messageId, sentCopyWarning: null, postSendWarning: null };
  const deadlineAt = params.deadlineAt ?? postSendDeadlineAt();
  // Attribution is local and must be durable before any possibly stalled IMAP work.
  try { await recordReplySent(account.id, params, actor); }
  catch (error) {
    console.warn("[send] attribution failed after SMTP acceptance", { accountId: account.id, error });
    result.postSendWarning = "Email sent, but recording send activity failed.";
  }
  try {
    await withImapDeadline(deadlineAt, async () => {
      try {
        let folder = findSentFolder(await getFolders(account.id), account.id);
        if (!folder) {
          const folders = await listImapFolders(account, clientId);
          await saveFoldersForAccount(account.id, folders);
          folder = findSentFolder(folders, account.id);
        }
        if (!folder) {
          result.sentCopy = "no-sent-folder";
          result.sentCopyWarning = "Email sent, but no Sent folder is available. Do not send it again.";
        } else {
          result.sentFolderId = folder.id;
          let mailbox = folderMailboxPath(folder, account.id);
          let uid: number | null;
          try { uid = await appendImapMessage(account, mailbox, raw, ["\\Seen"], clientId); }
          catch (error) {
            throwIfImapCancelled();
            if (isMissingFolder(error)) {
              const folders = await listImapFolders(account, clientId);
              await saveFoldersForAccount(account.id, folders);
              folder = findSentFolder(folders, account.id);
              if (!folder) {
                result.sentFolderId = null;
                result.sentCopy = "no-sent-folder";
                result.sentCopyWarning = "Email sent, but no Sent folder is available. Do not send it again.";
              } else {
                mailbox = folderMailboxPath(folder, account.id);
                result.sentFolderId = folder.id;
              }
            }
            if (!folder) throw new Error("No Sent folder after refresh");
            // An APPEND can commit before its tagged OK is lost. Search on a fresh
            // connection before the one permitted retry, including definite rejections.
            uid = await findImapMessageUid(account, mailbox, messageId, clientId, { fresh: true });
            if (!uid) uid = await appendImapMessage(account, mailbox, raw, ["\\Seen"], clientId);
          }
          uid ??= await findImapMessageUid(account, mailbox, messageId, clientId);
          result.sentMessageUid = uid;
          if (!uid) throw new Error("Cannot locate the accepted Sent copy");
          const message = await syncImapMessage(account, mailbox, uid, clientId);
          if (!message) throw new Error("Cannot read the accepted Sent copy");
          const [threaded] = await resolveThreadingForAccountMessages(account.id, [message]);
          throwIfImapCancelled();
          const original = threaded ?? message;
          const sanitized = await sanitizeSyncedMessage(original, account.id);
          throwIfImapCancelled();
          await upsertMessages(account.id, null, [sanitized], false);
          result.sentCopy = "appended";
        }
      } catch (error) {
        throwIfImapCancelled();
        console.warn("[send] Sent copy failed after SMTP acceptance", { accountId: account.id, error });
        if (result.sentCopy !== "no-sent-folder") result.sentCopyWarning = "Email sent, but saving or indexing the Sent copy failed. Do not send it again.";
      }
      // Attempt each flag independently within the same absolute budget.
      for (const [parent, flag] of [[params.xForwardedMessageId ? undefined : params.inReplyTo, "answered"], [params.xForwardedMessageId, "$Forwarded"]] as const) {
        if (!parent) continue;
        try {
          const rows = await listReplySourceMessageIds(account.id, parent);
          for (const row of rows) {
            const message = await getMessageById(account.id, row.id);
            if (!message) continue;
            const flags = await applyFlagMutationsToMessage({ accountId: account.id, account, messageId: row.id, message,
              ...(flag === "answered" ? { flag } : { keyword: flag }), value: true, clientId });
            // Replying to a to-do completes it, the same transition as marking it done by hand.
            if (flag === "answered" && hasTodoFlag(flags)) {
              const withoutTodo = await applyFlagMutationsToMessage({ accountId: account.id, account, messageId: row.id,
                message: { ...message, flags }, keyword: TODO_FLAG, value: false, clientId });
              if (!hasDoneFlag(withoutTodo)) await applyFlagMutationsToMessage({ accountId: account.id, account,
                messageId: row.id, message: { ...message, flags: withoutTodo }, keyword: DONE_FLAG, value: true, clientId });
            }
          }
        } catch (error) {
          throwIfImapCancelled();
          console.warn("[send] reply flag update failed after SMTP acceptance", { accountId: account.id, error });
          result.postSendWarning = "Email sent, but updating reply, forward or to-do flags failed.";
        }
      }
    });
  } catch (error) {
    console.warn("[send] post-send deadline exceeded", { accountId: account.id, error });
    result.sentCopy = "failed";
    result.sentCopyWarning = "Email sent, but post-send processing timed out. Do not send it again.";
    result.postSendWarning = [result.postSendWarning, "Email sent, but updating reply, forward or to-do flags may be incomplete."].filter(Boolean).join(" ");
  }
  return { ...result };
}
