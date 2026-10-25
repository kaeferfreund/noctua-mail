import { senderMessages } from "@/lib/senderMessages";
const messages: Record<string, string> = {
  identity_unavailable: senderMessages.identityUnavailable,
  identity_not_found: senderMessages.identityUnavailable,
  draft_identity_changed: senderMessages.draftIdentityChanged,
  smtp_sender_rejected: senderMessages.senderRejected,
  smtp_recipient_rejected: senderMessages.recipientRejected,
  smtp_message_rejected: senderMessages.messageRejected,
  smtp_temporary_failure: senderMessages.providerTemporary,
  smtp_configuration_error: senderMessages.providerConfiguration,
  smtp_connection_failed: senderMessages.providerConnection,
  smtp_upstream_error: senderMessages.providerFailure,
  smtp_connection_timeout: senderMessages.connectionTimeout,
  smtp_greeting_timeout: senderMessages.greetingTimeout,
  smtp_server_timeout: senderMessages.deliveryUncertain
};
export type SenderMessageAction = "sender" | "recipients" | null;
const recipientActionMessages = new Set<string>([senderMessages.recipientRejected]);
// Problems another sender identity can solve. Everything else (delivery or provider
// failures, generic save/send errors from `readErrorMessage`) gets no field link.
const senderActionMessages = new Set<string>([
  senderMessages.identityUnavailable,
  senderMessages.draftIdentityChanged,
  senderMessages.senderRejected,
  senderMessages.chooseEnabledSender,
  senderMessages.identityLoadFailed
]);
/** Which compose field the inline notice below "From" should point to.
 * Without an error the notice shows sender warnings, which belong to "From". */
export function senderMessageAction(message: string | null | undefined): SenderMessageAction {
  if (!message) return "sender";
  if (recipientActionMessages.has(message)) return "recipients";
  return senderActionMessages.has(message) ? "sender" : null;
}
export async function readSenderError(response: Response, fallback: (response: Response) => Promise<string>) {
  const data = await response.clone().json().catch(() => null) as { code?: string } | null;
  return (data?.code && messages[data.code]) || await fallback(response);
}
