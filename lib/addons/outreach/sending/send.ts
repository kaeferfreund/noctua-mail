import { Readable } from "node:stream";
import { z } from "zod";
import { escapeHtml } from "@/lib/html/strip";
import { addToHtmlBody, hasUnsubscribeLink, renderContent, sampleContact, type Content } from "./render";
import { outreachPublicOrigin } from "../config";
import { createUnsubscribeUrls, getSendableRecipient } from "../contacts";
import { newOutreachToken } from "../ids";
import { prepareTrackedHtml } from "../tracking";
import type { OutreachAccountSettings } from "../types";
import { buildRawMessage, sendRawSmtpMessage } from "@/lib/mail/smtp";
import { getSmtpHttpError, smtpFailedBeforeData } from "@/lib/mail/smtpError";
import { authorizeOutbound, OutboundAuthorizationError, prepareOutboundAssertion, type OutboundAuthorization } from "@/lib/outboundAuthorization";
import { configuredReplyTo, resolveSendIdentity, type ResolvedSender } from "@/lib/sendIdentity";
import { SenderIdentityError } from "@/lib/senderIdentityError";
import { getAccountById } from "@/lib/serverDb";
import type { Account } from "@/lib/data";
import { SendingError } from "./input";

function sesEnvironment(env: Record<string, string | undefined>) {
  const region = env.NOCTUA_OUTREACH_SES_REGION?.trim();
  const accessKeyId = env.AWS_ACCESS_KEY_ID?.trim();
  const secretAccessKey = env.AWS_SECRET_ACCESS_KEY?.trim();
  if (!region || !accessKeyId || !secretAccessKey) return null;
  return { region, credentials: { accessKeyId, secretAccessKey, sessionToken: env.AWS_SESSION_TOKEN?.trim() || undefined } };
}

export function isSesConfigured(env: Record<string, string | undefined> = process.env) {
  return sesEnvironment(env) !== null;
}

export function hasSmtp(account: Account) {
  return Boolean(account.smtp.host?.trim() && account.smtp.port > 0 && account.smtp.user?.trim() && account.smtp.password);
}

type Mail = { sendId: string; to: string; subject: string; text: string; html: string; messageId: string; headers: Record<string, string> };
type Receipt = { messageId: string; providerMessageId: string | null };
type SendTransport = (mail: Mail, account: Account, identity: ResolvedSender, beforeSend: () => Promise<() => void>) => Promise<Receipt>;
type SendDependencies = {
  now: () => number;
  getAccount: (accountId: string) => Promise<Account | null>;
  resolveIdentity: (input: Parameters<typeof resolveSendIdentity>[0]) => Promise<ResolvedSender>;
  authorize: typeof authorizeOutbound;
  prepareAssertion: typeof prepareOutboundAssertion;
  findRecipient: typeof getSendableRecipient;
  unsubscribeUrls: typeof createUnsubscribeUrls;
  track: typeof prepareTrackedHtml;
  origin: typeof outreachPublicOrigin;
  sesConfigured: () => boolean;
  transport: Record<OutreachAccountSettings["transport"], SendTransport>;
};

const sendSmtp: SendTransport = async (mail, account, identity, beforeSend) => {
  const raw = await buildRawMessage(account, mail, identity);
  const stream = Readable.from((async function* () {
    (await beforeSend())();
    yield raw;
  })(), { objectMode: false });
  await sendRawSmtpMessage(account, stream, { from: identity.email, to: [mail.to] });
  return { messageId: mail.messageId, providerMessageId: null };
};

let sesClient: import("@aws-sdk/client-sesv2").SESv2Client | undefined;
const sendSes: SendTransport = async (mail, _account, identity, beforeSend) => {
  const [{ SESv2Client, SendEmailCommand }, { default: nodemailer }] = await Promise.all([
    import("@aws-sdk/client-sesv2"), import("nodemailer")
  ]);
  const config = sesEnvironment(process.env);
  if (!config) throw new SendingError(400, "SES ist nicht konfiguriert.", "transport_unavailable");
  const client = sesClient ??= new SESv2Client({
    ...config,
    // The transport cannot prove whether a timed-out API call was accepted.
    maxAttempts: 1
  });
  const transporter = nodemailer.createTransport({
    SES: {
      sesClient: {
        config: { region: client.config.region },
        async send(command: unknown) {
          if (!(command instanceof SendEmailCommand)) throw new Error("Unexpected SES command");
          const assertCurrent = await beforeSend();
          assertCurrent();
          return client.send(command, { abortSignal: AbortSignal.timeout(60_000) });
        }
      },
      SendEmailCommand
    }
  });
  const configurationSet = process.env.NOCTUA_OUTREACH_SES_CONFIGURATION_SET?.trim();
  const info = await transporter.sendMail({
    ...mail, from: { name: identity.displayName, address: identity.email }, replyTo: configuredReplyTo(identity),
    envelope: { from: identity.email, to: [mail.to] },
    ses: { ConfigurationSetName: configurationSet, EmailTags: [{ Name: "noctua_send_id", Value: mail.sendId }] }
  });
  return { messageId: info.messageId ?? mail.messageId, providerMessageId: info.response ?? null };
};

export const defaultSendDependencies: SendDependencies = {
  now: Date.now, getAccount: getAccountById, resolveIdentity: resolveSendIdentity,
  authorize: authorizeOutbound, prepareAssertion: prepareOutboundAssertion, findRecipient: getSendableRecipient,
  unsubscribeUrls: createUnsubscribeUrls, track: prepareTrackedHtml, origin: outreachPublicOrigin, sesConfigured: isSesConfigured,
  transport: { "mailbox-smtp": sendSmtp, ses: sendSes }
};

type ContactFields = Pick<typeof sampleContact, "firstName" | "lastName" | "email">;
type Recipient = { contactId: string; listId?: string | null } | { testAddress: string; sample: ContactFields };
type SendInput = {
  settings: OutreachAccountSettings; sendId: string; recipient: Recipient; content: Content;
  authorization: OutboundAuthorization; identityId: string | null; trackOpens: boolean; trackClicks: boolean;
  assertClaim: () => void;
};

export class SendStopped extends Error {
  constructor(readonly reason: "paused" | "rescheduled" | "cancelled" | "interrupted" | "recipient_unmailable" | "recipient_changed" | "configuration_changed") { super(reason); }
}

export type SendOutcome =
  | ({ status: "sent"; subject: string; recipients: string; sentAt: number } & Receipt)
  | { status: "skipped" | "failed" | "retry" | "deferred"; reason: string };

function safeUnsubscribeUrl(url: string) {
  try {
    const parsed = new URL(url);
    return /^https?:$/.test(parsed.protocol) && !parsed.username && !parsed.password && !/[\s<>]/.test(url);
  } catch {
    return false;
  }
}

/** Checked after MIME preparation, then again synchronously at the transport boundary. */
export async function sendOutreachMail(input: SendInput, deps = defaultSendDependencies): Promise<SendOutcome> {
  const { settings, recipient, sendId, content } = input;
  const accountId = settings.accountId;
  let started = false;
  try {
    input.assertClaim();
    if (!settings.enabled) return { status: "failed", reason: "outreach_disabled" };
    const account = await deps.getAccount(accountId);
    if (!account) return { status: "failed", reason: "account_missing" };
    if (settings.transport === "ses" ? !deps.sesConfigured() : !hasSmtp(account)) {
      return { status: "failed", reason: "transport_unavailable" };
    }

    const test = "testAddress" in recipient;
    const contact = test ? recipient.sample
      : await deps.findRecipient(accountId, recipient.contactId, { listId: recipient.listId });
    if (!contact) return { status: "skipped", reason: "recipient_unmailable" };
    const address = test ? recipient.testAddress : contact.email;
    if (!z.email().safeParse(address).success) return { status: "failed", reason: "recipient_invalid" };

    const origin = test ? deps.origin() : null;
    // An editor can preview with any contact and deliver the test to another address.
    // An inert test token prevents the recipient from unsubscribing the previewed contact.
    const testUrl = origin ? `${origin}/t/u/${newOutreachToken()}` : null;
    const unsubscribe = test ? (testUrl ? { url: testUrl, oneClickUrl: testUrl } : null)
      : await deps.unsubscribeUrls(accountId, { sendId, contactId: recipient.contactId, listId: recipient.listId });
    if (!unsubscribe || !safeUnsubscribeUrl(unsubscribe.url) || !safeUnsubscribeUrl(unsubscribe.oneClickUrl)) {
      return { status: "failed", reason: "unsubscribe_unavailable" };
    }

    const options = { contact, organizationName: settings.organizationName, organizationAddress: settings.organizationAddress,
      unsubscribeUrl: unsubscribe.url, now: deps.now() };
    const rendered = renderContent(content, options);
    if (!rendered.subject.trim() || !(rendered.text.trim() || rendered.html.trim())) {
      return { status: "failed", reason: "content_empty" };
    }
    let { html, text } = rendered;
    if (!hasUnsubscribeLink(html, unsubscribe.url)) {
      html = addToHtmlBody(html, `<p><a href="${escapeHtml(unsubscribe.url)}">Abmelden</a></p>`);
    }
    if (!text.includes(unsubscribe.url)) text += `\n\nAbmelden: ${unsubscribe.url}`;
    if (content.previewText) {
      const preview = renderContent({ subject: content.previewText, html: "", text: "" }, options).subject;
      if (preview) html = addToHtmlBody(html, `<div style="display:none;max-height:0;overflow:hidden">${escapeHtml(preview)}</div>`, true);
    }
    try {
      html = await deps.track({ accountId, sendId, html, trackOpens: input.trackOpens, trackClicks: input.trackClicks,
        contactId: test ? null : recipient.contactId, keepUrls: [unsubscribe.url, unsubscribe.oneClickUrl] });
    } catch {
      console.warn("[outreach] tracking preparation failed; sending untracked");
    }

    const identity = await deps.resolveIdentity({ accountId, identityId: input.identityId ?? settings.senderIdentityId ?? undefined });
    const mail: Mail = {
      sendId, to: address, subject: rendered.subject, text, html, messageId: `<${crypto.randomUUID()}@${identity.email.split("@").at(-1)}>`,
      headers: { "List-Unsubscribe": `<${unsubscribe.oneClickUrl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" }
    };
    const result = await deps.transport[settings.transport](mail, account, identity, async () => {
      const actor = await deps.authorize(input.authorization, { accountId, minRole: "editor", identity });
      const assertAuthorized = await deps.prepareAssertion(actor);
      if (!test) {
        const live = await deps.findRecipient(accountId, recipient.contactId, { listId: recipient.listId });
        if (!live) throw new SendStopped("recipient_unmailable");
        if (live.email !== address) throw new SendStopped("recipient_changed");
      }
      return () => {
        input.assertClaim();
        assertAuthorized();
        started = true;
      };
    });
    return { status: "sent", ...result, subject: mail.subject, recipients: mail.to, sentAt: deps.now() };
  } catch (error) {
    if (error instanceof SendStopped) {
      if (error.reason === "paused" || error.reason === "rescheduled") return { status: "deferred", reason: error.reason };
      if (error.reason === "recipient_changed" || error.reason === "configuration_changed") return { status: "retry", reason: error.reason };
      return { status: ["cancelled", "recipient_unmailable"].includes(error.reason) ? "skipped" : "failed", reason: error.reason };
    }
    if (error instanceof OutboundAuthorizationError) return { status: "failed", reason: "permission_revoked" };
    if (error instanceof SenderIdentityError) return { status: "failed", reason: "identity_unavailable" };
    if (error instanceof SendingError) return { status: "failed", reason: error.code ?? "invalid_send" };
    if (settings.transport === "mailbox-smtp") {
      const smtp = getSmtpHttpError(error);
      if (smtp?.status === 422 || smtp?.code === "smtp_configuration_error") return { status: "failed", reason: smtp.code };
      if (smtpFailedBeforeData(error)) return { status: "retry", reason: "smtp_before_data" };
    }
    if (!started) return { status: "retry", reason: "pre_transport_failure" };
    return { status: "failed", reason: "send_uncertain" };
  }
}
