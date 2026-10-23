import type { Message, SenderIdentity } from "./data";
import { getMessageById, getUserAccountPrefs, listSenderIdentities } from "./serverDb";
import { resolveComposeIdentity } from "./senderIdentitySelection";
import { SenderIdentityError } from "./senderIdentityError";

export type ResolvedSender = Pick<SenderIdentity, "id" | "email" | "displayName" | "replyTo">;
export const IDENTITY_HEADER = "X-Noctua-Identity-Id";

export function configuredReplyTo(identity: ResolvedSender) {
  return identity.replyTo && identity.replyTo !== identity.email ? identity.replyTo : undefined;
}

/** Live mailbox configuration only. Explicit choices never fall back. */
export async function resolveSendIdentity(input: {
  accountId: string;
  userId?: string | null;
  identityId?: unknown;
  inReplyTo?: string;
  mode?: "new" | "reply" | "forward";
  message?: Message;
}) {
  const identities = await listSenderIdentities(input.accountId);
  if (input.identityId !== undefined) {
    if (typeof input.identityId !== "string" || !input.identityId.length || input.identityId.length > 256) {
      throw new SenderIdentityError("invalid_identity", 400, "Invalid identity id");
    }
    const identity = identities.find(item => item.accountId === input.accountId && item.id === input.identityId);
    if (!identity) throw new SenderIdentityError("identity_not_found", 404, "Identity not found");
    if (!identity.enabled) throw new SenderIdentityError("identity_unavailable", 409, "Choose an enabled sender identity.");
    return identity;
  }
  const prefs = input.userId ? await getUserAccountPrefs(input.userId, input.accountId) : undefined;
  const source = input.message ?? (input.inReplyTo ? await getMessageById(input.accountId, input.inReplyTo) : null);
  const message = source?.accountId === input.accountId ? source : undefined;
  const result = resolveComposeIdentity({ accountId: input.accountId, identities, prefs,
    mode: input.mode ?? (message ? "reply" : "new"), message });
  if (!result.identity?.enabled) throw new SenderIdentityError("identity_unavailable", 409, "Choose an enabled sender identity.");
  return result.identity;
}

export function validateManagedReplyTo(identity: ResolvedSender, replyTo: unknown) {
  if (replyTo !== undefined && replyTo !== "" && replyTo !== identity.replyTo) {
    throw new SenderIdentityError("reply_to_managed", 400, "Reply-To is managed by the sender identity.");
  }
}
