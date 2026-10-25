import { expect, test } from "bun:test";
import { getTranslator } from "@/lib/i18n/translator";
import { senderMessages, type SenderMessageId } from "@/lib/senderMessages";
import { readSenderError, senderMessageAction } from "./senderErrors";
import { getSendWarnings } from "./sendOutcome";
for (const code of ["identity_unavailable", "identity_not_found", "draft_identity_changed", "smtp_sender_rejected", "smtp_recipient_rejected", "smtp_message_rejected", "smtp_temporary_failure", "smtp_configuration_error", "smtp_connection_failed", "smtp_upstream_error", "smtp_connection_timeout", "smtp_greeting_timeout", "smtp_server_timeout"]) test(`inline sender rejection: ${code} has actionable copy without provider details`, async () => {
  const response = new Response(JSON.stringify({ code, message: "synthetic-provider-private-detail" }), { status: code.startsWith("smtp_") ? 502 : 409 });
  const message = await readSenderError(response, async () => "fallback");
  expect(message).not.toBe("fallback"); expect(message).not.toContain("synthetic-provider-private-detail");
  if (code === "smtp_server_timeout") expect(getTranslator("en")(message as SenderMessageId)).toContain("Delivery may have succeeded");
  expect(response.bodyUsed).toBe(false);
});
test("unknown rejections use the established reader; accepted send warnings survive", async () => {
  expect(await readSenderError(new Response("{}", { status: 403 }), async () => "Access revoked")).toBe("Access revoked");
  expect(getSendWarnings({ sentCopy: "failed", sentCopyWarning: "Synthetic sent-copy warning", postSendWarning: "Synthetic post-send warning" })).toContain("Synthetic sent-copy warning");
  expect(getSendWarnings({ sentCopy: "failed", postSendWarning: "Synthetic post-send warning" })).toContain("Synthetic post-send warning");
});
test("QA-211: only sender problems link to the sender, recipient rejections to the recipients", async () => {
  const actionFor = async (code: string) => senderMessageAction(await readSenderError(new Response(JSON.stringify({ code }), { status: 502 }), async () => "fallback"));
  expect(await actionFor("smtp_recipient_rejected")).toBe("recipients");
  for (const code of ["smtp_temporary_failure", "smtp_message_rejected", "smtp_configuration_error", "smtp_connection_failed", "smtp_upstream_error", "smtp_connection_timeout", "smtp_greeting_timeout", "smtp_server_timeout"]) expect(await actionFor(code)).toBeNull();
  for (const code of ["smtp_sender_rejected", "identity_unavailable", "identity_not_found", "draft_identity_changed"]) expect(await actionFor(code)).toBe("sender");
  expect(senderMessageAction(null)).toBe("sender");
});
test("generic save/send errors without a sender code get no sender link", async () => {
  const action = senderMessageAction(await readSenderError(new Response(JSON.stringify({ message: "Speichern fehlgeschlagen" }), { status: 500 }), async () => "Speichern fehlgeschlagen"));
  expect(action).toBeNull();
  expect(senderMessageAction("Compose.drafts.saveFailed")).toBeNull();
  expect(senderMessageAction(senderMessages.chooseEnabledSender)).toBe("sender");
  expect(senderMessageAction(senderMessages.identityLoadFailed)).toBe("sender");
});
