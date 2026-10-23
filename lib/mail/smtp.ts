import { stripBccHeader } from "./stripBccHeader";
import { configuredReplyTo, type ResolvedSender } from "../sendIdentity";
import addressParser from "nodemailer/lib/addressparser/index.js";
import type { Account } from "@/lib/data";
import nodemailer from "nodemailer";
import MailComposer from "nodemailer/lib/mail-composer/index.js";
import { markSmtpUpstreamFailure } from "./smtpError";
import { getSmtpTimeoutOptions } from "./smtpTimeouts";

const PROJECT_URL = "https://github.com/paulwellnerbou/noctua-mail";
const MAILER_ID = `Noctua Mail (${PROJECT_URL})`;

type MailPayload = {
  to?: string;
  cc?: string;
  bcc?: string;
  keepBcc?: boolean;
  subject: string;
  text: string;
  html?: string;
  messageId?: string;
  inReplyTo?: string;
  references?: string[];
  xForwardedMessageId?: string;
  headers?: Record<string, string>;
  attachments?: Array<{
    filename: string;
    contentType: string;
    content: Buffer;
    cid?: string;
    inline?: boolean;
  }>;
};

function buildMailOptions(mail: MailPayload, sender: ResolvedSender) {
  const to = mail.to?.trim() || undefined;
  const cc = mail.cc?.trim() || undefined;
  const bcc = mail.bcc?.trim() || undefined;
  const fromValue = {
    name: sender.displayName,
    address: sender.email
  };
  const attachments = mail.attachments?.map((attachment) => ({
    filename: attachment.filename,
    content: attachment.content,
    contentType: attachment.contentType,
    cid: attachment.cid,
    contentDisposition: attachment.inline ? "inline" : "attachment"
  }));
  return {
    from: fromValue,
    to,
    cc,
    bcc,
    replyTo: configuredReplyTo(sender),
    envelope: { from: sender.email, to: [to, cc, bcc].flatMap(value => value ? addressParser(value, { flatten: true }).map(entry => entry.address).filter(Boolean) : []) },
    messageId: mail.messageId,
    inReplyTo: mail.inReplyTo,
    references: mail.references,
    subject: mail.subject,
    text: mail.text,
    html: mail.html,
    ...(attachments && attachments.length > 0 ? { attachments } : {}),
    headers: {
      ...(mail.headers ?? {}),
      "User-Agent": MAILER_ID,
      "X-Mailer": MAILER_ID,
      ...(mail.xForwardedMessageId ? { "X-Forwarded-Message-Id": mail.xForwardedMessageId } : {})
    }
  };
}

function createSmtpTransport(account: Account) {
  return nodemailer.createTransport({
    host: account.smtp.host,
    port: account.smtp.port,
    secure: account.smtp.secure,
    auth: {
      user: account.smtp.user,
      pass: account.smtp.password
    },
    ...getSmtpTimeoutOptions()
  });
}

export async function buildRawMessage(account: Account, mail: MailPayload, sender: ResolvedSender) {
  const mailOptions = buildMailOptions(mail, sender);
  const raw = await new Promise<Buffer>((resolve, reject) => {
    const composer = new MailComposer(mailOptions);
    const compiled = composer.compile();
    if (mail.keepBcc) {
      (compiled as { keepBcc?: boolean }).keepBcc = true;
    }
    compiled.build((error: Error | null, message: Buffer) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(message);
    });
  });

  return raw;
}

export async function sendSmtpMessage(account: Account, mail: MailPayload, sender: ResolvedSender) {
  const transporter = createSmtpTransport(account);

  const mailOptions = buildMailOptions(mail, sender);
  const raw = await buildRawMessage(account, mail, sender);

  let info: unknown;
  try {
    info = await transporter.sendMail({ envelope: mailOptions.envelope, raw: stripBccHeader(raw) });
  } catch (error) {
    throw markSmtpUpstreamFailure(error, sender.email);
  }
  return { messageId: (info as any)?.messageId ?? null, raw };
}

/**
 * Send a message from a pre-built raw MIME blob — used by draft-send so a
 * previously-saved draft (with its original headers and attachments) goes
 * out byte-for-byte, no re-compose round-trip.
 *
 * The SMTP envelope (MAIL FROM / RCPT TO) is supplied separately because
 * `nodemailer` cannot reliably parse envelope recipients from an opaque
 * raw buffer — the caller already has `to`/`cc`/`bcc` parsed on the
 * source `Message`, so we feed them in directly.
 *
 * This function relays `raw` unchanged; it does NOT remove or rewrite
 * any MIME header. **Bcc recipients must appear only in the
 * SMTP envelope — it is the caller's responsibility to ensure the `raw`
 * blob does not contain a `Bcc:` header** (see `stripBccHeader` in this
 * directory). Transmitting a raw blob that still carries a `Bcc:` header
 * would disclose blind-carbon addresses to every To/Cc recipient.
 */
export async function sendRawSmtpMessage(
  account: Account,
  raw: Buffer | string,
  envelope: { from: string; to: string[] }
) {
  const transporter = createSmtpTransport(account);

  let info: unknown;
  try {
    info = await transporter.sendMail({
      envelope: {
        from: envelope.from,
        to: envelope.to
      },
      raw
    });
  } catch (error) {
    throw markSmtpUpstreamFailure(error, envelope.from);
  }
  return { messageId: (info as any)?.messageId ?? null };
}

/** Verify the submitted endpoint before any credential write-back. */
export async function verifySmtpCredentials(account: Account): Promise<boolean> {
  const transport = createSmtpTransport(account);
  try { await transport.verify(); return true; }
  catch { return false; }
  finally { transport.close(); }
}
