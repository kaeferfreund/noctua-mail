import { afterEach, describe, expect, it } from "bun:test";
import React from "react";
import { readFileSync } from "node:fs";
import { cleanup, waitFor } from "@testing-library/react";
import { render } from "@/lib/i18n/testRender";
import { Theme } from "@radix-ui/themes";
import { ThemeProvider } from "next-themes";

// Domain view („Sammler“) rows of two mailboxes: the name column follows the
// folder each message lies in, and the paperclip is in the subject line —
// the only part of a row that narrow and phone layouts keep visible.
const DAY = Date.UTC(2026, 9, 23, 9);
function message(acc: string, id: string, folder: string, from: string, minute: number, extra: Record<string, unknown> = {}) {
  return {
    id, accountId: acc, folderId: `${acc}:${folder}`, threadId: `<${id}@example.test>`, messageId: `<${id}@example.test>`,
    subject: `Subject ${id}`, from, to: `Synthetic ${acc} <${acc}@example.test>`, cc: "", bcc: "",
    preview: `Preview ${id}`, date: "10/23/2026, 9:00:00 AM", dateValue: DAY + minute * 60_000, seen: true, unread: false,
    flags: ["\\Seen"], groupKey: "Today", threadSortDateValue: DAY + minute * 60_000, topics: [], topicSuggestions: [], ...extra
  };
}
const account = (id: string, defaultView: string) => ({
  id, name: `Synthetic ${id}`, email: `${id}@example.test`, avatar: "", accessRole: "editor",
  settings: { layout: { defaultView } },
  imap: { host: "", port: 993, secure: true, user: "", password: "" }, smtp: { host: "", port: 465, secure: true, user: "", password: "" }
});
const folders = (acc: string) => [
  { id: `${acc}:INBOX`, accountId: acc, name: "Inbox", specialUse: "\\Inbox", count: 1, unreadCount: 0 },
  { id: `${acc}:Sent`, accountId: acc, name: "Sent", specialUse: "\\Sent", count: 1, unreadCount: 0 }
];
const attached = { hasAttachments: true, hasInlineAttachments: false };
// Mail from mailbox A's own address, received in mailbox B's inbox (internal mail).
const internal = message("account-b", "internal", "INBOX", "Anna Example <account-a@example.test>", 1, attached);
const external = message("account-a", "external", "INBOX", "Customer <customer@example.invalid>", 2, attached);
const items = [internal, external];
const originals = { fetch: globalThis.fetch, eventSource: globalThis.EventSource };

function setup(defaultView: string) {
  (window as unknown as { happyDOM: { setURL: (url: string) => void } }).happyDOM
    .setURL("http://localhost:4000/?a=~account-a&d=example.test");
  globalThis.EventSource = class extends EventTarget {
    url: string;
    constructor(url: string) { super(); this.url = url; }
    close() {}
  } as unknown as typeof EventSource;
  const accounts = [account("account-a", defaultView), account("account-b", defaultView)];
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = (typeof input === "string" ? input : input instanceof URL ? input.href : input.url).replace(/^https?:\/\/[^/]+/, "");
    const path = url.split("?")[0];
    if (path === "/api/auth/me") return Response.json({ user: { id: "synthetic-user", email: "user@example.test", role: "user" },
      accounts, accountId: "account-a", mailboxState: "selected", security: {}, ttlSeconds: 3600 });
    if (path === "/api/me/events") return new Response(new ReadableStream<Uint8Array>(), { headers: { "content-type": "text/event-stream" } });
    if (path === "/api/domains/example.test/threads") {
      return Response.json({ domain: "example.test", role: "inbox", accounts: ["account-a", "account-b"],
        folders: [], items, hasMore: false, total: items.length });
    }
    if (path === "/api/accounts/account-a/folders") return Response.json(folders("account-a"));
    if (path === "/api/accounts/account-b/folders") return Response.json(folders("account-b"));
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

async function renderRows(defaultView: string) {
  setup(defaultView);
  const { default: MailClient } = await import("../../MailClient");
  const view = render(<ThemeProvider attribute="class"><Theme><MailClient /></Theme></ThemeProvider>);
  const rowFor = (subject: string) => Array.from(view.container.querySelectorAll<HTMLElement>('[data-message-list-row="true"]'))
    .find((row) => row.textContent?.includes(subject));
  await waitFor(() => {
    expect(rowFor("Subject internal")).toBeDefined();
    expect(rowFor("Subject external")).toBeDefined();
  });
  return { internalRow: rowFor("Subject internal")!, externalRow: rowFor("Subject external")! };
}

describe("domain view list rows", () => {
  it("narrow rows keep only the subject line of the subject cell", () => {
    // Why the paperclip must sit inside the subject line: everything else in the cell is hidden there.
    const css = readFileSync(new URL("../messagelist/MessageListPane.module.css", import.meta.url), "utf8");
    expect(css).toContain('[data-message-cell="subject"] > :not([data-message-cell="unread"]):not([data-message-subject-line])) { display: none; }');
  });

  for (const defaultView of ["threads", "table"]) {
    it(`${defaultView}: rows of both mailboxes carry the paperclip in the subject line`, async () => {
      const { internalRow, externalRow } = await renderRows(defaultView);
      for (const row of [internalRow, externalRow]) {
        expect(row.querySelector("[data-message-subject-line] [data-attachment-badge]")).not.toBeNull();
      }
    });
  }

  it("compact: the phone slot of the subject row repeats the paperclip", async () => {
    const { internalRow, externalRow } = await renderRows("compact");
    for (const row of [internalRow, externalRow]) {
      expect(row.querySelectorAll("[data-attachment-badge]").length).toBe(2);
    }
  });

  it("names the sender of inbox mail, also when it comes from the active mailbox's own address", async () => {
    const { internalRow } = await renderRows("threads");
    expect(internalRow.textContent).toContain("Anna Example");
    expect(internalRow.querySelector('[aria-label="Empfänger"], [aria-label="Recipients"]')).toBeNull();
  });
});
