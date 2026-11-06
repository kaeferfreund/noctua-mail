import { beforeAll, describe, expect, test } from "bun:test";
import type { Account, Folder, Message } from "./data";
import { dbModulePromise } from "./testDbHarness";
import { createAuthenticatedTestSession } from "./testAuthHarness";
import {
  listDomainLinkedMessages,
  listDomainThreads,
  listReadableDomainAccounts
} from "./domainConversations";
import { normalizeConversationHeaderId } from "./db/messages/linkedConversation";
import { GET as getDomainThreads } from "@/app/api/domains/[domain]/threads/route";
import { POST as postThreadRelated } from "@/app/api/accounts/[accountId]/thread/related/route";

const api = await dbModulePromise;
const BASE = Date.UTC(2026, 2, 1, 9, 0, 0);
const MINUTE = 60_000;

type Principal = Awaited<ReturnType<typeof createAuthenticatedTestSession>>;

function syntheticAccount(id: string, email: string): Account {
  return {
    id, name: email.split("@")[0], email, avatar: "",
    imap: { host: "imap.example.test", port: 993, secure: true, user: email, password: "synthetic" },
    smtp: { host: "smtp.example.test", port: 465, secure: true, user: email, password: "synthetic" }
  };
}

function syntheticFolders(accountId: string): Folder[] {
  return [
    { id: `${accountId}:INBOX`, accountId, name: "INBOX", count: 0, unreadCount: 0, specialUse: "\\Inbox" },
    { id: `${accountId}:Sent`, accountId, name: "Sent", count: 0, unreadCount: 0, specialUse: "\\Sent" },
    { id: `${accountId}:Trash`, accountId, name: "Trash", count: 0, unreadCount: 0, specialUse: "\\Trash" },
    { id: `${accountId}:Drafts`, accountId, name: "Drafts", count: 0, unreadCount: 0, specialUse: "\\Drafts" }
  ];
}

function mail(accountId: string, folder: "INBOX" | "Sent" | "Trash" | "Drafts", input: {
  id: string; messageId: string; threadId: string; minute: number; inReplyTo?: string; references?: string[];
  parentId?: string; subject?: string; draft?: boolean;
}): Message {
  const dateValue = BASE + input.minute * MINUTE;
  return {
    id: input.id, accountId, folderId: `${accountId}:${folder}`, threadId: input.threadId, parentId: input.parentId,
    messageId: input.messageId, inReplyTo: input.inReplyTo, references: input.references,
    subject: input.subject ?? "Synthetic domain conversation", from: "customer@example.invalid", to: "team@example.test",
    preview: `Preview ${input.id}`, date: new Date(dateValue).toISOString(), dateValue, body: `Body ${input.id}`,
    draft: input.draft
  };
}

async function seedAccount(account: Account, messages: Message[]) {
  await api.upsertAccount(account);
  await api.saveFoldersForAccount(account.id, syntheticFolders(account.id));
  if (messages.length > 0) {
    await api.upsertMessages(account.id, null, messages);
  }
}

/**
 * Domain d.example.test with three mailboxes:
 * - judith (A): customer mail X, a CC copy C (also in kontakt), a trashed reply T to X.
 * - kontakt (B): reply Y to X in Sent (stored under its own thread id), the CC copy C,
 *   a draft reply D to X, and an unrelated mail U.
 * - hidden (H): same domain, the principal is no member; holds reply Z to X.
 * - other@other.example.test (O): different domain, member; holds reply Q to X.
 */
async function fixture(memberOf: Array<"A" | "B" | "H" | "O"> = ["A", "B", "O"]) {
  const tag = crypto.randomUUID().slice(0, 8);
  const domain = `d${tag}.example.test`;
  const ids = { A: `dc-a-${tag}`, B: `dc-b-${tag}`, H: `dc-h-${tag}`, O: `dc-o-${tag}` };
  const accounts = {
    A: syntheticAccount(ids.A, `judith@${domain}`),
    B: syntheticAccount(ids.B, `kontakt@${domain}`),
    H: syntheticAccount(ids.H, `hidden@${domain}`),
    O: syntheticAccount(ids.O, `other@o${tag}.example.test`)
  };
  const X = `<x-${tag}@example.invalid>`;
  const Y = `<y-${tag}@${domain}>`;
  const C = `<c-${tag}@example.invalid>`;
  await seedAccount(accounts.A, [
    mail(ids.A, "INBOX", { id: `x-${tag}`, messageId: X, threadId: X, minute: 0 }),
    mail(ids.A, "INBOX", { id: `c-${tag}`, messageId: C, threadId: X, minute: 5, inReplyTo: X, references: [X], parentId: `x-${tag}` }),
    mail(ids.A, "Trash", { id: `t-${tag}`, messageId: `<t-${tag}@example.invalid>`, threadId: X, minute: 6, inReplyTo: X, references: [X] })
  ]);
  await seedAccount(accounts.B, [
    // Own thread id: matched through the Message-ID of X in its References, not through the thread id.
    mail(ids.B, "Sent", { id: `y-${tag}`, messageId: Y, threadId: `<other-root-${tag}>`, minute: 10, inReplyTo: X.toUpperCase(), references: [X.toUpperCase()] }),
    mail(ids.B, "INBOX", { id: `c-${tag}`, messageId: C, threadId: X, minute: 5, inReplyTo: X, references: [X] }),
    mail(ids.B, "Drafts", { id: `d-${tag}`, messageId: `<d-${tag}@${domain}>`, threadId: X, minute: 11, inReplyTo: X, references: [X], draft: true }),
    mail(ids.B, "INBOX", { id: `u-${tag}`, messageId: `<u-${tag}@example.invalid>`, threadId: `<u-${tag}@example.invalid>`, minute: 20 })
  ]);
  await seedAccount(accounts.H, [
    mail(ids.H, "INBOX", { id: `z-${tag}`, messageId: `<z-${tag}@example.invalid>`, threadId: X, minute: 12, inReplyTo: X, references: [X] })
  ]);
  await seedAccount(accounts.O, [
    mail(ids.O, "INBOX", { id: `q-${tag}`, messageId: `<q-${tag}@example.invalid>`, threadId: X, minute: 13, inReplyTo: X, references: [X] })
  ]);
  const principal = await createAuthenticatedTestSession();
  for (const key of memberOf) await principal.addMembership(principal.user.id, ids[key], "viewer");
  return { tag, domain, ids, accounts, X, Y, C, principal };
}

function jsonRequest(principal: Principal, url: string, body?: unknown) {
  return new Request(url, {
    method: body === undefined ? "GET" : "POST",
    headers: principal.jar.headers({
      origin: "http://localhost:3000",
      "content-type": "application/json",
      "x-noctua-client": "test_browser"
    }),
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
}

async function openConversation(principal: Principal, accountId: string, threadId: string, anchorMessageId: string) {
  const response = await postThreadRelated(
    jsonRequest(principal, `http://localhost:3000/api/accounts/${accountId}/thread/related`, {
      threadIds: [threadId],
      projection: "headers",
      excludeFolderIds: [`${accountId}:Trash`],
      window: { anchorMessageId }
    }),
    { params: Promise.resolve({ accountId }) }
  );
  return { status: response.status, data: (response.status === 200 ? await response.json() : null) as { items: Message[]; linked: Message[] } | null };
}

let base: Awaited<ReturnType<typeof fixture>>;
beforeAll(async () => { base = await fixture(); });

describe("header id normalization", () => {
  test("trims, lower-cases and drops angle brackets", () => {
    expect(normalizeConversationHeaderId("  <AbC@Example.Test> ")).toBe("abc@example.test");
    expect(normalizeConversationHeaderId("abc@example.test")).toBe("abc@example.test");
    expect(normalizeConversationHeaderId("  ")).toBeNull();
    expect(normalizeConversationHeaderId(null)).toBeNull();
  });
});

describe("readable domain mailboxes", () => {
  test("only member mailboxes of the domain, never other domains or non-member mailboxes", async () => {
    const accounts = await listReadableDomainAccounts(base.principal.user.id, base.domain.toUpperCase());
    expect(accounts.map((account) => account.id).sort()).toEqual([base.ids.A, base.ids.B].sort());
  });
});

describe("conversation across mailboxes of one domain", () => {
  test("judith's conversation shows kontakt's reply, once per Message-ID, own copy preferred", async () => {
    const linked = await listDomainLinkedMessages({
      userId: base.principal.user.id,
      account: base.accounts.A,
      threadId: base.X,
      excludeFolderIds: [`${base.ids.A}:Trash`]
    });
    // Y comes from kontakt; the CC copy C stays judith's; drafts, other domains and
    // mailboxes without access never appear.
    expect(linked.map((item) => [item.accountId, item.id])).toEqual([[base.ids.B, `y-${base.tag}`]]);
    expect(linked[0].threadId).toBe(base.X);
    expect(linked[0].linkedThreadId).toBe(`<other-root-${base.tag}>`);
    expect(linked[0].parentId).toBe(`x-${base.tag}`);
    expect(linked[0].body ?? "").toBe("");
  });

  test("kontakt's Sent conversation shows judith's received mail", async () => {
    const linked = await listDomainLinkedMessages({
      userId: base.principal.user.id,
      account: base.accounts.B,
      threadId: `<other-root-${base.tag}>`
    });
    // X and judith's copy of C are linked; judith's trashed reply T never is.
    expect(linked.map((item) => item.id)).toEqual([`x-${base.tag}`, `c-${base.tag}`]);
    expect(linked.every((item) => item.accountId === base.ids.A)).toBe(true);
    // Ordered by date; the copy of C replies to X.
    expect(linked[1].parentId).toBe(`x-${base.tag}`);
  });

  test("the reader route returns linked rows next to the window", async () => {
    const { status, data } = await openConversation(base.principal, base.ids.A, base.X, `x-${base.tag}`);
    expect(status).toBe(200);
    expect(data!.items.every((item) => item.accountId === base.ids.A)).toBe(true);
    expect(data!.linked.map((item) => item.id)).toEqual([`y-${base.tag}`]);
  });

  test("a user with access to judith only never gets kontakt's messages", async () => {
    const onlyA = await fixture(["A"]);
    const linked = await listDomainLinkedMessages({ userId: onlyA.principal.user.id, account: onlyA.accounts.A, threadId: onlyA.X });
    expect(linked).toEqual([]);
    const { status, data } = await openConversation(onlyA.principal, onlyA.ids.A, onlyA.X, `x-${onlyA.tag}`);
    expect(status).toBe(200);
    expect(data!.linked).toEqual([]);
    expect(JSON.stringify(data)).not.toContain(onlyA.ids.B);
  });

  test("revoking access removes the peer mailbox on the next read", async () => {
    const f = await fixture(["A", "B"]);
    expect((await listDomainLinkedMessages({ userId: f.principal.user.id, account: f.accounts.A, threadId: f.X })).length).toBe(1);
    f.principal.master.prepare("DELETE FROM user_accounts WHERE userId=? AND accountId=?").run(f.principal.user.id, f.ids.B);
    expect(await listDomainLinkedMessages({ userId: f.principal.user.id, account: f.accounts.A, threadId: f.X })).toEqual([]);
  });
});

describe("domain view thread list", () => {
  test("merges member mailboxes of the domain, newest first, one row per Message-ID", async () => {
    const accounts = await listReadableDomainAccounts(base.principal.user.id, base.domain);
    const data = await listDomainThreads({ accounts, role: "inbox", page: 1, pageSize: 50, viewerUserId: base.principal.user.id });
    const accountIds = new Set(data.items.map((item) => item.accountId));
    expect(accountIds.has(base.ids.H)).toBe(false);
    expect(accountIds.has(base.ids.O)).toBe(false);
    const dates = data.items.map((item) => item.threadSortDateValue ?? item.dateValue);
    expect(dates).toEqual([...dates].sort((a, b) => b - a));
    expect(new Set(data.items.map((item) => item.id)).size).toBe(data.items.length);
    expect(data.items[0].id).toBe(`u-${base.tag}`);
    expect(data.folders.map((entry) => entry.folderId).sort()).toEqual([`${base.ids.A}:INBOX`, `${base.ids.B}:INBOX`].sort());
  });

  test("the sent role maps to each mailbox's own Sent folder", async () => {
    const accounts = await listReadableDomainAccounts(base.principal.user.id, base.domain);
    const data = await listDomainThreads({ accounts, role: "sent", page: 1, pageSize: 50, viewerUserId: base.principal.user.id });
    expect(data.items.map((item) => item.id)).toEqual([`y-${base.tag}`]);
  });

  test("paging splits the merged list without gaps or repeats", async () => {
    const accounts = await listReadableDomainAccounts(base.principal.user.id, base.domain);
    const all = await listDomainThreads({ accounts, role: "inbox", page: 1, pageSize: 50, viewerUserId: base.principal.user.id });
    const first = await listDomainThreads({ accounts, role: "inbox", page: 1, pageSize: 1, viewerUserId: base.principal.user.id });
    const second = await listDomainThreads({ accounts, role: "inbox", page: 2, pageSize: 1, viewerUserId: base.principal.user.id });
    expect(first.hasMore).toBe(true);
    expect([...first.items, ...second.items].map((item) => item.id)).toEqual(all.items.slice(0, 2).map((item) => item.id));
  });

  test("route: only readable mailboxes; a domain without access answers 404", async () => {
    const onlyA = await fixture(["A"]);
    const route = (domain: string) => getDomainThreads(
      jsonRequest(onlyA.principal, `http://localhost:3000/api/domains/${encodeURIComponent(domain)}/threads?role=inbox`),
      { params: Promise.resolve({ domain: encodeURIComponent(domain) }) }
    );
    const ok = await route(onlyA.domain);
    expect(ok.status).toBe(200);
    const data = await ok.json() as { items: Message[]; accounts: string[] };
    expect(data.accounts).toEqual([onlyA.ids.A]);
    expect(data.items.every((item) => item.accountId === onlyA.ids.A)).toBe(true);
    expect(JSON.stringify(data)).not.toContain(onlyA.ids.B);
    expect((await route(`unknown-${onlyA.tag}.example.test`)).status).toBe(404);
    expect((await route("not a domain")).status).toBe(400);
  });
});
