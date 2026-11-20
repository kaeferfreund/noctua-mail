import { describe, expect, test } from "bun:test";
import type { Account, Folder, Message } from "@/lib/data";
import { authenticatedTestCookie } from "@/lib/testAuthHarness";
import { dbModulePromise } from "@/lib/testDbHarness";

const { saveFoldersForAccount, upsertAccount, upsertMessages } = await dbModulePromise;
const { saveMessageSource } = await import("@/lib/storage");
const { GET: messageDetail } = await import("@/app/api/accounts/[accountId]/messages/[messageId]/route");

const received = "Received: from relay.example.net by mx.example.test with ESMTPS; Mon, 2 Nov 2026 10:00:00 +0000";
const source = (from: string, authenticationResults?: string) =>
  [received, ...(authenticationResults ? [`Authentication-Results: ${authenticationResults}`] : []), `From: <${from}>`,
    "Subject: Synthetic", "", "Body", ""].join("\r\n");

async function seedMailbox() {
  const accountId = `acc-sender-verified-${crypto.randomUUID()}`;
  const account: Account = {
    id: accountId, name: "Sender check", email: "owner@example.test", avatar: "",
    imap: { host: "imap.example.test", port: 993, secure: true, user: "owner@example.test", password: "secret-imap" },
    smtp: { host: "smtp.example.test", port: 465, secure: true, user: "owner@example.test", password: "secret-smtp" }
  };
  const folder = (name: string, specialUse?: string): Folder =>
    ({ id: `${accountId}:${name}`, accountId, name, count: 0, unreadCount: 0, specialUse });
  const inbox = folder("INBOX", "\\Inbox");
  const sent = folder("Sent", "\\Sent");
  await upsertAccount(account);
  await saveFoldersForAccount(accountId, [inbox, sent]);
  const message = (id: string, folderId: string, from: string, hasSource: boolean, uid: number): Message => ({
    id: `${accountId}-${id}`, accountId, folderId, threadId: `${accountId}-${id}`, messageId: `<${id}-${accountId}@example.test>`,
    subject: "Synthetic", from, senderKey: from, to: "owner@example.test", preview: "", date: new Date(Date.UTC(2026, 10, 2)).toISOString(),
    dateValue: Date.UTC(2026, 10, 2) + uid, body: "Body", hasSource, imapUid: uid
  });
  const rows = {
    verified: message("verified", inbox.id, "alice@example.test", true, 1),
    noResults: message("no-results", inbox.id, "alice@example.test", true, 2),
    own: message("own", inbox.id, "owner@example.test", true, 3),
    sent: message("sent", sent.id, "alice@example.test", true, 4),
    noSource: message("no-source", inbox.id, "alice@example.test", false, 5)
  };
  await upsertMessages(accountId, inbox.id, [rows.verified, rows.noResults, rows.own, rows.noSource]);
  await upsertMessages(accountId, sent.id, [rows.sent]);
  const pass = "mx.example.test; dkim=pass header.d=example.test";
  await saveMessageSource(accountId, rows.verified.id, source("alice@example.test", pass));
  await saveMessageSource(accountId, rows.noResults.id, source("alice@example.test"));
  await saveMessageSource(accountId, rows.own.id, source("owner@example.test"));
  await saveMessageSource(accountId, rows.sent.id, source("alice@example.test"));
  return { accountId, rows, cookie: await authenticatedTestCookie(accountId) };
}

describe("message detail senderVerified", () => {
  test("is computed for the opened message; own mail and missing sources get null", async () => {
    const mailbox = await seedMailbox();
    const read = async (message: Message) => {
      const response = await messageDetail(
        new Request(`http://localhost:3000/api/accounts/${mailbox.accountId}/messages/${encodeURIComponent(message.id)}`,
          { headers: { cookie: mailbox.cookie } }),
        { params: Promise.resolve({ accountId: mailbox.accountId, messageId: message.id }) }
      );
      expect(response.status).toBe(200);
      return ((await response.json()) as { message: Message }).message.senderVerified;
    };
    expect(await read(mailbox.rows.verified)).toBe(true);
    expect(await read(mailbox.rows.noResults)).toBe(false);
    expect(await read(mailbox.rows.own)).toBeNull();
    expect(await read(mailbox.rows.sent)).toBeNull();
    expect(await read(mailbox.rows.noSource)).toBeNull();
  });
});
