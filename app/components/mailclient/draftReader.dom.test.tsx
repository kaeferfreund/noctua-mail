import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import React from "react";
import { act, cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { render } from "@/lib/i18n/testRender";
import { Theme } from "@radix-ui/themes";
import { ThemeProvider } from "next-themes";

// A draft row selected in the Drafts folder opens in the reader, for drafts saved
// in the composer and for drafts an assistant created ($NoctuaAI), also while a
// new message is being written (selecting a row minimizes it).
const account = {
  id: "account-a", name: "Synthetic Alpha", email: "account-a@example.test", avatar: "", accessRole: "manager", settings: {},
  imap: { host: "imap.example.test", port: 993, secure: true, user: "account-a", password: "" },
  smtp: { host: "smtp.example.test", port: 465, secure: true, user: "account-a", password: "" }
};
const draftsFolderId = "account-a:INBOX.Drafts";
const draft = (id: string, subject: string, flags: string[]) => ({
  id, accountId: "account-a", folderId: draftsFolderId, threadId: `<${id}@example.test>`, messageId: `<${id}@example.test>`,
  subject, from: "Synthetic Alpha <account-a@example.test>", to: "recipient@example.test", cc: "", bcc: "",
  preview: `${subject} preview`, date: "10/25/2026, 9:00:00 AM", dateValue: Date.UTC(2026, 9, 25, 9), seen: true, unread: false,
  draft: true, flags, hasSource: true, senderIdentityId: "identity-a",
  groupKey: "Today", threadSortDateValue: Date.UTC(2026, 9, 25, 9), topics: [], topicSuggestions: []
});
const drafts = [
  draft("composer-draft", "Composer synthetic draft", ["\\Draft", "\\Seen"]),
  draft("assistant-draft", "Assistant synthetic draft", ["\\Draft", "\\Seen", "$NoctuaAI"])
];

let requests: string[];
let accessRole: string;
let schedules: Array<{ id: string; draftId: string; sendAt: number; status: string; attempts: number; lastError: null; scheduledByUserId: string }>;
let refuseSchedule: { status: number; body: Record<string, unknown> } | null;
const originals = { fetch: globalThis.fetch, eventSource: globalThis.EventSource };

beforeEach(() => {
  requests = [];
  accessRole = "manager";
  schedules = [];
  refuseSchedule = null;
  (window as unknown as { happyDOM: { setURL: (url: string) => void } }).happyDOM.setURL("http://localhost:4000/?a=~account-a&f=INBOX.Drafts");
  globalThis.EventSource = class extends EventTarget { close() {} } as unknown as typeof EventSource;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = (typeof input === "string" ? input : input instanceof URL ? input.href : input.url).replace(/^https?:\/\/[^/]+/, "");
    const path = url.split("?")[0];
    requests.push(`${init?.method ?? "GET"} ${url}`);
    if (path === "/api/auth/me") return Response.json({ user: { id: "synthetic-user", email: "user@example.test", role: "user" },
      accounts: [{ ...account, accessRole }], accountId: "account-a", mailboxState: "selected", security: {}, ttlSeconds: 3600 });
    if (path === "/api/me/events") return new Response(new ReadableStream<Uint8Array>(), { headers: { "content-type": "text/event-stream" } });
    if (path === "/api/me/mailboxes/summary") return Response.json({ ok: true, mailboxes: [] });
    if (path === "/api/accounts/account-a/folders") {
      return Response.json([
        { id: "account-a:INBOX", accountId: "account-a", name: "Inbox", specialUse: "\\Inbox", count: 0, unreadCount: 0 },
        { id: draftsFolderId, accountId: "account-a", name: "Drafts", specialUse: "\\Drafts", count: drafts.length, unreadCount: 0 }
      ]);
    }
    const single = /^\/api\/accounts\/account-a\/messages\/([^/]+)$/.exec(path);
    const found = single ? drafts.find(item => item.id === decodeURIComponent(single[1])) : undefined;
    if (found) return Response.json({ ok: true, message: { ...found, body: `${found.subject} body`, contentState: "stored" } });
    if (path === "/api/accounts/account-a/thread/related") {
      const body = JSON.parse(String(init?.body ?? "{}")) as { threadIds?: string[]; messageIds?: string[] };
      const items = drafts.filter(item => body.threadIds?.includes(item.threadId) || body.messageIds?.includes(item.id));
      return Response.json({ items, window: { anchorId: items[0]?.id ?? null, olderCursor: null, newerCursor: null, total: items.length } });
    }
    if (/^\/api\/accounts\/account-a\/drafts\/[^/]+\/send$/.test(path)) {
      // The server refuses a draft whose sender details no longer match its identity.
      return Response.json({ ok: false, code: "draft_identity_changed", message: "Open this draft, review From, and save it again." }, { status: 409 });
    }
    if (path === "/api/accounts/account-a/drafts/scheduled" && init?.method === "POST") {
      if (refuseSchedule) return Response.json(refuseSchedule.body, { status: refuseSchedule.status });
      const body = JSON.parse(String(init.body)) as { draftId: string; sendAt: number };
      const row = { id: `schedule-${schedules.length + 1}`, draftId: body.draftId, sendAt: body.sendAt, status: "queued", attempts: 0,
        lastError: null, scheduledByUserId: "synthetic-user" };
      schedules = [...schedules.filter(item => item.draftId !== body.draftId), row];
      return Response.json({ ok: true, scheduledSend: row }, { status: 201 });
    }
    if (path === "/api/accounts/account-a/drafts/scheduled") return Response.json({ ok: true, scheduledSends: schedules });
    if (/^\/api\/accounts\/account-a\/(threads|messages)$/.test(path)) {
      const folderId = new URL(url, "http://x").searchParams.get("folderId");
      const items = folderId === draftsFolderId ? drafts : [];
      return Response.json({ items, hasMore: false, total: items.length });
    }
    return Response.json({ ok: true, items: [], messages: [], total: 0, hasMore: false, topics: [], stats: [], aliases: [],
      events: [], reminders: [], members: [], prefs: {}, decisions: [], threads: [], conflicts: [], identities: [] });
  }) as typeof fetch;
});

afterEach(() => {
  cleanup();
  globalThis.fetch = originals.fetch;
  globalThis.EventSource = originals.eventSource;
  window.history.replaceState(null, "", "/");
});

const settle = async () => {
  for (let i = 0; i < 10; i += 1) await act(() => new Promise<void>(resolve => setTimeout(resolve, 10)));
};

describe("drafts in the reader", () => {
  for (const item of drafts) {
    it(`opens ${item.id} in the reader when its row is selected`, async () => {
      const { default: MailClient } = await import("../MailClient");
      const view = render(<ThemeProvider attribute="class"><Theme><MailClient /></Theme></ThemeProvider>);
      await waitFor(() => expect(view.queryAllByText(item.subject).length).toBeGreaterThan(0));
      await settle();
      expect(view.queryByText("Select a message to view the thread.")).not.toBeNull();
      const rowButton = view.getAllByRole("button").find(button => button.textContent?.includes(item.subject));
      expect(rowButton).toBeDefined();
      fireEvent.click(rowButton!);
      await settle();
      await waitFor(() => expect(view.queryByText("Select a message to view the thread.")).toBeNull());
      await waitFor(() => expect(view.queryAllByText(`${item.subject} body`).length).toBeGreaterThan(0));
    });
  }
});

describe("drafts in the reader while a new message is open", () => {
  it("minimizes the new message and opens the selected draft", async () => {
    const { default: MailClient } = await import("../MailClient");
    const view = render(<ThemeProvider attribute="class"><Theme><MailClient /></Theme></ThemeProvider>);
    const [item] = drafts;
    await waitFor(() => expect(view.queryAllByText(item.subject).length).toBeGreaterThan(0));
    await settle();
    fireEvent.click(view.getAllByRole("button").find(button => button.textContent?.trim() === "Compose")!);
    await waitFor(() => expect(view.queryByRole("button", { name: "Send" })).not.toBeNull());
    fireEvent.click(view.getAllByRole("button").find(button => button.textContent?.includes(item.subject))!);
    await settle();
    // The composer stays open, minimized; the reader shows the selected draft.
    await waitFor(() => expect(view.queryByRole("button", { name: "Restore" })).not.toBeNull());
    expect(view.queryByText("Select a message to view the thread.")).toBeNull();
    await waitFor(() => expect(view.queryAllByText(`${item.subject} body`).length).toBeGreaterThan(0));
  });
});

describe("sending a draft whose sender changed", () => {
  it("shows the translated sender message instead of the server text", async () => {
    const { default: MailClient } = await import("../MailClient");
    const view = render(<ThemeProvider attribute="class"><Theme><MailClient /></Theme></ThemeProvider>);
    const [item] = drafts;
    await waitFor(() => expect(view.queryAllByText(item.subject).length).toBeGreaterThan(0));
    await settle();
    fireEvent.click(view.getAllByRole("button").find(button => button.textContent?.includes(item.subject))!);
    await waitFor(() => expect(view.queryAllByText(`${item.subject} body`).length).toBeGreaterThan(0));
    fireEvent.click(within(document.querySelector<HTMLElement>("[data-reader-print]")!).getByRole("button", { name: "Send draft" }));
    await waitFor(() => expect(view.queryAllByText("The saved sender details changed. Review From and save the draft before sending.").length).toBeGreaterThan(0));
    expect(view.queryAllByText("Open this draft, review From, and save it again.")).toHaveLength(0);
  });
});

// „Senden planen“ for a saved draft from the row menu and the reader, without compose.
describe("scheduling a draft without opening it", () => {
  const openDraftsList = async () => {
    const { default: MailClient } = await import("../MailClient");
    const view = render(<ThemeProvider attribute="class"><Theme><MailClient /></Theme></ThemeProvider>);
    await waitFor(() => expect(view.queryAllByText(drafts[1].subject).length).toBeGreaterThan(0));
    await settle();
    return view;
  };
  const rowOf = (subject: string) => Array.from(document.querySelectorAll<HTMLElement>('[data-message-list-row="true"]')).find(row => row.textContent?.includes(subject))!;
  const openRowMenu = async (subject: string) => {
    const trigger = rowOf(subject).querySelector<HTMLElement>('[data-message-action="menu"]')!;
    await act(async () => {
      fireEvent.keyDown(trigger, { key: "Enter" });
      await new Promise(resolve => setTimeout(resolve, 0));
    });
    const menu = await screen.findByRole("menu");
    return menu;
  };
  const postedSchedules = () => requests.filter(request => request.startsWith("POST /api/accounts/account-a/drafts/scheduled"));

  it("plans the draft from its row menu: one POST, badge in the list, toast without reopening compose", async () => {
    const view = await openDraftsList();
    await openRowMenu(drafts[1].subject);
    fireEvent.click(await view.findByRole("menuitem", { name: /^Schedule send/ }));
    const dialog = await view.findByRole("dialog", { name: "Schedule send" });
    expect(dialog.querySelectorAll("[data-schedule-option]").length).toBeGreaterThan(1);
    fireEvent.click(view.getByRole("button", { name: "Schedule" }));
    await waitFor(() => expect(postedSchedules()).toHaveLength(1));
    expect(schedules.map(item => item.draftId)).toEqual([drafts[1].id]);
    expect(schedules[0].sendAt).toBeGreaterThan(Date.now());
    await waitFor(() => expect(view.queryByRole("dialog", { name: "Schedule send" })).toBeNull());
    await waitFor(() => expect(rowOf(drafts[1].subject).querySelector('[data-scheduled-send="queued"]')).not.toBeNull());
    expect(view.queryAllByText(/^Send scheduled for /).length).toBeGreaterThan(0);
    // Compose stays closed: planning a saved draft never opens or saves it.
    expect(view.queryByRole("button", { name: "Send" })).toBeNull();
    expect(requests.some(request => request.includes("/drafts/save"))).toBe(false);
  });

  it("plans the opened draft from the reader's quick action", async () => {
    const view = await openDraftsList();
    fireEvent.click(view.getAllByRole("button").find(button => button.textContent?.includes(drafts[0].subject))!);
    await waitFor(() => expect(view.queryAllByText(`${drafts[0].subject} body`).length).toBeGreaterThan(0));
    const action = document.querySelector<HTMLElement>('[data-reader-print] [data-message-action="schedule"]')!;
    expect(action).not.toBeNull();
    fireEvent.click(action);
    await view.findByRole("dialog", { name: "Schedule send" });
    fireEvent.click(view.getByRole("button", { name: "Schedule" }));
    await waitFor(() => expect(schedules.map(item => item.draftId)).toEqual([drafts[0].id]));
    await waitFor(() => expect(document.querySelector('[data-scheduled-send-bar="queued"]')).not.toBeNull());
  });

  it("explains a refused invitation draft and keeps the dialog open", async () => {
    refuseSchedule = { status: 409, body: { ok: false, code: "scheduled_send_invite", message: "Drafts with an event invitation cannot be scheduled." } };
    const view = await openDraftsList();
    await openRowMenu(drafts[1].subject);
    fireEvent.click(await view.findByRole("menuitem", { name: /^Schedule send/ }));
    await view.findByRole("dialog", { name: "Schedule send" });
    fireEvent.click(view.getByRole("button", { name: "Schedule" }));
    await waitFor(() => expect(view.queryAllByText("Event invitations cannot be scheduled. Send the invitation directly.").length).toBeGreaterThan(0));
    expect(view.queryByRole("dialog", { name: "Schedule send" })).not.toBeNull();
    expect(schedules).toEqual([]);
  });

  it("is not offered to members who may not send", async () => {
    accessRole = "viewer";
    const view = await openDraftsList();
    const menu = await openRowMenu(drafts[1].subject);
    expect(menu.querySelectorAll('[role="menuitem"]').length).toBeGreaterThan(0);
    expect(view.queryByRole("menuitem", { name: /^Schedule send/ })).toBeNull();
    expect(document.querySelector('[data-message-action="schedule"]')).toBeNull();
  });
});
