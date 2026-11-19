import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startSmtpSink } from "@/lib/testFixtures/mail/smtp-sink";
import type { Account } from "@/lib/data";
import { markSmtpUpstreamFailure } from "@/lib/mail/smtpError";
import { defaultOutreachSettings } from "../settings";
import { isSesConfigured, sendOutreachMail, defaultSendDependencies } from "./send";

const settings = { ...defaultOutreachSettings("acct"), enabled: true, transport: "mailbox-smtp" as const };
const input: Parameters<typeof sendOutreachMail>[0] = {
  settings, sendId: "send", recipient: { contactId: "contact" }, content: { subject: "Hallo {{first_name}}", html: "<p>Willkommen</p>", text: "" },
  authorization: { scheduledByUserId: "editor" }, identityId: "sender", trackOpens: true, trackClicks: true,
  assertClaim() {}
};
const contact = { contactId: "contact", email: "alex@example.test", firstName: "Alex", lastName: "Muster", properties: {} };
const unsubscribe = { url: "https://links.example.test/t/u/token", oneClickUrl: "https://links.example.test/t/u/one-click" };

function fixture() {
  const mails: Array<Parameters<typeof defaultSendDependencies.transport["mailbox-smtp"]>[0]> = [];
  const tracked: Array<Parameters<typeof defaultSendDependencies.track>[0]> = [];
  const deps: typeof defaultSendDependencies = {
    ...defaultSendDependencies, now: () => 1000,
    getAccount: async () => ({ smtp: { host: "smtp.example.test", port: 587, secure: false, user: "test", password: "synthetic" } }) as Account,
    resolveIdentity: async () => ({ id: "sender", email: "sender@example.test", displayName: "Sender", replyTo: "" }),
    authorize: async (_source, params) => {
      expect(params.minRole).toBe("editor");
      return { userId: "editor", clientId: "test", assertCurrent() {} };
    },
    prepareAssertion: async () => () => {},
    findRecipient: async () => contact,
    unsubscribeUrls: async () => unsubscribe,
    track: async request => { tracked.push(request); return request.html; },
    origin: () => "https://links.example.test",
    transport: { ...defaultSendDependencies.transport, "mailbox-smtp": async (mail, _account, _sender, beforeSend) => {
      (await beforeSend())();
      mails.push(mail);
      return { messageId: mail.messageId, providerMessageId: "provider-test" };
    } }
  };
  return { deps, mails, tracked };
}

test("send adds an unsubscribe footer, one-click headers and preserves the URLs from tracking", async () => {
  const { deps, mails, tracked } = fixture();
  expect(await sendOutreachMail(input, deps)).toMatchObject({ status: "sent", subject: "Hallo Alex", providerMessageId: "provider-test", sentAt: 1000 });
  expect(mails).toHaveLength(1);
  expect(mails[0].html).toContain('<a href="https://links.example.test/t/u/token">Abmelden</a>');
  expect(mails[0].text).toContain(unsubscribe.url);
  expect(mails[0].headers).toEqual({
    "List-Unsubscribe": `<${unsubscribe.oneClickUrl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click"
  });
  expect(tracked[0].keepUrls).toEqual([unsubscribe.url, unsubscribe.oneClickUrl]);
});

test("send does not add a second footer for a real unsubscribe anchor", async () => {
  const { deps, mails } = fixture();
  await sendOutreachMail({ ...input, content: { ...input.content, html: "{% unsubscribe 'Abmelden' %}" } }, deps);
  expect(mails[0].html.match(/<a\b/g)).toHaveLength(1);
});

test("send skips loss of consent during preparation and fails closed without unsubscribe URLs", async () => {
  const { deps, mails } = fixture();
  let checks = 0;
  deps.findRecipient = async () => ++checks === 1 ? contact : null;
  expect(await sendOutreachMail(input, deps)).toEqual({ status: "skipped", reason: "recipient_unmailable" });
  deps.findRecipient = async () => null;
  expect(await sendOutreachMail(input, deps)).toEqual({ status: "skipped", reason: "recipient_unmailable" });
  deps.findRecipient = async () => contact;
  deps.unsubscribeUrls = async () => null;
  expect(await sendOutreachMail(input, deps)).toEqual({ status: "deferred", reason: "unsubscribe_unavailable" });
  expect(mails).toHaveLength(0);
});

test("test send does not consult consent or issue a real unsubscribe token", async () => {
  const { deps, mails } = fixture();
  deps.findRecipient = async () => { throw new Error("must not check"); };
  deps.unsubscribeUrls = async () => { throw new Error("must not issue a contact token"); };
  const recipient = { testAddress: "test@example.test", sample: contact };
  expect(await sendOutreachMail({ ...input, recipient }, deps)).toMatchObject({ status: "sent" });
  expect(mails[0].to).toBe(recipient.testAddress);
  expect(mails[0].html).not.toContain(unsubscribe.url);
});

test("retries pre-transport and pre-DATA failures, never an uncertain DATA outcome", async () => {
  const { deps } = fixture();
  deps.transport["mailbox-smtp"] = async () => { throw new Error("before transport"); };
  expect(await sendOutreachMail(input, deps)).toMatchObject({ status: "retry", reason: "pre_transport_failure" });
  const smtpError = (code: string, command: string, responseCode?: number) => {
    deps.transport["mailbox-smtp"] = async (_mail, _account, _identity, beforeSend) => {
      (await beforeSend())();
      throw markSmtpUpstreamFailure(Object.assign(new Error("synthetic"), { code, command, responseCode }));
    };
  };
  smtpError("EENVELOPE", "RCPT TO", 450);
  expect(await sendOutreachMail(input, deps)).toEqual({ status: "retry", reason: "smtp_before_data" });
  smtpError("EENVELOPE", "RCPT TO", 550);
  expect(await sendOutreachMail(input, deps)).toEqual({ status: "failed", reason: "smtp_recipient_rejected" });
  smtpError("ESOCKET", "DATA");
  expect(await sendOutreachMail(input, deps)).toEqual({ status: "failed", reason: "send_uncertain" });
});

test("SES configuration requires the selected region and standard environment credentials", () => {
  const env = { NOCTUA_OUTREACH_SES_REGION: "eu-central-1", AWS_ACCESS_KEY_ID: "synthetic", AWS_SECRET_ACCESS_KEY: "synthetic" };
  expect(isSesConfigured(env)).toBe(true);
  expect(isSesConfigured({ ...env, AWS_SECRET_ACCESS_KEY: "" })).toBe(false);
});

test("does not retry an SES failure once the call has started", async () => {
  const { deps } = fixture();
  deps.sesConfigured = () => true;
  deps.transport.ses = async () => { throw new Error("MIME preparation failed"); };
  const ses = { ...input, settings: { ...settings, transport: "ses" as const } };
  expect(await sendOutreachMail(ses, deps)).toEqual({ status: "retry", reason: "pre_transport_failure" });
  deps.transport.ses = async (_mail, _account, _identity, beforeSend) => {
    (await beforeSend())();
    throw new Error("SDK request failed");
  };
  expect(await sendOutreachMail(ses, deps)).toEqual({ status: "failed", reason: "send_uncertain" });
});

test("SMTP rechecks consent after RCPT and aborts DATA without accepting a message", async () => {
  const { deps } = fixture();
  const scratch = await mkdtemp(join(tmpdir(), "outreach-smtp-"));
  let unsubscribed = false;
  let revokeAtEnvelope = true;
  const sink = await startSmtpSink({ port: 0, user: "test", pass: "synthetic", out: scratch,
    rejectRecipient: () => { if (revokeAtEnvelope) unsubscribed = true; return undefined; }
  });
  try {
    deps.getAccount = async () => ({ smtp: { host: "127.0.0.1", port: sink.port, secure: false, user: "test", password: "synthetic" } }) as Account;
    deps.findRecipient = async () => unsubscribed ? null : contact;
    deps.transport["mailbox-smtp"] = defaultSendDependencies.transport["mailbox-smtp"];
    expect(await sendOutreachMail(input, deps)).toEqual({ status: "skipped", reason: "recipient_unmailable" });
    expect(unsubscribed).toBe(true);
    expect(sink.received).toHaveLength(0);

    revokeAtEnvelope = false;
    unsubscribed = false;
    expect(await sendOutreachMail(input, deps)).toMatchObject({ status: "sent" });
    expect(sink.received).toHaveLength(1);
    expect(sink.received[0].source.toString()).toContain("Subject: Hallo Alex");
  } finally {
    await sink.stop();
    await rm(scratch, { recursive: true });
  }
});

test("send adds a visible unsubscribe footer after inert template and hidden links", async () => {
  const { deps, mails } = fixture();
  const anchor = '<a href="{{ unsubscribe_url }}">Abmelden</a>';
  const html = `<!-- leading comment --><html><body><template>${anchor}</template>
    <div hidden>${anchor}</div><style>/* </body> */</style><p>Visible</p></body></html>`;
  await sendOutreachMail({ ...input, content: { ...input.content, html } }, deps);
  expect(mails[0].html).toContain(`<p>Visible</p><p><a href="${unsubscribe.url}">Abmelden</a></p></body>`);
  expect(mails[0].html).toContain("<style>/* </body> */</style>");
});
