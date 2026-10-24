import { describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import type { Folder } from "@/lib/data";
import { buildAccountSenderProfiles, parseSourceHead } from "./profileBuild";

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
});
