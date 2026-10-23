import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import React, { Profiler } from "react";
import { act, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { render } from "@/lib/i18n/testRender";
import { Theme } from "@radix-ui/themes";
import { ThemeProvider } from "next-themes";
import type { Message } from "@/lib/data";
import { READER_LAYOUT_KEY } from "@/lib/ui/readerFocus";
import { createReaderRowsStore } from "./messagelist/useReaderNavigationRows";

// What is derived from a new list page (topics per thread, reader rows, empty thread,
// collaboration and suggestion state) is there in the commit that shows the rows; no
// follow-up render of the mail client completes it in the same task, which would hold
// back the first paint. The focus reader still receives the rendered rows.
const account = {
  id: "account-a", name: "Synthetic Alpha", email: "account-a@example.test", avatar: "", accessRole: "manager", settings: {},
  imap: { host: "imap.example.test", port: 993, secure: true, user: "account-a", password: "" },
  smtp: { host: "smtp.example.test", port: 465, secure: true, user: "account-a", password: "" }
};
const row = (n: number) => ({
  id: `m${n}`, accountId: "account-a", folderId: "account-a:INBOX", threadId: `t${n}`, messageId: `<m${n}@example.test>`,
  subject: `Synthetic subject ${n}`, from: "Sender <sender@example.test>", to: "account-a@example.test", cc: "", bcc: "",
  preview: "Synthetic", date: "10/23/2026, 9:00:00 AM", dateValue: Date.UTC(2026, 9, 23, 9, n), seen: true, unread: false,
  flags: [], groupKey: "Today", threadSortDateValue: Date.UTC(2026, 9, 23, 9, n),
  topics: n === 1 ? [{ id: "topic-1", name: "Synthetic topic", color: "blue" }] : [], topicSuggestions: []
});

type Gate = { open: Promise<void>; release: () => void };
const gate = (): Gate => { let release = () => {}; const open = new Promise<void>(resolve => { release = resolve; }); return { open, release }; };
let listGate: Gate;
let listRequests: number;
const originals = { fetch: globalThis.fetch, eventSource: globalThis.EventSource };

beforeEach(() => {
  listGate = gate(); listRequests = 0;
  globalThis.EventSource = class extends EventTarget { close() {} } as unknown as typeof EventSource;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = (typeof input === "string" ? input : input instanceof URL ? input.href : input.url).replace(/^https?:\/\/[^/]+/, "");
    const path = url.split("?")[0];
    if (path === "/api/auth/me") return Response.json({ user: { id: "synthetic-user", email: "user@example.test", role: "user" },
      accounts: [account], accountId: "account-a", mailboxState: "selected", security: {}, ttlSeconds: 3600 });
    if (path === "/api/me/events") return new Response(new ReadableStream<Uint8Array>(), { headers: { "content-type": "text/event-stream" } });
    if (path === "/api/me/mailboxes/summary") return Response.json({ ok: true, mailboxes: [] });
    if (path === "/api/accounts/account-a/folders") {
      return Response.json([{ id: "account-a:INBOX", accountId: "account-a", name: "Inbox", specialUse: "\\Inbox", count: 3 }]);
    }
    if (path === "/api/accounts/account-a/threads") {
      listRequests += 1;
      await listGate.open;
      return Response.json({ items: [3, 2, 1].map(row), hasMore: false, total: 3 });
    }
    return Response.json({ ok: true, items: [], messages: [], total: 0, hasMore: false, topics: [], stats: [], aliases: [],
      events: [], reminders: [], members: [], prefs: {}, decisions: [], threads: [], conflicts: [] });
  }) as typeof fetch;
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  globalThis.fetch = originals.fetch;
  globalThis.EventSource = originals.eventSource;
});

async function mount() {
  const { default: MailClient } = await import("../MailClient");
  const commits: string[] = [];
  const view = render(<ThemeProvider attribute="class"><Theme>
    <Profiler id="mail-client" onRender={() => {
      const first = [...document.querySelectorAll<HTMLElement>("[data-message-id]")].find(el => el.textContent?.includes("Synthetic subject 1"));
      commits.push(!first ? "no-rows" : first.textContent?.includes("Synthetic topic") ? "rows+topic" : "rows");
    }}><MailClient /></Profiler>
  </Theme></ThemeProvider>);
  return { view, commits };
}
const settle = () => act(async () => { await new Promise(resolve => setTimeout(resolve, 300)); });

describe("list commits", () => {
  it("the commit that shows the first page already carries the rows' topics", async () => {
    const { view, commits } = await mount();
    await waitFor(() => expect(listRequests).toBe(1));
    await settle();
    const before = commits.length;
    expect(commits.every(entry => entry === "no-rows")).toBe(true);
    await act(async () => { listGate.release(); });
    await waitFor(() => expect(view.queryByText("Synthetic subject 1")).not.toBeNull());
    await settle();
    expect(commits.slice(before)[0]).toBe("rows+topic");
    expect(commits.slice(before).every(entry => entry === "rows+topic")).toBe(true);
  }, 20_000);

  it("the focus reader still steps through the rendered rows", async () => {
    localStorage.setItem(READER_LAYOUT_KEY, "focus");
    listGate.release();
    const { view } = await mount();
    await waitFor(() => expect(view.queryByText("Synthetic subject 3")).not.toBeNull());
    await act(async () => { fireEvent.click(view.getByText("Synthetic subject 3")); });
    const counter = () => document.querySelector("[data-reader-position]")?.textContent ?? "";
    await waitFor(() => expect(counter()).toContain("1"));
    expect(counter()).toContain("3");
    await act(async () => { fireEvent.keyDown(window, { key: "j" }); });
    await waitFor(() => expect(counter()).toMatch(/2\D+3/));
  }, 20_000);

  it("the reader rows store notifies only for a changed row order and reads the latest rows", () => {
    const store = createReaderRowsStore();
    const [a, b] = [row(1), row(2)] as unknown as Message[];
    let notified = 0;
    const unsubscribe = store.subscribe(() => { notified += 1; });
    store.publish([a, b]);
    store.publish([a, b]);
    expect(notified).toBe(1);
    expect(store.getRows()).toEqual([a, b]);
    store.publish([b, a]);
    expect(notified).toBe(2);
    unsubscribe();
    store.publish([a]);
    expect(notified).toBe(2);
    expect(store.getRows()).toEqual([a]);
  });
});
