import { expect, test } from "bun:test";
import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { SESv2Client } from "@aws-sdk/client-sesv2";
import type { Account } from "@/lib/data";
import { OutboundAuthorizationError } from "@/lib/outboundAuthorization";
import { SenderIdentityError } from "@/lib/senderIdentityError";
import { defaultOutreachSettings } from "../settings";
import { createSesTransport, defaultSendDependencies, sendOutreachMail, SendStopped } from "./send";

const settings = { ...defaultOutreachSettings("acct"), enabled: true, transport: "mailbox-smtp" as const };
const input: Parameters<typeof sendOutreachMail>[0] = {
  settings, sendId: "send", recipient: { contactId: "contact" }, content: { subject: "Hallo", html: "<p>Willkommen</p>", text: "" },
  authorization: { scheduledByUserId: "editor" }, identityId: "sender", trackOpens: true, trackClicks: true,
  assertClaim() {}
};
const contact = { contactId: "contact", email: "alex@example.test", firstName: "Alex", lastName: "Muster", properties: {} };
const unsubscribe = { url: "https://links.example.test/t/u/token", oneClickUrl: "https://links.example.test/t/u/one-click" };

function fixture() {
  const mails: Array<Parameters<typeof defaultSendDependencies.transport["mailbox-smtp"]>[0]> = [];
  const tracked: string[] = [];
  const deps: typeof defaultSendDependencies = {
    ...defaultSendDependencies, now: () => 1000,
    getAccount: async () => ({ smtp: { host: "smtp.example.test", port: 587, secure: false, user: "test", password: "synthetic" } }) as Account,
    resolveIdentity: async () => ({ id: "sender", email: "sender@example.test", displayName: "Sender", replyTo: "" }),
    authorize: async () => ({ userId: "editor", clientId: "test", assertCurrent() {} }),
    prepareAssertion: async () => () => {},
    findRecipient: async () => contact,
    unsubscribeUrls: async () => unsubscribe,
    track: async request => { tracked.push(request.html); return request.html; },
    origin: () => "https://links.example.test",
    sesConfigured: () => true,
    transport: { ...defaultSendDependencies.transport, "mailbox-smtp": async (mail, _account, _sender, beforeSend) => {
      (await beforeSend())();
      mails.push(mail);
      return { messageId: mail.messageId, providerMessageId: null };
    } }
  };
  return { deps, mails, tracked };
}

test("text-only content gets an HTML part with the message, escaped and with its line breaks", async () => {
  const { deps, mails, tracked } = fixture();
  const content = { subject: "Info", html: "", text: "Hallo {{ first_name }},\nhier sind die Informationen <bitte lesen>.\n\nGruß & Dank" };
  expect(await sendOutreachMail({ ...input, content }, deps)).toMatchObject({ status: "sent" });
  const { html, text } = mails[0];
  expect(html).toContain("<p>Hallo Alex,<br>hier sind die Informationen &lt;bitte lesen&gt;.</p>");
  expect(html).toContain("<p>Gruß &amp; Dank</p>");
  expect(html).toContain(`<a href="${unsubscribe.url}">Abmelden</a>`);
  // Tracking sees the message as well, not only the footer.
  expect(tracked[0]).toContain("hier sind die Informationen");
  expect(text).toStartWith("Hallo Alex,\nhier sind die Informationen <bitte lesen>.");
});

test("configuration faults defer the send without an attempt; recipient and content faults still fail", async () => {
  const cases: Array<[string, (deps: typeof defaultSendDependencies, send: typeof input) => typeof input, string, string]> = [
    ["disabled", (_deps, send) => ({ ...send, settings: { ...settings, enabled: false } }), "deferred", "outreach_disabled"],
    ["no SMTP", (deps, send) => { deps.getAccount = async () => ({ smtp: { host: "", port: 0, user: "", password: "" } }) as Account; return send; },
      "deferred", "transport_unavailable"],
    ["no SES", (deps, send) => { deps.sesConfigured = () => false; return { ...send, settings: { ...settings, transport: "ses" } }; },
      "deferred", "transport_unavailable"],
    ["SES unconfigured at the boundary", (deps, send) => {
      deps.transport.ses = createSesTransport(async () => null);
      return { ...send, settings: { ...settings, transport: "ses" } };
    }, "deferred", "transport_unavailable"],
    ["no unsubscribe URL", (deps, send) => { deps.unsubscribeUrls = async () => null; return send; }, "deferred", "unsubscribe_unavailable"],
    ["identity gone", (deps, send) => {
      deps.resolveIdentity = async () => { throw new SenderIdentityError("sender_identity_not_found", 404, "synthetic"); };
      return send;
    }, "deferred", "identity_unavailable"],
    ["role revoked", (deps, send) => {
      deps.authorize = async () => { throw new OutboundAuthorizationError(NextResponse.json({}, { status: 403 })); };
      return send;
    }, "deferred", "permission_revoked"],
    ["configuration changed", (_deps, send) => {
      let checks = 0;
      return { ...send, assertClaim() { if (++checks > 1) throw new SendStopped("configuration_changed"); } };
    }, "deferred", "configuration_changed"],
    ["account missing", (deps, send) => { deps.getAccount = async () => null; return send; }, "failed", "account_missing"],
    ["invalid recipient", (deps, send) => { deps.findRecipient = async () => ({ ...contact, email: "not-an-address" }); return send; },
      "failed", "recipient_invalid"],
    ["empty content", (_deps, send) => ({ ...send, content: { subject: "", html: "<p>x</p>", text: "" } }), "failed", "content_empty"]
  ];
  for (const [label, arrange, status, reason] of cases) {
    const { deps, mails } = fixture();
    const send = arrange(deps, input);
    expect([label, await sendOutreachMail(send, deps)]).toEqual([label, { status, reason }] as never);
    expect(mails).toHaveLength(0);
  }
});

const sesResponse = (statusCode: number, type: string | null, body: string = JSON.stringify({ message: "synthetic" })) => async () => ({
  response: {
    statusCode, body: Readable.from([Buffer.from(body)]),
    headers: { "content-type": "application/json", ...(type ? { "x-amzn-errortype": type } : {}) }
  }
});
const networkError = (code: string, name = "Error") => async () => {
  throw Object.assign(new Error(`synthetic ${code}`), { code, name });
};

test("classifies what SES answered: definite rejections retry or defer, anything else stays uncertain", async () => {
  type Outcome = { status: string; reason: string };
  const throttled = { status: "retry", reason: "ses_throttled" };
  const rejected = { status: "retry", reason: "ses_rejected" };
  const configuration = { status: "deferred", reason: "ses_configuration_rejected" };
  const connect = { status: "retry", reason: "ses_connection_failed" };
  const uncertain = { status: "failed", reason: "send_uncertain" };
  const table: Array<[string, () => Promise<unknown>, Outcome]> = [
    ["429 TooManyRequestsException", sesResponse(429, "TooManyRequestsException"), throttled],
    ["400 LimitExceededException", sesResponse(400, "LimitExceededException"), throttled],
    ["400 ThrottlingException", sesResponse(400, "ThrottlingException"), throttled],
    ["400 MessageRejected", sesResponse(400, "MessageRejected"), rejected],
    ["400 BadRequestException", sesResponse(400, "BadRequestException"), rejected],
    ["400 AccountSuspendedException", sesResponse(400, "AccountSuspendedException"), configuration],
    ["400 SendingPausedException", sesResponse(400, "SendingPausedException"), configuration],
    ["400 MailFromDomainNotVerifiedException", sesResponse(400, "MailFromDomainNotVerifiedException"), configuration],
    ["404 NotFoundException", sesResponse(404, "NotFoundException"), configuration],
    ["403 UnrecognizedClientException", sesResponse(403, "UnrecognizedClientException"), configuration],
    ["403 InvalidSignatureException", sesResponse(403, "InvalidSignatureException"), configuration],
    ["403 AccessDeniedException", sesResponse(403, "AccessDeniedException"), configuration],
    ["403 ExpiredTokenException", sesResponse(403, "ExpiredTokenException"), configuration],
    ["400 ExpiredTokenException", sesResponse(400, "ExpiredTokenException"), configuration],
    ["connect ECONNREFUSED", networkError("ECONNREFUSED"), connect],
    ["DNS ENOTFOUND", networkError("ENOTFOUND"), connect],
    ["DNS EAI_AGAIN", networkError("EAI_AGAIN"), connect],
    ["500 InternalServiceErrorException", sesResponse(500, "InternalServiceErrorException"), uncertain],
    ["503 without a type", sesResponse(503, null), uncertain],
    ["200 with an unreadable body", sesResponse(200, null, "{"), uncertain],
    ["socket reset", networkError("ECONNRESET", "TimeoutError"), uncertain],
    ["socket timeout", networkError("ETIMEDOUT", "TimeoutError"), uncertain],
    ["aborted", networkError("ABORT_ERR", "AbortError"), uncertain],
    ["unknown error", async () => { throw new Error("synthetic"); }, uncertain]
  ];
  const ses = { ...input, settings: { ...settings, transport: "ses" as const } };
  for (const [label, handle, expected] of table) {
    const { deps } = fixture();
    let calls = 0;
    const client = new SESv2Client({
      region: "eu-central-1", credentials: { accessKeyId: "synthetic", secretAccessKey: "synthetic" }, maxAttempts: 1,
      requestHandler: { handle: () => { calls++; return handle(); } } as never
    });
    deps.transport.ses = createSesTransport(async () => client);
    expect([label, await sendOutreachMail(ses, deps)]).toEqual([label, expected] as never);
    expect([label, calls]).toEqual([label, 1]);
  }
});

test("an SES acceptance stores the provider message id", async () => {
  const { deps } = fixture();
  const client = new SESv2Client({
    region: "eu-central-1", credentials: { accessKeyId: "synthetic", secretAccessKey: "synthetic" }, maxAttempts: 1,
    requestHandler: { handle: sesResponse(200, null, JSON.stringify({ MessageId: "ses-message" })) } as never
  });
  deps.transport.ses = createSesTransport(async () => client);
  expect(await sendOutreachMail({ ...input, settings: { ...settings, transport: "ses" } }, deps))
    .toMatchObject({ status: "sent", providerMessageId: "ses-message" });
});
