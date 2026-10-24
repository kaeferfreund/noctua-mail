import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import React from "react";
import { act, cleanup, waitFor } from "@testing-library/react";
import { render } from "@/lib/i18n/testRender";
import { Theme } from "@radix-ui/themes";
import { ThemeProvider } from "next-themes";

// Folder counts change all the time (stream updates, read state). The reader's
// conversation read must not run again for them: no new window or body requests.
const account = {
  id: "account-a", name: "Synthetic Alpha", email: "account-a@example.test", avatar: "", accessRole: "manager", settings: {},
  imap: { host: "imap.example.test", port: 993, secure: true, user: "account-a", password: "" },
  smtp: { host: "smtp.example.test", port: 465, secure: true, user: "account-a", password: "" }
};
const row = {
  id: "open-message", accountId: "account-a", folderId: "account-a:INBOX", threadId: "open-thread", messageId: "<open-message@example.test>",
  subject: "Opened synthetic subject", from: "Sender <sender@example.test>", to: "account-a@example.test", cc: "", bcc: "",
  preview: "Synthetic", date: "10/23/2026, 9:00:00 AM", dateValue: Date.UTC(2026, 9, 23, 9), seen: true, unread: false,
  flags: [], groupKey: "Today", threadSortDateValue: Date.UTC(2026, 9, 23, 9), topics: [], topicSuggestions: []
};

let requests: string[];
let streams: EventTarget[];
const originals = { fetch: globalThis.fetch, eventSource: globalThis.EventSource };

beforeEach(() => {
  requests = [];
  streams = [];
  (window as unknown as { happyDOM: { setURL: (url: string) => void } }).happyDOM.setURL("http://localhost:4000/?a=~account-a&f=INBOX&m=~open-message");
  globalThis.EventSource = class extends EventTarget {
    url: string;
    constructor(url: string) { super(); this.url = url; streams.push(this); }
    close() {}
  } as unknown as typeof EventSource;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = (typeof input === "string" ? input : input instanceof URL ? input.href : input.url).replace(/^https?:\/\/[^/]+/, "");
    const path = url.split("?")[0];
    requests.push(`${init?.method ?? "GET"} ${url}`);
    if (path === "/api/auth/me") return Response.json({ user: { id: "synthetic-user", email: "user@example.test", role: "user" },
      accounts: [account], accountId: "account-a", mailboxState: "selected", security: {}, ttlSeconds: 3600 });
    if (path === "/api/me/events") return new Response(new ReadableStream<Uint8Array>(), { headers: { "content-type": "text/event-stream" } });
    if (path === "/api/me/mailboxes/summary") return Response.json({ ok: true, mailboxes: [] });
    if (path === "/api/accounts/account-a/folders") {
      return Response.json([{ id: "account-a:INBOX", accountId: "account-a", name: "Inbox", specialUse: "\\Inbox", count: 1, unreadCount: 0 }]);
    }
    if (path === "/api/accounts/account-a/messages/open-message") {
      return Response.json({ ok: true, message: { ...row, body: "Synthetic body", contentState: "stored" } });
    }
    // The conversation read fails; a count update is no reason to try again.
    if (path === "/api/accounts/account-a/thread/related") return Response.json({ ok: false, message: "Synthetic failure" }, { status: 500 });
    if (/^\/api\/accounts\/account-a\/(threads|messages)$/.test(path)) return Response.json({ items: [row], hasMore: false, total: 1 });
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

const settle = async () => {
  for (let i = 0; i < 20; i += 1) await act(() => new Promise<void>(resolve => setTimeout(resolve, 10)));
};
const readerRequests = () =>
  requests.filter(request => request.includes("/thread/related") || request.includes("/messages/open-message"));

describe("reader and folder count updates", () => {
  it("a folder count update re-issues no conversation or body read", async () => {
    const { default: MailClient } = await import("../MailClient");
    const view = render(<ThemeProvider attribute="class"><Theme><MailClient /></Theme></ThemeProvider>);
    await waitFor(() => expect(view.queryAllByText("Opened synthetic subject").length).toBeGreaterThan(0));
    await waitFor(() => expect(requests.some(request => request.startsWith("POST /api/accounts/account-a/thread/related"))).toBe(true));
    await waitFor(() => expect(streams.some(stream => (stream as unknown as { url: string }).url.includes("/stream"))).toBe(true));
    await settle();
    const before = readerRequests();
    const stream = streams.find(source => (source as unknown as { url: string }).url.includes("/stream"))!;
    for (const exists of [2, 3]) {
      await act(async () => {
        stream.dispatchEvent(new MessageEvent("folder:update", { data: JSON.stringify([{ id: "account-a:INBOX", exists, unseen: 1 }]) }));
      });
      await settle();
    }
    expect(readerRequests()).toEqual(before);
  });
});
