import { afterEach, describe, expect, it } from "bun:test";
import React from "react";
import { cleanup, fireEvent, waitFor, within } from "@testing-library/react";
import { render } from "@/lib/i18n/testRender";
import { Theme } from "@radix-ui/themes";
import { ThemeProvider } from "next-themes";

// Domain view with the active mailbox account-a and a row of account-b: the
// expanded reader's toolbar offers the same actions for both rows (each acts in
// the row's own mailbox).
const DAY = Date.UTC(2026, 9, 23, 9);
function row(accountId: string, id: string, subject: string, minute: number) {
  return {
    id, accountId, folderId: `${accountId}:INBOX`, threadId: `<${id}@example.test>`, messageId: `<${id}@example.test>`,
    subject, from: "Sender <sender@example.invalid>", to: `${accountId}@example.test`, cc: "", bcc: "",
    preview: `Preview ${id}`, date: "10/23/2026, 9:00:00 AM", dateValue: DAY + minute * 60_000, seen: true, unread: false,
    flags: ["\\Seen"], groupKey: "Today", threadSortDateValue: DAY + minute * 60_000, topics: [], topicSuggestions: []
  };
}
const own = row("account-a", "own-message", "Own synthetic subject", 0);
const other = row("account-b", "other-message", "Other synthetic subject", 1);
const originals = { fetch: globalThis.fetch, eventSource: globalThis.EventSource };

function account(id: string) {
  return {
    id, name: `Synthetic ${id}`, email: `${id}@example.test`, avatar: "", accessRole: "editor", settings: {},
    imap: { host: "", port: 993, secure: true, user: "", password: "" }, smtp: { host: "", port: 465, secure: true, user: "", password: "" }
  };
}

function setup() {
  (window as unknown as { happyDOM: { setURL: (url: string) => void } }).happyDOM.setURL("http://localhost:4000/?a=~account-a&d=example.test");
  globalThis.EventSource = class extends EventTarget {
    url: string;
    constructor(url: string) { super(); this.url = url; }
    close() {}
  } as unknown as typeof EventSource;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = (typeof input === "string" ? input : input instanceof URL ? input.href : input.url).replace(/^https?:\/\/[^/]+/, "");
    const path = url.split("?")[0];
    if (path === "/api/auth/me") return Response.json({ user: { id: "synthetic-user", email: "user@example.test", role: "user" },
      accounts: [account("account-a"), account("account-b")], accountId: "account-a", mailboxState: "selected", security: {}, ttlSeconds: 3600 });
    if (path === "/api/me/events") return new Response(new ReadableStream<Uint8Array>(), { headers: { "content-type": "text/event-stream" } });
    if (path === "/api/domains/example.test/threads") {
      return Response.json({ domain: "example.test", role: "inbox", accounts: ["account-a", "account-b"],
        folders: [{ accountId: "account-a", folderId: "account-a:INBOX" }, { accountId: "account-b", folderId: "account-b:INBOX" }],
        items: [other, own], hasMore: false, total: 2 });
    }
    if (/^\/api\/accounts\/account-[ab]\/folders$/.test(path)) {
      const id = path.split("/")[3];
      return Response.json([{ id: `${id}:INBOX`, accountId: id, name: "Inbox", specialUse: "\\Inbox", count: 1, unreadCount: 0 }]);
    }
    for (const message of [own, other]) {
      if (path === `/api/accounts/${message.accountId}/messages/${message.id}`) {
        return Response.json({ ok: true, message: { ...message, body: `Body ${message.id}`, contentState: "stored" } });
      }
    }
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

async function openExpanded(view: ReturnType<typeof render>, subject: string) {
  const listRow = await waitFor(() => {
    const found = Array.from(view.container.querySelectorAll<HTMLElement>('[data-message-list-row="true"]'))
      .find(element => element.textContent?.includes(subject));
    expect(found).toBeTruthy();
    return found!;
  });
  fireEvent.click(listRow);
  fireEvent.click(await view.findByRole("button", { name: "Expand reading view" }));
  const toolbar = await view.findByRole("group", { name: "Message reading controls" });
  await waitFor(() => expect(toolbar.getAttribute("data-focus")).toBe("true"));
  return within(toolbar);
}

describe("reader toolbar in the domain view", () => {
  it("offers Archive, Delete, Move and Topics for a row of another mailbox as for the active one's", async () => {
    setup();
    const { default: MailClient } = await import("../../MailClient");
    const view = render(<ThemeProvider attribute="class"><Theme><MailClient /></Theme></ThemeProvider>);
    const otherToolbar = await openExpanded(view, "Other synthetic subject");
    for (const name of ["Archive", "Delete", "Move to", "Topics"]) expect(otherToolbar.queryByRole("button", { name })).not.toBeNull();
    fireEvent.click(otherToolbar.getByRole("button", { name: "Show message list" }));
    const ownToolbar = await openExpanded(view, "Own synthetic subject");
    for (const name of ["Archive", "Delete", "Move to", "Topics"]) expect(ownToolbar.queryByRole("button", { name })).not.toBeNull();
  });
});
