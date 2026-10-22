import type { Account } from "@/lib/data";
import type { CollabActor } from "@/lib/threadCollab";
import { recordReplySent, listReplySourceMessageIds } from "@/lib/threadCollab";
import { getFolders, getMessageById, saveFoldersForAccount, resolveThreadingForAccountMessages, upsertMessages } from "@/lib/serverDb";
import { appendImapMessage, findImapMessageUid, listImapFolders, syncImapMessage } from "@/lib/serverImap";
import { applyFlagMutationsToMessage } from "@/lib/messageFlagMutation";
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
/** Only call after SMTP acceptance. Nothing here can turn delivery into a send failure. */
export async function completeSend(params: {
  account: Account; raw: Buffer; messageId: string; actor: CollabActor; clientId?: string;
  inReplyTo?: string; references?: string[]; xForwardedMessageId?: string;
}): Promise<SentCopyResult> {
  const { account, raw, messageId, actor, clientId } = params;
  const result: SentCopyResult = { sentCopy: "failed", sentFolderId: null, sentMessageUid: null,
    messageId, sentCopyWarning: null, postSendWarning: null };
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
      const mailbox = folderMailboxPath(folder, account.id);
      let uid: number | null;
      try { uid = await appendImapMessage(account, mailbox, raw, ["\\Seen"], clientId); }
      catch {
        // Pool evicts failures. Explicit fresh acquisition also bypasses a concurrent cached release.
        uid = await appendImapMessage(account, mailbox, raw, ["\\Seen"], clientId, new Date(), { fresh: true });
      }
      uid ??= await findImapMessageUid(account, mailbox, messageId, clientId);
      result.sentMessageUid = uid;
      if (!uid) throw new Error("Cannot locate the accepted Sent copy");
      const message = await syncImapMessage(account, mailbox, uid, clientId);
      if (!message) throw new Error("Cannot read the accepted Sent copy");
      const [threaded] = await resolveThreadingForAccountMessages(account.id, [message]);
      const sanitized = await sanitizeSyncedMessage(threaded ?? message, account.id);
      await upsertMessages(account.id, null, [sanitized], false);
      result.sentCopy = "appended";
    }
  } catch (error) {
    console.warn("[send] Sent copy failed after SMTP acceptance", { accountId: account.id, error });
    result.sentCopyWarning = "Email sent, but saving or indexing the Sent copy failed. Do not send it again.";
  }
  // Attempt each flag independently; attribution still runs if an upstream flag update fails.
  for (const [parent, flag] of [[params.xForwardedMessageId ? undefined : params.inReplyTo, "answered"], [params.xForwardedMessageId, "$Forwarded"]] as const) {
    if (!parent) continue;
    try {
      const rows = await listReplySourceMessageIds(account.id, parent);
      for (const row of rows) {
        const message = await getMessageById(account.id, row.id);
        if (!message) continue;
        await applyFlagMutationsToMessage({ accountId: account.id, account, messageId: row.id, message,
          ...(flag === "answered" ? { flag } : { keyword: flag }), value: true, clientId });
      }
    } catch (error) {
      console.warn("[send] reply flag update failed after SMTP acceptance", { accountId: account.id, error });
      result.postSendWarning = "Email sent, but updating reply or forward flags failed.";
    }
  }
  try { await recordReplySent(account.id, params, actor); }
  catch (error) {
    console.warn("[send] attribution failed after SMTP acceptance", { accountId: account.id, error });
    result.postSendWarning = "Email sent, but recording send activity failed.";
  }
  return result;
}
