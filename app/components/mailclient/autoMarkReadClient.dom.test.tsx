import { afterEach, describe, expect, it } from "bun:test";
import React from "react";
import { act, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { render } from "@/lib/i18n/testRender";
import { Theme } from "@radix-ui/themes";
import { ThemeProvider } from "next-themes";
import type { AccountRole, AutoMarkReadMode } from "@/lib/data";

// Auto-read in the full client: role gate, `u` during the dwell, and order
// against a manual action while the auto-read request is still running.
const row = {
  id: "open-message", accountId: "account-a", folderId: "account-a:INBOX", threadId: "open-thread", messageId: "<open-message@example.test>",
  subject: "Opened synthetic subject", from: "Sender <sender@example.test>", to: "account-a@example.test", cc: "", bcc: "",
  preview: "Synthetic", date: "10/23/2026, 9:00:00 AM", dateValue: Date.UTC(2026, 9, 23, 9), seen: false, unread: true,
  flags: [], groupKey: "Today", threadSortDateValue: Date.UTC(2026, 9, 23, 9), topics: [], topicSuggestions: []
};
const FLAGS = "/api/accounts/account-a/messages/open-message/flags";

let flagBodies: { flag: string; value: boolean }[];
let holdAutoRead: Promise<void> | null;
let failures = 0;
const originals = { fetch: globalThis.fetch, eventSource: globalThis.EventSource };

function setup(role: AccountRole, mode: AutoMarkReadMode) {
  flagBodies = [];
  holdAutoRead = null;
  failures = 0;
  const account = {
    id: "account-a", name: "Synthetic Alpha", email: "account-a@example.test", avatar: "", accessRole: role, settings: {},
    imap: { host: "", port: 993, secure: true, user: "", password: "" }, smtp: { host: "", port: 465, secure: true, user: "", password: "" }
  };
  (window as unknown as { happyDOM: { setURL: (url: string) => void } }).happyDOM.setURL("http://localhost:4000/?a=~account-a&f=INBOX&m=~open-message");
  globalThis.EventSource = class extends EventTarget {
    url: string;
    constructor(url: string) { super(); this.url = url; }
    close() {}
  } as unknown as typeof EventSource;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = (typeof input === "string" ? input : input instanceof URL ? input.href : input.url).replace(/^https?:\/\/[^/]+/, "");
    const path = url.split("?")[0];
    if (path === "/api/auth/me") return Response.json({ user: { id: "synthetic-user", email: "user@example.test", role: "user" },
      accounts: [account], accountId: "account-a", mailboxState: "selected", security: {}, ttlSeconds: 3600 });
    if (path === "/api/me/events") return new Response(new ReadableStream<Uint8Array>(), { headers: { "content-type": "text/event-stream" } });
    if (path === "/api/me/mailboxes/summary") return Response.json({ ok: true, mailboxes: [] });
    if (path === "/api/accounts/account-a/prefs") return Response.json({ ok: true, prefs: { reading: { autoMarkRead: mode } } });
    if (path === "/api/accounts/account-a/folders") {
      return Response.json([{ id: "account-a:INBOX", accountId: "account-a", name: "Inbox", specialUse: "\\Inbox", count: 1, unreadCount: 1 }]);
    }
    if (path === "/api/accounts/account-a/messages/open-message") {
      return Response.json({ ok: true, message: { ...row, body: "Synthetic body", contentState: "stored" } });
    }
    if (path === FLAGS) {
      const body = JSON.parse(String(init?.body)) as { flag: string; value: boolean };
      flagBodies.push(body);
      if (role === "viewer") return Response.json({ ok: false, message: "Insufficient mailbox role" }, { status: 403 });
      if (body.value && failures > 0) { failures--; return Response.json({ message: "Synthetic flag failure" }, { status: 500 }); }
      if (body.value && holdAutoRead) await holdAutoRead;
      return Response.json({ ok: true, flags: body.value ? ["\\Seen"] : [] });
    }
    if (/^\/api\/accounts\/account-a\/(threads|messages)$/.test(path)) return Response.json({ items: [row], hasMore: false, total: 1 });
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

const wait = (ms: number) => act(() => new Promise<void>(resolve => setTimeout(resolve, ms)));

async function openClient() {
  const { default: MailClient } = await import("../MailClient");
  const view = render(<ThemeProvider attribute="class"><Theme><MailClient /></Theme></ThemeProvider>);
  await waitFor(() => expect(view.queryAllByText("Opened synthetic subject").length).toBeGreaterThan(0));
  return view;
}

describe("auto-read in the mail client", () => {
  it("marks the opened unread message read for an editor", async () => {
    setup("editor", "immediate");
    await openClient();
    await waitFor(() => expect(flagBodies).toEqual([{ flag: "seen", value: true }]));
  });

  it("never marks for a viewer and shows no error", async () => {
    setup("viewer", "immediate");
    const view = await openClient();
    await wait(800);
    expect(flagBodies).toEqual([]);
    expect(view.queryByText(/Insufficient mailbox role/)).toBeNull();
  });

  it("keeps the message unread when the user presses u during the dwell", async () => {
    setup("editor", "after1s");
    await openClient();
    await wait(300);
    fireEvent.keyDown(window, { key: "u" });
    await waitFor(() => expect(flagBodies).toEqual([{ flag: "seen", value: false }]));
    await wait(1500);
    expect(flagBodies).toEqual([{ flag: "seen", value: false }]);
  });

  it("sends a manual unread after a running auto-read request, so unread wins", async () => {
    setup("editor", "immediate");
    let release: () => void = () => {};
    holdAutoRead = new Promise<void>(resolve => { release = resolve; });
    const view = await openClient();
    await waitFor(() => expect(flagBodies).toEqual([{ flag: "seen", value: true }]));
    fireEvent.keyDown(window, { key: "u" });
    await wait(200);
    expect(flagBodies).toEqual([{ flag: "seen", value: true }]);
    release();
    await waitFor(() => expect(flagBodies).toEqual([{ flag: "seen", value: true }, { flag: "seen", value: false }]));
    await wait(200);
    expect(view.container.querySelector('[data-message-list-row="true"]')?.textContent).toContain("Unread");
  });
});

it("retries a failed automatic mark once before showing its error", async () => {
  setup("editor", "immediate");
  failures = 2;
  const view = await openClient();
  await waitFor(() => expect(flagBodies).toHaveLength(1));
  expect(view.queryByText("Synthetic flag failure")).toBeNull();
  await wait(1200);
  await waitFor(() => expect(flagBodies).toHaveLength(2));
  await view.findByText("Synthetic flag failure");
  await wait(1200);
  expect(flagBodies).toHaveLength(2);
});

it("recovers from one failed automatic mark without showing an error", async () => {
  setup("editor", "immediate");
  failures = 1;
  const view = await openClient();
  await wait(1200);
  await waitFor(() => expect(flagBodies).toHaveLength(2));
  expect(view.queryByText("Synthetic flag failure")).toBeNull();
});

it("manual unread cancels the automatic retry during its delay", async () => {
  setup("editor", "immediate");
  failures = 1;
  await openClient();
  await waitFor(() => expect(flagBodies).toHaveLength(1));
  fireEvent.keyDown(window, { key: "u" });
  await wait(1200);
  await waitFor(() => expect(flagBodies).toEqual([{ flag: "seen", value: true }, { flag: "seen", value: false }]));
});
