import { describe, expect, test } from "bun:test";
import type { Account, Folder, Message } from "@/lib/data";
import { authenticatedTestCookie } from "@/lib/testAuthHarness";
import { dbModulePromise } from "@/lib/testDbHarness";

// The virtual-folder badges read their totals here instead of five full message lists.
// Each count must equal the list route's `total` for the same badges (search scope "all").
const { saveFoldersForAccount, upsertAccount, upsertMessages, withAccountDb } = await dbModulePromise;
const { GET: counts } = await import("@/app/api/accounts/[accountId]/messages/counts/route");
const { GET: messages } = await import("@/app/api/accounts/[accountId]/messages/route");

const account = (id: string) => ({ id, name: "Synthetic counts", email: "owner@example.test", avatar: "",
  imap: { host: "imap.example.test", port: 993, secure: true, user: "owner@example.test", password: "synthetic-imap" },
  smtp: { host: "smtp.example.test", port: 465, secure: true, user: "owner@example.test", password: "synthetic-smtp" } }) as Account;
const accountId = `acc-badge-counts-${crypto.randomUUID()}`;
const otherAccountId = `acc-badge-counts-other-${crypto.randomUUID()}`;
const inbox: Folder = { id: `${accountId}:INBOX`, accountId, name: "INBOX", count: 0, unreadCount: 0, specialUse: "\\Inbox" };
const trash: Folder = { id: `${accountId}:Trash`, accountId, name: "Trash", count: 0, unreadCount: 0, specialUse: "\\Trash" };
const message = (index: number, folder: Folder, patch: Partial<Message>): Message => {
  const dateValue = Date.UTC(2026, 9, 1, 8, index, 0);
  return { id: `${accountId}-m${index}`, accountId, folderId: folder.id, threadId: `<t${index}-${accountId}@example.test>`,
    messageId: `<m${index}-${accountId}@example.test>`, subject: `Synthetic ${index}`, from: "sender@example.test",
    to: "owner@example.test", preview: "Synthetic", date: new Date(dateValue).toISOString(), dateValue, body: "Synthetic",
    unread: false, ...patch };
};
await upsertAccount(account(accountId));
await upsertAccount(account(otherAccountId));
await saveFoldersForAccount(accountId, [inbox, trash]);
await upsertMessages(accountId, inbox.id, [
  message(0, inbox, { unread: true }),
  message(1, inbox, { unread: true, category: "newsletter" }),
  message(2, inbox, { unread: true, answered: true }),
  message(3, inbox, { flags: ["$Todo"] }),
  message(4, inbox, { unread: true, flags: ["calendar-invite"] }),
  message(5, inbox, { flags: ["calendar-invite"] }),
  message(6, inbox, { unread: true })
], true);
await upsertMessages(accountId, trash.id, [
  message(7, trash, { unread: true, flags: ["$Todo", "calendar-invite"] })
], true);
// Upsert derives the state columns from the IMAP flags; set them directly so the fixture is explicit.
const UNREAD = [0, 1, 2, 4, 6, 7];
await withAccountDb(accountId, (db: any) => {
  for (let index = 0; index < 8; index++) {
    db.prepare("UPDATE messages SET unread = ?, answered = ?, category = ?, spamVerdict = ? WHERE id = ?").run(
      UNREAD.includes(index) ? 1 : 0, index === 2 ? 1 : 0, index === 1 ? "newsletter" : null,
      [3, 6, 7].includes(index) ? "spam" : null, `${accountId}-m${index}`);
  }
});
const cookie = await authenticatedTestCookie(accountId);
const SETS = ["focused", "todo", "calendar", "calendar,unread", "suspicious,unread"];

async function getCounts(query: string, id = accountId) {
  const response = await counts(new Request(`http://localhost:3000/api/accounts/${id}/messages/counts?${query}`, { headers: { cookie } }),
    { params: Promise.resolve({ accountId: id }) });
  return { status: response.status, body: await response.json() as { ok: boolean; counts?: number[] } };
}
async function listTotal(badges: string, excludeFolderIds: string) {
  const q = new URLSearchParams({ page: "1", pageSize: "1", groupBy: "date", searchScope: "all", badges, excludeFolderIds });
  const response = await messages(new Request(`http://localhost:3000/api/accounts/${accountId}/messages?${q}`, { headers: { cookie } }),
    { params: Promise.resolve({ accountId }) });
  expect(response.status).toBe(200);
  return (await response.json() as { total: number }).total;
}
const setsQuery = (exclude: string) => `${SETS.map(set => `set=${encodeURIComponent(set)}`).join("&")}&excludeFolderIds=${encodeURIComponent(exclude)}`;

describe("GET /messages/counts", () => {
  test("each count equals the message list total for the same badges", async () => {
    for (const exclude of [trash.id, ""]) {
      const result = await getCounts(setsQuery(exclude));
      expect(result.status).toBe(200);
      const expected = [];
      for (const set of SETS) expected.push(await listTotal(set, exclude));
      expect(result.body.counts).toEqual(expected);
    }
  });

  test("counts the synthetic fixture as expected", async () => {
    // focused: unread, unanswered, not a newsletter (m0, m4, m6); todo: m3; calendar: m4, m5; spam+unread: m6.
    expect((await getCounts(setsQuery(trash.id))).body.counts).toEqual([3, 1, 2, 1, 1]);
    // Without the exclusion the trashed m7 joins every set.
    expect((await getCounts(setsQuery(""))).body.counts).toEqual([4, 2, 3, 2, 2]);
  });

  test("flag badge counts read the covering flags index, not the message rows", async () => {
    const statements: string[] = [];
    await withAccountDb(accountId, async (db: any) => {
      const prepare = db.prepare;
      db.prepare = function (sql: string, ...rest: unknown[]) {
        if (/COUNT\(\*\)/.test(sql)) statements.push(sql);
        return prepare.call(this, sql, ...rest);
      };
      try {
        expect((await getCounts(`set=todo&set=calendar&set=${encodeURIComponent("calendar,unread")}&excludeFolderIds=${encodeURIComponent(trash.id)}`)).status).toBe(200);
      } finally {
        db.prepare = prepare;
      }
      expect(statements).toHaveLength(3);
      for (const sql of statements) {
        const plan = (db.prepare(`EXPLAIN QUERY PLAN ${sql}`).all(...(sql.match(/\?/g) ?? []).map(() => "synthetic")).map((row: { detail: string }) => row.detail)).join(" | ");
        expect(plan).toMatch(/COVERING INDEX idx_messages_account_flags\b/);
      }
    });
  });

  test("rejects a missing or oversized set list", async () => {
    expect((await getCounts("excludeFolderIds=")).status).toBe(400);
    expect((await getCounts(Array.from({ length: 9 }, () => "set=unread").join("&"))).status).toBe(400);
  });

  test("rejects an excluded folder of another mailbox", async () => {
    const result = await getCounts(`set=unread&excludeFolderIds=${encodeURIComponent(`${otherAccountId}:INBOX`)}`);
    expect(result.status).toBe(400);
  });

  test("denies a mailbox the session is not a member of", async () => {
    const result = await getCounts("set=unread", otherAccountId);
    expect([403, 404]).toContain(result.status);
  });
});
