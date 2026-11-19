import { expect, test } from "bun:test";
import type { Account } from "@/lib/data";
import { markSmtpUpstreamFailure } from "@/lib/mail/smtpError";
import { defaultOutreachSettings } from "../settings";
import { defaultSendDependencies, sendOutreachMail } from "./send";

const input: Parameters<typeof sendOutreachMail>[0] = {
  settings: { ...defaultOutreachSettings("acct"), enabled: true, transport: "mailbox-smtp" },
  sendId: "send", recipient: { contactId: "contact" }, content: { subject: "Hallo", html: "<p>Willkommen</p>", text: "" },
  authorization: { scheduledByUserId: "editor" }, identityId: "sender", trackOpens: false, trackClicks: false,
  assertClaim() {}
};

function depsThatFailWith(error: Error): typeof defaultSendDependencies {
  return {
    ...defaultSendDependencies, now: () => 1000,
    getAccount: async () => ({ smtp: { host: "smtp.example.test", port: 587, secure: false, user: "test", password: "synthetic" } }) as Account,
    resolveIdentity: async () => ({ id: "sender", email: "sender@example.test", displayName: "Sender", replyTo: "" }),
    authorize: async () => ({ userId: "editor", clientId: "test", assertCurrent() {} }),
    prepareAssertion: async () => () => {},
    findRecipient: async () => ({ contactId: "contact", email: "alex@example.test", firstName: "Alex", lastName: "Muster", properties: {} }),
    unsubscribeUrls: async () => ({ url: "https://links.example.test/t/u/token", oneClickUrl: "https://links.example.test/t/u/token" }),
    track: async request => request.html,
    origin: () => "https://links.example.test",
    transport: { ...defaultSendDependencies.transport, "mailbox-smtp": async (_mail, _account, _sender, beforeSend) => {
      (await beforeSend())();
      throw error;
    } }
  };
}

const smtpError = (fields: { code: string; command?: string; responseCode?: number }) =>
  markSmtpUpstreamFailure(Object.assign(new Error("synthetic"), fields), "sender@example.test");

test("a refused SMTP login holds the mail back instead of failing the recipient", async () => {
  expect(await sendOutreachMail(input, depsThatFailWith(smtpError({ code: "EAUTH", command: "AUTH PLAIN", responseCode: 535 }))))
    .toEqual({ status: "deferred", reason: "smtp_configuration_error" });
});

test("a recipient the server refuses is still a failure of that recipient", async () => {
  expect(await sendOutreachMail(input, depsThatFailWith(smtpError({ code: "EENVELOPE", command: "RCPT TO", responseCode: 550 }))))
    .toEqual({ status: "failed", reason: "smtp_recipient_rejected" });
});
