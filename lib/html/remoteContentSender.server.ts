import type { Folder, Message, UserAccountPrefs } from "@/lib/data";
import { senderAuthPassed } from "@/lib/mail/spam/allowlist";
import { parseHeaderBlock, receivingAuthenticationResults } from "@/lib/mail/spam/input";
import { readSourceHeads } from "@/lib/mail/spam/profileBuild";
import { isOwnAddress } from "@/lib/ownAddresses";
import { getSourcesDir } from "@/lib/runtimePaths";
import { isDraftsFolder, isSentFolder } from "@/lib/specialFolders";
import { senderAllowsRemoteContent } from "./remoteContent";

export type RemoteContentSenderDecision = {
  /** Whether "always load from this sender" may apply to this message. */
  senderVerified: boolean;
  /** Whether the user's sender permission loads this message's remote images. */
  allowed: boolean;
};

type SenderCheckMessage = Pick<Message, "id" | "senderKey" | "hasSource">;

/**
 * Strict sender check on a source's raw header block: the receiving server's
 * Authentication-Results (receivingAuthenticationResults) show `spf=pass` or
 * `dkim=pass` for the domain of `senderEmail` (senderAuthPassed). Unlike the
 * spam allowlist's senderAuthAllowsEntry, no recognised Authentication-Results
 * means "not verified".
 */
export function senderVerifiedByHeaders(headers: string, senderEmail: string) {
  const domain = senderEmail.slice(senderEmail.lastIndexOf("@") + 1);
  return senderAuthPassed({ authenticationResults: receivingAuthenticationResults(parseHeaderBlock(headers)) }, domain);
}

/**
 * The strict sender check for one stored message: null when it cannot be made
 * (no sender key, source not stored or unreadable), else senderVerifiedByHeaders.
 */
async function storedSenderVerified(accountId: string, message: SenderCheckMessage, sourcesDir: string) {
  const senderKey = message.senderKey;
  if (!senderKey || !message.hasSource) return null;
  const head = (await readSourceHeads(sourcesDir, accountId, [message.id])).get(message.id);
  return head ? senderVerifiedByHeaders(head.headers, senderKey) : null;
}

/**
 * Whether the message's From address is backed by the receiving server: SPF
 * or DKIM passed for the sender's domain in its Authentication-Results. Without
 * recognised Authentication-Results, or without a stored source, the sender is
 * not verified (user decision, 2026-11-20).
 */
export async function isRemoteContentSenderVerified(
  accountId: string,
  message: SenderCheckMessage,
  sourcesDir: string = getSourcesDir()
) {
  return (await storedSenderVerified(accountId, message, sourcesDir)) === true;
}

/**
 * The stored sender permission applied to one message (A38, S31): a forged
 * From of an allowed sender does not load remote images.
 */
export async function remoteContentSenderDecision(
  prefs: UserAccountPrefs,
  accountId: string,
  message: SenderCheckMessage,
  sourcesDir?: string
): Promise<RemoteContentSenderDecision> {
  const senderVerified = await isRemoteContentSenderVerified(accountId, message, sourcesDir);
  return { senderVerified, allowed: senderVerified && senderAllowsRemoteContent(prefs, message.senderKey) };
}

/**
 * The reader's "Nicht bestätigt" signal for one opened message: true or false
 * from the strict sender check, null when it does not apply — the mailbox's
 * own mail (From is one of its addresses or identities, or the message is in
 * Sent or Drafts) and messages whose source is not stored yet.
 */
export async function messageSenderVerified(
  accountId: string,
  message: SenderCheckMessage & Pick<Message, "from" | "folderId">,
  mailbox: { ownAddresses: readonly string[]; folders: Folder[] },
  sourcesDir: string = getSourcesDir()
): Promise<boolean | null> {
  if (isSentFolder(message.folderId, mailbox.folders) || isDraftsFolder(message.folderId, mailbox.folders)) return null;
  if (isOwnAddress(message.senderKey ?? message.from, mailbox.ownAddresses)) return null;
  return storedSenderVerified(accountId, message, sourcesDir);
}
