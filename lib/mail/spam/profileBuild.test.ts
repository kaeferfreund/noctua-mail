import { describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import type { Folder } from "@/lib/data";
import { buildAccountSenderProfiles, parseSourceHead, storedMailArrival } from "./profileBuild";
import { evaluateSenderTrust } from "./senderProfile";

const DAY = 24 * 60 * 60_000;
const accountId = "acc-synthetic";
const folders: Folder[] = [
  { id: "inbox", accountId, name: "INBOX", count: 0, unreadCount: 0, specialUse: "\\Inbox" },
  { id: "junk", accountId, name: "Junk", count: 0, unreadCount: 0, specialUse: "\\Junk" },
  { id: "sent", accountId, name: "Sent", count: 0, unreadCount: 0, specialUse: "\\Sent" }
];
const head = (id: number) => [
  "Authentication-Results: mx.example.test; dkim=pass header.d=service.example.test",
  "From: Service <notify@service.example.test>",
  `Message-ID: <${id}@service.example.test>`,
  "Content-Type: multipart/mixed; boundary=b",
  "",
  "--b",
  "Content-Type: application/pdf;",
  " name=\"rechnung.pdf\"",
  ""
].join("\r\n");

describe("profile build", () => {
  test("parseSourceHead splits the header block and finds attachment names", () => {
    expect(parseSourceHead(head(1))).toEqual({ headers: head(1).slice(0, head(1).indexOf("\r\n\r\n")), attachments: [{ filename: "rechnung.pdf", contentType: "" }] });
  });

  test("one pass over a shard: INBOX history, Junk only as junk count, Sent ignored, auth from the source heads", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "spam-profile-build-"));
    const db = new Database(":memory:");
    try {
      db.exec(`CREATE TABLE messages (id TEXT, accountId TEXT, folderId TEXT, dateValue INTEGER, fromAddr TEXT, toAddr TEXT, ccAddr TEXT,
        replyToAddr TEXT, subject TEXT, messageId TEXT, listId TEXT, listUnsubscribe TEXT, body TEXT, htmlBody TEXT, hasSource INTEGER, deleted INTEGER)`);
      mkdirSync(path.join(dir, accountId));
      const insert = db.prepare("INSERT INTO messages VALUES (?, ?, ?, ?, ?, 'anna@example.test', NULL, NULL, 'Rechnung', NULL, NULL, NULL, 'Text', NULL, 1, 0)");
      for (let index = 0; index < 2100; index += 1) {
        const folderId = index < 2095 ? "inbox" : index < 2098 ? "junk" : "sent";
        insert.run(`m${index}`, accountId, folderId, Date.UTC(2026, 0, 1) + index * DAY / 30, "Service <notify@service.example.test>");
        writeFileSync(path.join(dir, accountId, `m${index}.eml`), head(index));
      }
      const built = await buildAccountSenderProfiles({ accountId, db, folders, ownAddresses: new Set(["anna@example.test"]), sourcesDir: dir });
      expect(built).toMatchObject({ rows: 2098, withSource: 2098 });
      const profile = built.profiles.get("notify@service.example.test");
      expect(profile).toMatchObject({ count: 2095, junkCount: 3, authAligned: 2095, attachmentCount: 2095, directCount: 2095 });
      expect(profile?.attachmentTypes).toEqual({ pdf: 2095 });
      expect(built.inboxMails.get("notify@service.example.test")).toHaveLength(2095);
      const withoutSources = await buildAccountSenderProfiles({ accountId, db, folders, ownAddresses: new Set() });
      expect(withoutSources.profiles.get("notify@service.example.test")).toMatchObject({ count: 2095, authAligned: 0, authUnknown: 2095 });
    } finally {
      db.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("stored arrival for the burst rule: Received stamp, else check time, else dateValue — never in the future", () => {
    const received = Date.UTC(2026, 5, 1, 10);
    const stamped = parseSourceHead(`Received: by mx.example.test; ${new Date(received).toUTCString()}\r\n${head(1)}`);
    const backdated = { dateValue: received - 30 * DAY, spamCheckedAt: received + 60_000 };
    expect(storedMailArrival(backdated, stamped)).toBe(received);
    expect(storedMailArrival(backdated, parseSourceHead(head(1)))).toBe(received + 60_000);
    expect(storedMailArrival(backdated, undefined)).toBe(received + 60_000);
    expect(storedMailArrival({ dateValue: received, spamCheckedAt: null }, undefined)).toBe(received);
    expect(storedMailArrival({ dateValue: Date.now() + 30 * DAY }, undefined)).toBeLessThanOrEqual(Date.now());
  });

  test("arrival from the Received stamp, not the backdated dateValue; stored \"Als Spam\" decisions become lastUserSpamAt", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "spam-profile-build-"));
    const db = new Database(":memory:");
    try {
      db.exec(`CREATE TABLE messages (id TEXT, accountId TEXT, folderId TEXT, dateValue INTEGER, fromAddr TEXT, toAddr TEXT, ccAddr TEXT,
        replyToAddr TEXT, subject TEXT, messageId TEXT, listId TEXT, listUnsubscribe TEXT, body TEXT, htmlBody TEXT, hasSource INTEGER, deleted INTEGER);
        CREATE TABLE spam_examples (id TEXT, accountId TEXT, senderEmail TEXT, label TEXT, createdAt INTEGER)`);
      mkdirSync(path.join(dir, accountId));
      const day = Date.UTC(2026, 5, 1);
      const insert = db.prepare("INSERT INTO messages VALUES (?, ?, 'inbox', ?, ?, 'anna@example.test', NULL, NULL, 'Hallo', NULL, NULL, NULL, 'Text', NULL, 1, 0)");
      for (let index = 0; index < 25; index += 1) {
        // dateValue follows the sender's Date header: spread over 60 days.
        insert.run(`m${index}`, accountId, day - (60 - index) * DAY, "Fresh <fresh@new.example.test>");
        writeFileSync(path.join(dir, accountId, `m${index}.eml`),
          `Received: by mx.example.test; ${new Date(day + index * 60_000).toUTCString()}\r\n${head(index).replace(/service/g, "new")}`);
      }
      insert.run("s1", accountId, day, "Service <notify@service.example.test>");
      const example = db.prepare("INSERT INTO spam_examples VALUES (?, ?, ?, ?, ?)");
      example.run("e1", accountId, "notify@service.example.test", "spam", day - DAY);
      example.run("e2", accountId, "notify@service.example.test", "spam", day + DAY);
      example.run("e3", accountId, "notify@service.example.test", "ham", day + 2 * DAY);
      example.run("e4", accountId, "only-junk@example.invalid", "spam", day);
      example.run("e5", "other-account", "fresh@new.example.test", "spam", day);
      const built = await buildAccountSenderProfiles({ accountId, db, folders, ownAddresses: new Set(["anna@example.test"]), sourcesDir: dir });
      const fresh = built.profiles.get("fresh@new.example.test");
      expect(fresh).toMatchObject({ count: 25, authAligned: 25, firstSeenAt: day, lastSeenAt: day + 24 * 60_000, lastUserSpamAt: null });
      expect(evaluateSenderTrust(fresh!, day + DAY)).toMatchObject({ trusted: false, reason: "zu kurze Historie" });
      expect(built.mails.get("fresh@new.example.test")?.map((mail) => mail.id)).toEqual(Array.from({ length: 25 }, (_, index) => `m${index}`));
      // The burst rule of the eval compares arrivals too.
      expect(built.inboxMails.get("fresh@new.example.test")?.map((mail) => mail.date)).toEqual(Array.from({ length: 25 }, (_, index) => day + index * 60_000));
      expect(built.profiles.get("notify@service.example.test")).toMatchObject({ count: 1, lastUserSpamAt: day + DAY });
      expect(built.profiles.get("only-junk@example.invalid")).toMatchObject({ count: 0, lastUserSpamAt: day });
      expect(Object.fromEntries(built.userSpam)).toEqual({ "notify@service.example.test": day + DAY, "only-junk@example.invalid": day });
    } finally {
      db.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
