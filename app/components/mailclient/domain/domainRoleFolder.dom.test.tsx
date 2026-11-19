import { afterEach, describe, expect, it } from "bun:test";
import React from "react";
import { cleanup, waitFor } from "@testing-library/react";
import { render } from "@/lib/i18n/testRender";
import { Theme } from "@radix-ui/themes";
import { ThemeProvider } from "next-themes";

// The domain view opened while the active mailbox showed its Drafts folder: the
// list must behave like the shown role (Inbox), not like the folder before it —
// one conversation row with its sender, not one row per message with recipients.
const DAY = Date.UTC(2026, 9, 23, 9);
const THREAD = "<question@example.test>";
function message(id: string, folder: string, from: string, minute: number, extra: Record<string, unknown> = {}) {
  return {
    id, accountId: "account-a", folderId: `account-a:${folder}`, threadId: THREAD, messageId: `<${id}@example.test>`,
    subject: "Synthetic question", from, to: "account-a@example.test", cc: "", bcc: "",
    preview: `Preview ${id}`, date: "10/23/2026, 9:00:00 AM", dateValue: DAY + minute * 60_000, seen: true, unread: false,
    flags: ["\\Seen"], groupKey: "Today", threadSortDateValue: DAY + 2 * 60_000, topics: [], topicSuggestions: [], ...extra
  };
}
const question = message("question", "INBOX", "Asker <asker@example.invalid>", 0);
const reply = message("reply", "Sent", "Synthetic <account-a@example.test>", 1,
  { to: "asker@example.invalid", inReplyTo: THREAD, parentId: "question" });
const draft = message("draft", "Drafts", "Synthetic <account-a@example.test>", 2,
  { to: "asker@example.invalid", inReplyTo: THREAD, parentId: "question", draft: true, flags: ["\\Seen", "\\Draft"] });
const originals = { fetch: globalThis.fetch, eventSource: globalThis.EventSource };

const account = {
  id: "account-a", name: "Synthetic account-a", email: "account-a@example.test", avatar: "", accessRole: "editor", settings: {},
  imap: { host: "", port: 993, secure: true, user: "", password: "" }, smtp: { host: "", port: 465, secure: true, user: "", password: "" }
};
const folders = [
  { id: "account-a:INBOX", accountId: "account-a", name: "Inbox", specialUse: "\\Inbox", count: 1, unreadCount: 0 },
  { id: "account-a:Sent", accountId: "account-a", name: "Sent", specialUse: "\\Sent", count: 1, unreadCount: 0 },
  { id: "account-a:Drafts", accountId: "account-a", name: "Drafts", specialUse: "\\Drafts", count: 1, unreadCount: 0 }
];

function setup() {
  (window as unknown as { happyDOM: { setURL: (url: string) => void } }).happyDOM
    .setURL("http://localhost:4000/?a=~account-a&f=Drafts&d=example.test");
  globalThis.EventSource = class extends EventTarget {
    url: string;
    constructor(url: string) { super(); this.url = url; }
    close() {}
  } as unknown as typeof EventSource;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = (typeof input === "string" ? input : input instanceof URL ? input.href : input.url).replace(/^https?:\/\/[^/]+/, "");
    const path = url.split("?")[0];
    if (path === "/api/auth/me") return Response.json({ user: { id: "synthetic-user", email: "user@example.test", role: "user" },
      accounts: [account], accountId: "account-a", mailboxState: "selected", security: {}, ttlSeconds: 3600 });
    if (path === "/api/me/events") return new Response(new ReadableStream<Uint8Array>(), { headers: { "content-type": "text/event-stream" } });
    if (path === "/api/domains/example.test/threads") {
      // As the server answers: the whole conversation of each listed thread, across folders.
      return Response.json({ domain: "example.test", role: "inbox", accounts: ["account-a"],
        folders: [{ accountId: "account-a", folderId: "account-a:INBOX" }], items: [draft, reply, question], hasMore: false, total: 3 });
    }
    if (path === "/api/accounts/account-a/folders") return Response.json(folders);
    return Response.json({ ok: true, items: [], messages: [], total: 0, hasMore: false, topics: [], stats: [], aliases: [],
      events: [], reminders: [], members: [], prefs: {}, decisions: [], threads: [], conflicts: [] });
  }) as typeof fetch;
}

afterEach(() => {
  cleanup();
  globalThis.fetch = originals.fetch;
  globalThis.EventSource = originals.eventSource;
  window.history.replaceState(null, "", "/");
});

describe("domain view opened from another folder", () => {
  it("groups the conversation and shows the sender, as in the shown role folder", async () => {
    setup();
    const { default: MailClient } = await import("../../MailClient");
    const view = render(<ThemeProvider attribute="class"><Theme><MailClient /></Theme></ThemeProvider>);
    await waitFor(() => {
      const rows = Array.from(view.container.querySelectorAll<HTMLElement>('[data-message-list-row="true"]'))
        .filter(element => element.textContent?.includes("Synthetic question"));
      expect(rows.length).toBe(1);
      expect(rows[0].textContent).toContain("Asker");
    });
    expect(new URL(window.location.href).searchParams.get("f")).not.toBe("Drafts");
  });
});
