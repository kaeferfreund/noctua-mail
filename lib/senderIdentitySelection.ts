import type { Message, SenderIdentity, UserAccountPrefs } from "./data";
import { parseAddressEmails } from "./ownAddresses";

export type ComposeIdentityResolution = {
  identity?: SenderIdentity;
  unavailableIdentityId?: string;
  warnings: string[];
};

/** Pure, mailbox-scoped selection. A saved draft never acquires a new default. */
export function resolveComposeIdentity(input: {
  accountId: string;
  identities: readonly SenderIdentity[];
  prefs?: UserAccountPrefs;
  mode?: "new" | "reply" | "replyAll" | "forward" | "draft";
  message?: Pick<Message, "from" | "to" | "cc" | "bcc" | "originalTo" | "deliveredTo" | "senderIdentityId">;
}): ComposeIdentityResolution {
  const identities = input.identities.filter(identity => identity.accountId === input.accountId);
  const enabled = identities.filter(identity => identity.enabled);
  const personal = enabled.find(identity => identity.id === input.prefs?.defaultIdentityId);
  const mailbox = enabled.find(identity => identity.isDefault);
  const warnings = input.prefs?.defaultIdentityId && !personal
    ? ["Your default identity is unavailable. Choose an enabled identity in Preferences, or re-enable it."] : [];
  const message = input.message;
  if (input.mode === "draft" && message) {
    const from = parseAddressEmails(message.from);
    const identity = message.senderIdentityId
      ? identities.find(identity => identity.id === message.senderIdentityId)
      : from.length === 1 ? identities.find(identity => identity.email === from[0]) : undefined;
    return { identity, unavailableIdentityId: identity?.enabled ? undefined : message.senderIdentityId ?? identity?.id,
      warnings: identity?.enabled ? warnings : [...warnings, "The saved draft identity is unavailable. Review From and save the draft."] };
  }
  if ((input.mode === "reply" || input.mode === "replyAll") && message) {
    const tiers = [parseAddressEmails(message.from), parseAddressEmails(message.to),
      parseAddressEmails(message.cc), parseAddressEmails(message.bcc), message.originalTo ?? [], message.deliveredTo ?? []];
    for (const addresses of tiers) {
      const matches = enabled.filter(identity => addresses.includes(identity.email));
      if (!matches.length) continue;
      const identity = matches.find(identity => identity.id === personal?.id) ??
        matches.find(identity => identity.id === mailbox?.id) ??
        matches.sort((a, b) => addresses.indexOf(a.email) - addresses.indexOf(b.email) || a.id.localeCompare(b.id))[0];
      return { identity, warnings };
    }
  }
  return { identity: personal ?? mailbox, warnings };
}
