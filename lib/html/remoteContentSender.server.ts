import type { Message, UserAccountPrefs } from "@/lib/data";
import { senderAuthAllowsEntry } from "@/lib/mail/spam/allowlist";
import { parseHeaderBlock, receivingAuthenticationResults } from "@/lib/mail/spam/input";
import { readSourceHeads } from "@/lib/mail/spam/profileBuild";
import { getSourcesDir } from "@/lib/runtimePaths";
import { senderAllowsRemoteContent } from "./remoteContent";

export type RemoteContentSenderDecision = {
  /** Whether "always load from this sender" may apply to this message. */
  senderVerified: boolean;
  /** Whether the user's sender permission loads this message's remote images. */
  allowed: boolean;
};

/**
 * Whether the message's From address is backed by the receiving server, with
 * the spam allowlist's sender-trust rule (senderAuthAllowsEntry): SPF or DKIM
 * passed for the sender's domain in the receiving server's
 * Authentication-Results. Without any Authentication-Results (or without a
 * stored source) there is no signal; the permission then stays bound to this
 * mailbox, this user and the exact address, as it is stored.
 */
export async function isRemoteContentSenderVerified(
  accountId: string,
  message: Pick<Message, "id" | "senderKey" | "hasSource">,
  sourcesDir: string = getSourcesDir()
) {
  const senderKey = message.senderKey;
  if (!senderKey) return false;
  if (!message.hasSource) return true;
  const head = (await readSourceHeads(sourcesDir, accountId, [message.id])).get(message.id);
  if (!head) return true;
  const authenticationResults = receivingAuthenticationResults(parseHeaderBlock(head.headers));
  return senderAuthAllowsEntry({ authenticationResults }, senderKey.slice(senderKey.lastIndexOf("@") + 1));
}

/**
 * The stored sender permission applied to one message (A38, S31): a forged
 * From of an allowed sender does not load remote images.
 */
export async function remoteContentSenderDecision(
  prefs: UserAccountPrefs,
  accountId: string,
  message: Pick<Message, "id" | "senderKey" | "hasSource">,
  sourcesDir?: string
): Promise<RemoteContentSenderDecision> {
  const senderVerified = await isRemoteContentSenderVerified(accountId, message, sourcesDir);
  return { senderVerified, allowed: senderVerified && senderAllowsRemoteContent(prefs, message.senderKey) };
}
