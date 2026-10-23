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
export async function readSenderError(response: Response, fallback: (response: Response) => Promise<string>) {
  const data = await response.clone().json().catch(() => null) as { code?: string } | null;
  return (data?.code && messages[data.code]) || await fallback(response);
}
