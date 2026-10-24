import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import React from "react";
import { act, cleanup, waitFor } from "@testing-library/react";
import { render } from "@/lib/i18n/testRender";
import { Theme } from "@radix-ui/themes";
import { ThemeProvider } from "next-themes";
import { DEEP_LINK_LIST_PAGE_LIMIT } from "./constants";

// A link to a message far down a large folder opens the reader at once; the list
// reads a few pages to highlight it, never the whole folder.
const account = {
  id: "account-a", name: "Synthetic Alpha", email: "account-a@example.test", avatar: "", accessRole: "manager", settings: {},
  imap: { host: "imap.example.test", port: 993, secure: true, user: "account-a", password: "" },
  smtp: { host: "smtp.example.test", port: 465, secure: true, user: "account-a", password: "" }
};
const row = (id: string, subject: string) => ({
  id, accountId: "account-a", folderId: "account-a:INBOX", threadId: `${id}-t`, messageId: `<${id}@example.test>`,
  subject, from: "Sender <sender@example.test>", to: "account-a@example.test", cc: "", bcc: "",
  preview: "Synthetic", date: "10/23/2026, 9:00:00 AM", dateValue: Date.UTC(2026, 9, 23, 9), seen: true, unread: false,
  flags: [], groupKey: "Today", threadSortDateValue: Date.UTC(2026, 9, 23, 9), topics: [], topicSuggestions: []
});

let listPages: number[];
// Page the target row shows up on, if any (manual paging past the deep-link limit).
let targetPage: number | null;
// Holds the target page back until the test releases it.
let targetPageGate: Promise<void> | null;
const originals = { fetch: globalThis.fetch, eventSource: globalThis.EventSource };

beforeEach(() => {
  listPages = [];
  targetPage = null;
  targetPageGate = null;
  (window as unknown as { happyDOM: { setURL: (url: string) => void } }).happyDOM.setURL("http://localhost:4000/?a=~account-a&f=INBOX&m=~far-message");
  globalThis.EventSource = class extends EventTarget { close() {} } as unknown as typeof EventSource;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = (typeof input === "string" ? input : input instanceof URL ? input.href : input.url).replace(/^https?:\/\/[^/]+/, "");
    const path = url.split("?")[0];
    if (path === "/api/auth/me") return Response.json({ user: { id: "synthetic-user", email: "user@example.test", role: "user" },
      accounts: [account], accountId: "account-a", mailboxState: "selected", security: {}, ttlSeconds: 3600 });
    if (path === "/api/me/events") return new Response(new ReadableStream<Uint8Array>(), { headers: { "content-type": "text/event-stream" } });
    if (path === "/api/me/mailboxes/summary") return Response.json({ ok: true, mailboxes: [] });
    if (path === "/api/accounts/account-a/folders") {
      return Response.json([{ id: "account-a:INBOX", accountId: "account-a", name: "Inbox", specialUse: "\\Inbox", count: 100_000 }]);
    }
    if (path === "/api/accounts/account-a/messages/far-message") {
      return Response.json({ ok: true, message: { ...row("far-message", "Linked synthetic subject"), body: "Synthetic body", contentState: "stored" } });
    }
    if (/^\/api\/accounts\/account-a\/(threads|messages)$/.test(path)) {
      const page = Number(new URL(url, "http://x").searchParams.get("page") ?? "1");
      listPages.push(page);
      // Every page has more; the linked message is never among them.
      const items = [row(`row-${page}`, `Synthetic row ${page}`)];
      if (page === targetPage) {
        await targetPageGate;
        items.push(row("far-message", "Linked synthetic subject"));
      }
      return Response.json({ items, hasMore: true, total: 100_000 });
    }
    return Response.json({ ok: true, items: [], messages: [], total: 0, hasMore: false, topics: [], stats: [], aliases: [],
      events: [], reminders: [], members: [], prefs: {}, decisions: [], threads: [], conflicts: [] });
  }) as typeof fetch;
});

afterEach(() => {
  cleanup();
  globalThis.fetch = originals.fetch;
  globalThis.EventSource = originals.eventSource;
  window.history.replaceState(null, "", "/");
});

describe("deep link to a message outside the loaded list", () => {
  it("opens the reader and reads at most a few list pages looking for the row", async () => {
    const { default: MailClient } = await import("../MailClient");
    const view = render(<ThemeProvider attribute="class"><Theme><MailClient /></Theme></ThemeProvider>);
    await waitFor(() => expect(view.queryAllByText("Linked synthetic subject").length).toBeGreaterThan(0));
    await waitFor(() => expect(listPages).toContain(DEEP_LINK_LIST_PAGE_LIMIT));
    // Give a runaway pager time to ask for more.
    for (let i = 0; i < 10; i += 1) await act(() => new Promise<void>(resolve => setTimeout(resolve, 10)));
    expect(Math.max(...listPages)).toBe(DEEP_LINK_LIST_PAGE_LIMIT);
    expect(view.queryAllByText("Linked synthetic subject").length).toBeGreaterThan(0);
  });

  it("does not jump back to the target when the user pages further after the limit", async () => {
    targetPage = DEEP_LINK_LIST_PAGE_LIMIT + 1;
    const { default: MailClient } = await import("../MailClient");
    const view = render(<ThemeProvider attribute="class"><Theme><MailClient /></Theme></ThemeProvider>);
    await waitFor(() => expect(listPages).toContain(DEEP_LINK_LIST_PAGE_LIMIT));
    await waitFor(() => expect(view.queryAllByText(`Synthetic row ${DEEP_LINK_LIST_PAGE_LIMIT}`).length).toBeGreaterThan(0));
    // Let the reader's own open scroll settle before watching for a new one.
    for (let i = 0; i < 40; i += 1) await act(() => new Promise<void>(resolve => setTimeout(resolve, 10)));
    const scrolled: string[] = [];
    const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
    HTMLElement.prototype.scrollIntoView = function (this: HTMLElement) { scrolled.push(this.outerHTML.slice(0, 80)); };
    try {
      const pane = view.container.querySelector("aside");
      expect(pane).not.toBeNull();
      // The user scrolls to the end of the list and loads the next page, which holds the target.
      await act(async () => { pane!.dispatchEvent(new Event("scroll")); });
      await waitFor(() => expect(listPages).toContain(DEEP_LINK_LIST_PAGE_LIMIT + 1));
      for (let i = 0; i < 40; i += 1) await act(() => new Promise<void>(resolve => setTimeout(resolve, 10)));
      expect(scrolled).toEqual([]);
    } finally {
      HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
    }
  });

  it("still brings the target into view when it arrives on the last page the link reads", async () => {
    targetPage = DEEP_LINK_LIST_PAGE_LIMIT;
    let release = () => {};
    targetPageGate = new Promise<void>(resolve => { release = resolve; });
    const { default: MailClient } = await import("../MailClient");
    const view = render(<ThemeProvider attribute="class"><Theme><MailClient /></Theme></ThemeProvider>);
    await waitFor(() => expect(listPages).toContain(DEEP_LINK_LIST_PAGE_LIMIT));
    // Let the reader's own open scroll settle before the last page arrives.
    for (let i = 0; i < 40; i += 1) await act(() => new Promise<void>(resolve => setTimeout(resolve, 10)));
    const scrolled: string[] = [];
    const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
    HTMLElement.prototype.scrollIntoView = function (this: HTMLElement) { scrolled.push(this.outerHTML.slice(0, 80)); };
    try {
      await act(async () => { release(); });
      await waitFor(() => expect(view.container.querySelector('[data-message-id="far-message"]')).not.toBeNull());
      for (let i = 0; i < 40; i += 1) await act(() => new Promise<void>(resolve => setTimeout(resolve, 10)));
      expect(scrolled.length).toBeGreaterThan(0);
      expect(Math.max(...listPages)).toBe(DEEP_LINK_LIST_PAGE_LIMIT);
    } finally {
      HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
    }
  });
});
