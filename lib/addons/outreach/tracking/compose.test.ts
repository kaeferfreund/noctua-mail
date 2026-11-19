import { afterAll, beforeAll, expect, setSystemTime } from "bun:test";
import MailComposer from "nodemailer/lib/mail-composer/index.js";
import { simpleParser } from "mailparser";
import { POST as sendCompose } from "@/app/api/accounts/[accountId]/smtp/send/route";
import { stripBccHeader } from "@/lib/mail/stripBccHeader";
import { isolatedImapTest } from "@/lib/testFixtures/isolatedImapTest";
import { startImapServer } from "@/lib/testFixtures/mail/imap-server";
import { startSmtpSink } from "@/lib/testFixtures/mail/smtp-sink";
import { createScheduledSendFixture } from "@/lib/testFixtures/scheduledSendDrafts";
import { closeOutreachDb, getOutreachDb, getOutreachDbPath } from "../db";
import { saveOutreachSettings } from "../settings";
import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";

const inChild = process.env.NOCTUA_COMPOSE_TRACKING_FIXTURE === "1";
const mailTest = (name: string, run: () => Promise<void>) =>
  isolatedImapTest(import.meta.url, "NOCTUA_COMPOSE_TRACKING_FIXTURE", name, run);
const user = "test-account@example.test";
const password = "synthetic";
const html = '<p><a href="https://target.example.test/path">Synthetic link</a></p>';
const mailer = "Noctua Mail (https://github.com/paulwellnerbou/noctua-mail)";
const payload = { to: "recipient@example.test", bcc: "blind@example.test", subject: "Synthetic tracking test", text: "", html, tracking: true };
let imap: Awaited<ReturnType<typeof startImapServer>>;
let smtp: Awaited<ReturnType<typeof startSmtpSink>>;
let rejectRecipient = false;
let out: string;

beforeAll(async () => {
  if (!inChild) return;
  process.env.NOCTUA_ADDON_OUTREACH = "1";
  process.env.NOCTUA_OUTREACH_PUBLIC_URL = "https://links.example.test";
  out = join(process.env.NOCTUA_DATA_DIR!, "tracking-smtp");
  imap = await startImapServer({ host: "127.0.0.1", port: 0, user, pass: password });
  smtp = await startSmtpSink({ host: "127.0.0.1", port: 0, user, pass: password, out,
    rejectRecipient: () => rejectRecipient ? "550 5.1.1 Synthetic rejection" : undefined });
});

afterAll(async () => {
  if (!inChild) return;
  setSystemTime();
  closeOutreachDb();
  await smtp?.stop();
  await imap?.stop();
  rmSync(out, { recursive: true, force: true });
});

async function setup(enabled = true) {
  const f = await createScheduledSendFixture({
    smtp: { host: "127.0.0.1", port: smtp.port, secure: false, user, password },
    imap: { host: "127.0.0.1", port: imap.port, secure: false, user, password }
  });
  if (enabled) await saveOutreachSettings(f.accountId, { enabled: true }, f.user.id);
  const send = (extra = {}) => sendCompose(f.request("POST", { ...payload, identityId: f.identity.id, ...extra }, {}, f, "/smtp/send"), f.params());
  return { ...f, send };
}

function sentCopy(messageId: string) {
  return imap.store.get("Sent").messages.find(message => message.mime.headers.get("message-id") === messageId)?.mime.raw;
}

mailTest("with the addon off, SMTP and Sent bytes match the legacy compose path", async () => {
  delete process.env.NOCTUA_ADDON_OUTREACH;
  const f = await setup(false);
  expect(existsSync(getOutreachDbPath())).toBe(false);
  const now = new Date();
  setSystemTime(now);
  try {
    const res = await f.send();
    expect(res.status).toBe(200);
    const { messageId, sentCopy: status } = await res.json();
    expect(status).toBe("appended");
    const composer = new MailComposer({
      from: { name: f.identity.displayName, address: f.identity.email },
      to: payload.to, bcc: payload.bcc, subject: payload.subject, text: payload.text, html, messageId,
      envelope: { from: f.identity.email, to: [payload.to, payload.bcc] },
      headers: { "User-Agent": mailer, "X-Mailer": mailer }
    }).compile();
    composer.keepBcc = true;
    const expected = await composer.build();
    expect(sentCopy(messageId)).toEqual(expected);
    expect(smtp.received[0].source).toEqual(stripBccHeader(expected));
    expect(existsSync(getOutreachDbPath())).toBe(false);
  } finally {
    setSystemTime();
  }
});

mailTest("SMTP gets tracked HTML while Sent keeps the same headers and original HTML", async () => {
  const f = await setup();
  const result = await f.send({ text: "Plain alt", attachments: [
    { filename: "sample.txt", contentType: "text/plain", dataUrl: "data:text/plain;base64,U3ludGhldGlj" }
  ] });
  expect(result.status).toBe(200);
  const { messageId, sentCopy: status } = await result.json();
  expect(status).toBe("appended");
  const local = sentCopy(messageId)!;
  const wire = smtp.received[0].source;
  const headersOnly = (mime: Buffer) => mime.toString("latin1").split("\r\n\r\n", 1)[0];
  expect(headersOnly(wire)).toBe(headersOnly(stripBccHeader(local)));
  expect(smtp.received[0].to).toContain(payload.bcc);
  expect((await simpleParser(local)).html).toBe(html);
  const parsed = await simpleParser(wire);
  expect(parsed.html).toMatch(/https:\/\/links\.example\.test\/t\/c\//);
  expect(parsed.html).toMatch(/https:\/\/links\.example\.test\/t\/o\//);
  expect(parsed.text?.trim()).toBe("Plain alt");
  expect(parsed.attachments[0].content.toString()).toBe("Synthetic");
  const db = await getOutreachDb();
  expect(db.prepare("SELECT kind, status, recipients, subject, userId, sentAt FROM sends WHERE accountId = ? AND messageId = ?")
    .get(f.accountId, messageId)).toMatchObject({ kind: "mail", status: "sent", recipients: `${payload.to}, ${payload.bcc}`,
    subject: payload.subject, userId: f.user.id, sentAt: expect.any(Number) });
});

mailTest("a tracking write failure rolls back the send row and SMTP still gets the original HTML", async () => {
  const f = await setup();
  const db = await getOutreachDb();
  db.exec(`CREATE TEMP TRIGGER forbid_test_link BEFORE INSERT ON tracking_links
    BEGIN SELECT RAISE(ABORT, 'synthetic tracking storage failure'); END`);
  const result = await f.send();
  expect(result.status).toBe(200);
  const { messageId } = await result.json();
  expect((await simpleParser(smtp.received[0].source)).html).toBe(html + "\n");
  expect(smtp.received[0].source).toEqual(stripBccHeader(sentCopy(messageId)!));
  expect(db.prepare("SELECT status FROM sends WHERE accountId = ?").all(f.accountId)).toEqual([]);
  expect(db.prepare("SELECT token FROM tracking_links WHERE accountId = ?").all(f.accountId)).toEqual([]);
});

mailTest("SMTP rejection marks the tracked send failed without creating a Sent copy", async () => {
  const f = await setup();
  const before = imap.store.get("Sent").messages.length;
  rejectRecipient = true;
  const result = await f.send();
  expect(result.status).toBeGreaterThanOrEqual(400);
  expect(smtp.received).toHaveLength(0);
  expect(imap.store.get("Sent").messages).toHaveLength(before);
  const db = await getOutreachDb();
  expect(db.prepare("SELECT status, sentAt FROM sends WHERE accountId = ?").all(f.accountId)).toEqual([{ status: "failed", sentAt: null }]);
});
