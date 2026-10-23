import { expect, test } from "bun:test";
import { readSenderError } from "./senderErrors";
import { getSendWarnings } from "./sendOutcome";
for (const code of ["identity_unavailable", "identity_not_found", "draft_identity_changed", "smtp_sender_rejected", "smtp_recipient_rejected", "smtp_message_rejected", "smtp_temporary_failure", "smtp_configuration_error", "smtp_connection_failed", "smtp_upstream_error", "smtp_connection_timeout", "smtp_greeting_timeout", "smtp_server_timeout"]) test(`inline sender rejection: ${code} has actionable copy without provider details`, async () => {
  const response = new Response(JSON.stringify({ code, message: "synthetic-provider-private-detail" }), { status: code.startsWith("smtp_") ? 502 : 409 });
  const message = await readSenderError(response, async () => "fallback");
  expect(message).not.toBe("fallback"); expect(message).not.toContain("synthetic-provider-private-detail");
  if (code === "smtp_server_timeout") expect(message).toContain("Delivery may have succeeded");
  expect(response.bodyUsed).toBe(false);
});
test("unknown rejections use the established reader; accepted send warnings survive", async () => {
  expect(await readSenderError(new Response("{}", { status: 403 }), async () => "Access revoked")).toBe("Access revoked");
  expect(getSendWarnings({ sentCopy: "failed", sentCopyWarning: "Synthetic sent-copy warning", postSendWarning: "Synthetic post-send warning" })).toContain("Synthetic sent-copy warning");
  expect(getSendWarnings({ sentCopy: "failed", postSendWarning: "Synthetic post-send warning" })).toContain("Synthetic post-send warning");
});
