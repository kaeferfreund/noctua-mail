import { afterEach, describe, expect, it } from "bun:test";
import React from "react";
import { cleanup, fireEvent, waitFor, within } from "@testing-library/react";
import { render } from "@/lib/i18n/testRender";
import { Theme } from "@radix-ui/themes";
import { ThemeProvider } from "next-themes";

// Domain view („Sammler“) in the Sent role: rows of another mailbox (B) name
// their recipients from the list response alone — before B's folder list has
// answered and when it fails. A response of another role (Inbox, still on
// screen while Sent loads) never turns its rows into recipient rows.
const DAY = Date.UTC(2026, 10, 21, 9);
function message(acc: string, id: string, folder: string, from: string, to: string, minute: number, extra: Record<string, unknown> = {}) {
  return {
    id, accountId: acc, folderId: `${acc}:${folder}`, threadId: `<${id}@example.test>`, messageId: `<${id}@example.test>`,
    subject: `Subject ${id}`, from, to, cc: "", bcc: "",
    preview: `Preview ${id}`, date: "11/21/2026, 9:00:00 AM", dateValue: DAY + minute * 60_000, seen: true, unread: false,
    flags: ["\\Seen"], groupKey: "Today", threadSortDateValue: DAY + minute * 60_000, topics: [], topicSuggestions: [], ...extra
  };
}
const account = (id: string) => ({
  id, name: `Synthetic ${id}`, email: `${id}@example.test`, avatar: "", accessRole: "editor",
  settings: { layout: { defaultView: "threads" } },
  imap: { host: "", port: 993, secure: true, user: "", password: "" }, smtp: { host: "", port: 465, secure: true, user: "", password: "" }
});
const folders = (acc: string) => [
  { id: `${acc}:INBOX`, accountId: acc, name: "Inbox", specialUse: "\\Inbox", count: 1, unreadCount: 0 },
  { id: `${acc}:Sent`, accountId: acc, name: "Sent", specialUse: "\\Sent", count: 1, unreadCount: 0 }
];
const B_FROM = "Bea Example <account-b@example.test>";
const CUSTOMER = "Carla Customer <carla@example.invalid>";
// Mail sent from B, and from the active mailbox A, as the Sent role lists it.
const sentSingle = message("account-b", "single", "Sent", B_FROM, CUSTOMER, 1);
const sentFromA = message("account-a", "own", "Sent", "Anna Example <account-a@example.test>", "Dora Client <dora@example.invalid>", 2);
// B's inbox mail, listed by the Inbox role.
const inboxMail = message("account-b", "inbound", "INBOX", "Ingo Sender <ingo@example.invalid>", B_FROM, 4);

const roleResponse = (role: "inbox" | "sent") => role === "sent"
  ? { domain: "example.test", role, accounts: ["account-a", "account-b"],
    folders: [{ accountId: "account-a", folderId: "account-a:Sent" }, { accountId: "account-b", folderId: "account-b:Sent" }],
    items: [sentFromA, sentSingle], hasMore: false, total: 2 }
  : { domain: "example.test", role, accounts: ["account-a", "account-b"],
    folders: [{ accountId: "account-a", folderId: "account-a:INBOX" }, { accountId: "account-b", folderId: "account-b:INBOX" }],
    items: [inboxMail], hasMore: false, total: 1 };

const originals = { fetch: globalThis.fetch, eventSource: globalThis.EventSource };

type Setup = {
  url: string;
  /** How B's folder list answers: never (pending) or with a server error. */
  bFolders: "pending" | "error";
  /** Holds the Sent response until the returned release function is called. */
  holdSent?: boolean;
};

function setup({ url, bFolders, holdSent = false }: Setup) {
  (window as unknown as { happyDOM: { setURL: (url: string) => void } }).happyDOM.setURL(url);
  globalThis.EventSource = class extends EventTarget {
    url: string;
    constructor(url: string) { super(); this.url = url; }
    close() {}
  } as unknown as typeof EventSource;
  const state = { bFoldersRequested: false, sentRequested: false, releaseSent: () => {} };
  const sentGate = new Promise<void>((resolve) => { state.releaseSent = resolve; });
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const href = (typeof input === "string" ? input : input instanceof URL ? input.href : input.url).replace(/^https?:\/\/[^/]+/, "");
    const [path, search = ""] = href.split("?");
    if (path === "/api/auth/me") return Response.json({ user: { id: "synthetic-user", email: "user@example.test", role: "user" },
      accounts: [account("account-a"), account("account-b")], accountId: "account-a", mailboxState: "selected", security: {}, ttlSeconds: 3600 });
    if (path === "/api/me/events") return new Response(new ReadableStream<Uint8Array>(), { headers: { "content-type": "text/event-stream" } });
    if (path === "/api/domains/example.test/threads") {
      const role = new URLSearchParams(search).get("role") === "sent" ? "sent" : "inbox";
      if (role === "sent") {
        state.sentRequested = true;
        if (holdSent) await sentGate;
      }
      return Response.json(roleResponse(role));
    }
    if (path === "/api/accounts/account-a/folders") return Response.json(folders("account-a"));
    if (path === "/api/accounts/account-b/folders") {
      state.bFoldersRequested = true;
      if (bFolders === "error") return Response.json({ ok: false }, { status: 500 });
      return new Promise<Response>(() => {});
    }
    return Response.json({ ok: true, items: [], messages: [], total: 0, hasMore: false, topics: [], stats: [], aliases: [],
      events: [], reminders: [], members: [], prefs: {}, decisions: [], threads: [], conflicts: [] });
  }) as typeof fetch;
  return state;
}

afterEach(() => {
  cleanup();
  globalThis.fetch = originals.fetch;
  globalThis.EventSource = originals.eventSource;
  window.history.replaceState(null, "", "/");
});

async function renderClient() {
  const { default: MailClient } = await import("../../MailClient");
  const view = render(<ThemeProvider attribute="class"><Theme><MailClient /></Theme></ThemeProvider>);
  const rowFor = (subject: string) => Array.from(view.container.querySelectorAll<HTMLElement>('[data-message-list-row="true"]'))
    .find((row) => row.textContent?.includes(subject));
  return { view, rowFor };
}

const RECIPIENT_ARROW = '[aria-label="Empfänger"], [aria-label="Recipients"]';

async function expectSentRowsNameRecipients(rowFor: (subject: string) => HTMLElement | undefined) {
  await waitFor(() => {
    const single = rowFor("Subject single");
    expect(single?.textContent).toContain("Carla Customer");
    expect(single?.textContent).not.toContain("Bea Example");
    expect(single?.querySelector(RECIPIENT_ARROW)).not.toBeNull();
  });
  const own = rowFor("Subject own");
  expect(own?.textContent).toContain("Dora Client");
  expect(own?.querySelector(RECIPIENT_ARROW)).not.toBeNull();
}

describe("domain view in the Sent role", () => {
  it("names the recipients of another mailbox's rows before that mailbox's folder list has answered", async () => {
    const state = setup({ url: "http://localhost:4000/?a=~account-a&d=example.test&dr=sent", bFolders: "pending" });
    const { rowFor } = await renderClient();
    await expectSentRowsNameRecipients(rowFor);
    expect(state.bFoldersRequested).toBe(true);
  });

  it("names the recipients when that mailbox's folder list fails", async () => {
    const state = setup({ url: "http://localhost:4000/?a=~account-a&d=example.test&dr=sent", bFolders: "error" });
    const { rowFor } = await renderClient();
    await expectSentRowsNameRecipients(rowFor);
    expect(state.bFoldersRequested).toBe(true);
  });

  it("switching Inbox → Sent never names the inbox rows by their recipients", async () => {
    const state = setup({ url: "http://localhost:4000/?a=~account-a&d=example.test", bFolders: "pending", holdSent: true });
    const { view, rowFor } = await renderClient();
    await waitFor(() => expect(rowFor("Subject inbound")?.textContent).toContain("Ingo Sender"));

    // Any render of the inbox row with the arrow or without its sender, however short, is recorded.
    const wrong: string[] = [];
    const observer = new MutationObserver(() => {
      const row = rowFor("Subject inbound");
      if (row && (row.querySelector(RECIPIENT_ARROW) || !row.textContent?.includes("Ingo Sender"))) {
        wrong.push(row.textContent ?? "");
      }
    });
    observer.observe(view.container, { subtree: true, childList: true, characterData: true, attributes: true });

    const group = await view.findByRole("group", { name: "Folder in the domain view" });
    fireEvent.click(within(group).getByRole("button", { name: "Sent" }));
    await waitFor(() => expect(state.sentRequested).toBe(true));
    // While Sent loads, an inbox row still on screen keeps its sender.
    expect(rowFor("Subject inbound")?.querySelector(RECIPIENT_ARROW) ?? null).toBeNull();

    state.releaseSent();
    await expectSentRowsNameRecipients(rowFor);
    observer.disconnect();
    expect(wrong).toEqual([]);
  });
});
