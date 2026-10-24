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
// Delivery problems that neither another sender nor other recipients can solve.
const noActionMessages = new Set<string>([
  senderMessages.messageRejected,
  senderMessages.providerTemporary,
  senderMessages.providerConfiguration,
  senderMessages.providerConnection,
  senderMessages.providerFailure,
  senderMessages.connectionTimeout,
  senderMessages.greetingTimeout,
  senderMessages.deliveryUncertain
]);
/** Which compose field the inline notice below "From" should point to. */
export function senderMessageAction(message: string | null | undefined): SenderMessageAction {
  if (message && recipientActionMessages.has(message)) return "recipients";
  if (message && noActionMessages.has(message)) return null;
  return "sender";
}
export async function readSenderError(response: Response, fallback: (response: Response) => Promise<string>) {
  const data = await response.clone().json().catch(() => null) as { code?: string } | null;
  return (data?.code && messages[data.code]) || await fallback(response);
}
