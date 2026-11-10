import { afterEach, describe, expect, it } from "bun:test";
import React from "react";
import { act, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { render } from "@/lib/i18n/testRender";
import { Theme } from "@radix-ui/themes";
import { ThemeProvider } from "next-themes";

// Domain view of three synthetic mailboxes of example.test: account-a (active,
// editor), account-b (editor), account-c (viewer, read only). A selection across
// all three acts in each message's own mailbox; account-c is skipped with a notice.
const DAY = Date.UTC(2026, 10, 10, 9);
const ACCOUNTS = ["account-a", "account-b", "account-c"] as const;
function row(accountId: string, minute: number) {
  const id = `${accountId}-message`;
  return {
    id, accountId, folderId: `${accountId}:INBOX`, threadId: `<${id}@example.test>`, messageId: `<${id}@example.test>`,
    subject: `Subject of ${accountId}`, from: "Sender <sender@example.invalid>", to: `${accountId}@example.test`, cc: "", bcc: "",
    preview: `Preview ${id}`, date: "11/10/2026, 9:00:00 AM", dateValue: DAY + minute * 60_000, seen: false, unread: true,
    flags: [], groupKey: "Today", threadSortDateValue: DAY + minute * 60_000, topics: [], topicSuggestions: [],
    imapUid: minute + 1, mailboxPath: "INBOX"
  };
}
const rows = ACCOUNTS.map((accountId, index) => row(accountId, index));
const originals = { fetch: globalThis.fetch, eventSource: globalThis.EventSource };

function account(id: string) {
  return {
    id, name: `Synthetic ${id}`, email: `${id}@example.test`, avatar: "", accessRole: id === "account-c" ? "viewer" : "editor",
    settings: {}, imap: { host: "", port: 993, secure: true, user: "", password: "" },
    smtp: { host: "", port: 465, secure: true, user: "", password: "" }
  };
}
const folders = (id: string) => [
  { id: `${id}:INBOX`, accountId: id, name: "Inbox", specialUse: "\\Inbox", count: 1, unreadCount: 1 },
  { id: `${id}:Archive`, accountId: id, name: "Archive", specialUse: "\\Archive", count: 0, unreadCount: 0 },
  { id: `${id}:Trash`, accountId: id, name: "Trash", specialUse: "\\Trash", count: 0, unreadCount: 0 }
];

type Call = { method: string; path: string; body: Record<string, unknown> | null };
function setup() {
  const calls: Call[] = [];
  (window as unknown as { happyDOM: { setURL: (url: string) => void } }).happyDOM.setURL("http://localhost:4000/?a=~account-a&d=example.test");
  globalThis.EventSource = class extends EventTarget {
    url: string;
    constructor(url: string) { super(); this.url = url; }
    close() {}
  } as unknown as typeof EventSource;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = (typeof input === "string" ? input : input instanceof URL ? input.href : input.url).replace(/^https?:\/\/[^/]+/, "");
    const path = url.split("?")[0];
    const method = init?.method ?? "GET";
    let body: Record<string, unknown> | null = null;
    try { body = init?.body ? JSON.parse(String(init.body)) : null; } catch { body = null; }
    calls.push({ method, path, body });
    if (path === "/api/auth/me") return Response.json({ user: { id: "synthetic-user", email: "user@example.test", role: "user" },
      accounts: ACCOUNTS.map(account), accountId: "account-a", mailboxState: "selected", security: {}, ttlSeconds: 3600 });
    if (path === "/api/me/events") return new Response(new ReadableStream<Uint8Array>(), { headers: { "content-type": "text/event-stream" } });
    if (path === "/api/domains/example.test/threads") {
      return Response.json({ domain: "example.test", role: "inbox", accounts: [...ACCOUNTS],
        folders: ACCOUNTS.map((accountId) => ({ accountId, folderId: `${accountId}:INBOX` })),
        items: rows, hasMore: false, total: rows.length });
    }
    const folderMatch = /^\/api\/accounts\/(account-[abc])\/folders$/.exec(path);
    if (folderMatch) return Response.json(folders(folderMatch[1]!));
    const accountId = path.split("/")[3] ?? "";
    // The empty synthetic mailbox asks for a sync; answer it without a job.
    if (method === "POST" && path.endsWith("/sync")) return Response.json({ ok: true, jobId: "synthetic-job", status: "done" });
    if (path.endsWith("/sync/status")) return Response.json({ ok: true, status: "idle", running: false });
    if (method === "POST" && path.endsWith("/messages/flags/bulk")) {
      if (accountId === "account-c") return Response.json({ ok: false, message: "Forbidden" }, { status: 403 });
      return Response.json({ ok: true, results: (body?.messageIds as string[]).map((messageId) => ({ messageId, flags: ["\\Seen"] })) });
    }
    if (method === "POST" && path.endsWith("/messages/move")) {
      const ids = (body?.messageIds as string[]) ?? [];
      return Response.json({ ok: true, queued: true, destinationFolderId: body?.destinationFolderId,
        movedIds: ids.map((id) => ({ previousId: id, nextId: id })),
        undoTargets: ids.map((id) => ({ messageId: id, restoreFolderId: `${accountId}:INBOX` })) });
    }
    if (method === "POST" && path.endsWith("/archive")) {
      return Response.json({ ok: true, action: "moved", archiveFolderId: `${accountId}:Archive`, archiveMailbox: "Archive",
        messageId: path.split("/")[5] });
    }
    for (const message of rows) {
      if (path === `/api/accounts/${message.accountId}/messages/${message.id}`) {
        return Response.json({ ok: true, message: { ...message, body: `Body ${message.id}`, contentState: "stored" } });
      }
    }
    return Response.json({ ok: true, items: [], messages: [], total: 0, hasMore: false, topics: [], stats: [], aliases: [],
      events: [], reminders: [], members: [], prefs: {}, decisions: [], threads: [], conflicts: [] });
  }) as typeof fetch;
  return calls;
}

afterEach(() => {
  cleanup();
  globalThis.fetch = originals.fetch;
  globalThis.EventSource = originals.eventSource;
  window.history.replaceState(null, "", "/");
});

async function renderDomainView() {
  const calls = setup();
  const { default: MailClient } = await import("../../MailClient");
  const view = render(<ThemeProvider attribute="class"><Theme><MailClient /></Theme></ThemeProvider>);
  const listRows = await waitFor(() => {
    const found = Array.from(view.container.querySelectorAll<HTMLElement>('[data-message-list-row="true"]'));
    expect(found.length).toBe(3);
    return found;
  });
  // The other mailboxes' folders are read through their own routes.
  await waitFor(() => {
    for (const accountId of ["account-b", "account-c"]) {
      expect(calls.some((call) => call.path === `/api/accounts/${accountId}/folders`)).toBe(true);
    }
  });
  fireEvent.click(listRows[0]!);
  fireEvent.keyDown(listRows[0]!, { key: "a", ctrlKey: true });
  return { view, calls, firstRow: listRows[0]! };
}

// Requests per mailbox, in mailbox order (the list shows the newest first).
const posts = (calls: Call[], suffix: string, from = 0) =>
  calls.filter((call) => call.method === "POST" && call.path.endsWith(suffix)).slice(from)
    .map((call) => [call.path.split("/")[3], call.body] as const)
    .sort(([a], [b]) => String(a).localeCompare(String(b)));

describe("selection actions in the domain view", () => {
  it("marks a selection across mailboxes read in each mailbox and names the read-only one", async () => {
    const { view, calls, firstRow } = await renderDomainView();
    fireEvent.keyDown(firstRow, { key: "r" });
    await waitFor(() => expect(posts(calls, "/flags/bulk").length).toBe(2));
    expect(posts(calls, "/flags/bulk")).toEqual([
      ["account-a", { flag: "seen", value: true, messageIds: ["account-a-message"] }],
      ["account-b", { flag: "seen", value: true, messageIds: ["account-b-message"] }]
    ]);
    await view.findByText("1 of 3 messages not marked as read");
    expect(view.getByText(
      "1 of 3 messages was not marked as read: no permission in mailbox account-c@example.test. The others were marked as read."
    )).toBeTruthy();
    // Rows of every mailbox stay listed (only their read state changed).
    expect(view.container.querySelectorAll('[data-message-list-row="true"]').length).toBe(3);
  });

  it("deletes a selection across mailboxes into each mailbox's trash and skips the read-only one", async () => {
    const { view, calls, firstRow } = await renderDomainView();
    fireEvent.keyDown(firstRow, { key: "Delete" });
    await waitFor(() => expect(posts(calls, "/messages/move").length).toBe(2));
    expect(posts(calls, "/messages/move")).toEqual([
      ["account-a", { messageIds: ["account-a-message"], destinationFolderId: "account-a:Trash" }],
      ["account-b", { messageIds: ["account-b-message"], destinationFolderId: "account-b:Trash" }]
    ]);
    await view.findByText("1 of 3 messages was not deleted: no permission in mailbox account-c@example.test. The others were deleted.");
    await view.findByText("Moved 2 messages to Trash.");
    await waitFor(() => {
      const left = Array.from(view.container.querySelectorAll<HTMLElement>('[data-message-list-row="true"]'));
      expect(left.map((element) => element.textContent?.includes("Subject of account-c"))).toEqual([true]);
    });
    // Undo moves each message back in its own mailbox.
    await act(async () => { fireEvent.click(view.getAllByRole("button", { name: "Undo" })[0]!); });
    await waitFor(() => expect(posts(calls, "/messages/move").length).toBe(4));
    expect(posts(calls, "/messages/move", 2)).toEqual([
      ["account-a", { messageIds: ["account-a-message"], destinationFolderId: "account-a:INBOX" }],
      ["account-b", { messageIds: ["account-b-message"], destinationFolderId: "account-b:INBOX" }]
    ]);
  });

  it("archives a selection across mailboxes from the bulk menu in each mailbox", async () => {
    const { view, calls, firstRow } = await renderDomainView();
    fireEvent.contextMenu(firstRow);
    fireEvent.click(await view.findByRole("menuitem", { name: "Archive" }));
    await waitFor(() => expect(posts(calls, "/archive").length).toBe(2));
    expect(calls.filter((call) => call.path.endsWith("/archive")).map((call) => call.path).sort()).toEqual([
      "/api/accounts/account-a/messages/account-a-message/archive",
      "/api/accounts/account-b/messages/account-b-message/archive"
    ]);
    await view.findByText("1 of 3 messages was not archived: no permission in mailbox account-c@example.test. The others were archived.");
    await waitFor(() => {
      const left = Array.from(view.container.querySelectorAll<HTMLElement>('[data-message-list-row="true"]'));
      expect(left.map((element) => element.textContent?.includes("Subject of account-c"))).toEqual([true]);
    });
  });
});
