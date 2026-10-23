const messages: Record<string, string> = {
  identity_unavailable: "This From address is unavailable. Choose an enabled sender and save the draft.",
  identity_not_found: "This From address is unavailable. Choose an enabled sender and save the draft.",
  draft_identity_changed: "The saved sender details changed. Review From and save the draft before sending.",
  smtp_sender_rejected: "The mail provider rejected this From address. Choose another sender or ask a mailbox manager to review it.",
  smtp_recipient_rejected: "The mail provider rejected a recipient. Review To, Cc and Bcc before trying again.",
  smtp_message_rejected: "The mail provider rejected this message. Review its content and attachments.",
  smtp_temporary_failure: "The mail provider is temporarily unavailable. Keep this draft and try again later.",
  smtp_configuration_error: "Sending is unavailable. Ask a mailbox manager to review the mail configuration.",
  smtp_connection_failed: "Could not connect to the mail provider. Keep this draft and try again later.",
  smtp_upstream_error: "The mail provider could not process this message. Keep this draft and contact a mailbox manager.",
  smtp_connection_timeout: "Connecting to the mail provider timed out. Keep this draft and try again later.",
  smtp_greeting_timeout: "The mail provider did not respond in time. Keep this draft and try again later.",
  smtp_server_timeout: "The mail provider timed out. Delivery may have succeeded; check Sent and with the recipient before sending again."
};
export async function readSenderError(response: Response, fallback: (response: Response) => Promise<string>) {
  const data = await response.clone().json().catch(() => null) as { code?: string } | null;
  return (data?.code && messages[data.code]) || await fallback(response);
}
