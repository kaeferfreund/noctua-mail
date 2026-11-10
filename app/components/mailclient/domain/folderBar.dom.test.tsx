import { afterEach, describe, expect, it } from "bun:test";
import React from "react";
import { cleanup, fireEvent, waitFor, within } from "@testing-library/react";
import { render } from "@/lib/i18n/testRender";
import { Theme } from "@radix-ui/themes";
import { ThemeProvider } from "next-themes";

// Folder bar above the message list: in a single mailbox it lists the mailbox's
// special folders (account-a has no archive and no spam folder) and opens them
// like the sidebar does; in the domain view it carries the close button.
const originals = { fetch: globalThis.fetch, eventSource: globalThis.EventSource };

function account(id: string) {
  return {
    id, name: `Synthetic ${id}`, email: `${id}@example.test`, avatar: "", accessRole: "editor", settings: {},
    imap: { host: "", port: 993, secure: true, user: "", password: "" }, smtp: { host: "", port: 465, secure: true, user: "", password: "" }
  };
}

const folder = (accountId: string, path: string, name: string, specialUse?: string) =>
  ({ id: `${accountId}:${path}`, accountId, name, specialUse, count: 0, unreadCount: 0, delimiter: "/" });

function setup(url: string) {
  (window as unknown as { happyDOM: { setURL: (url: string) => void } }).happyDOM.setURL(url);
  globalThis.EventSource = class extends EventTarget {
    url: string;
    constructor(url: string) { super(); this.url = url; }
    close() {}
  } as unknown as typeof EventSource;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const href = (typeof input === "string" ? input : input instanceof URL ? input.href : input.url).replace(/^https?:\/\/[^/]+/, "");
    const path = href.split("?")[0];
    if (path === "/api/auth/me") return Response.json({ user: { id: "synthetic-user", email: "user@example.test", role: "user" },
      accounts: [account("account-a"), account("account-b")], accountId: "account-a", mailboxState: "selected", security: {}, ttlSeconds: 3600 });
    if (path === "/api/me/events") return new Response(new ReadableStream<Uint8Array>(), { headers: { "content-type": "text/event-stream" } });
    if (path === "/api/domains/example.test/threads") {
      return Response.json({ domain: "example.test", role: "inbox", accounts: ["account-a", "account-b"],
        folders: [{ accountId: "account-a", folderId: "account-a:INBOX" }, { accountId: "account-b", folderId: "account-b:INBOX" }],
        items: [], hasMore: false, total: 0 });
    }
    if (/^\/api\/accounts\/account-[ab]\/folders$/.test(path)) {
      const id = path.split("/")[3];
      return Response.json([
        folder(id, "INBOX", "Inbox", "\\Inbox"),
        folder(id, "Sent", "Sent", "\\Sent"),
        folder(id, "Drafts", "Drafts", "\\Drafts"),
        folder(id, "Trash", "Trash", "\\Trash"),
        folder(id, "Projects", "Projects")
      ]);
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

async function renderClient(url: string) {
  setup(url);
  const { default: MailClient } = await import("../../MailClient");
  return render(<ThemeProvider attribute="class"><Theme><MailClient /></Theme></ThemeProvider>);
}

const roleButtons = (group: HTMLElement) => Array.from(group.querySelectorAll<HTMLElement>("[data-domain-role]"));
const activeRoles = (group: HTMLElement) =>
  roleButtons(group).filter((button) => button.getAttribute("aria-pressed") === "true").map((button) => button.dataset.domainRole);

describe("folder bar above the message list", () => {
  it("lists the mailbox's special folders, marks the open one and opens another like the sidebar", async () => {
    const view = await renderClient("http://localhost:4000/?a=~account-a");
    const group = await view.findByRole("group", { name: "Mailbox folders" });
    await waitFor(() => expect(roleButtons(group).map((button) => button.dataset.domainRole)).toEqual(["inbox", "sent", "drafts", "trash"]));
    await waitFor(() => expect(activeRoles(group)).toEqual(["inbox"]));
    // The start-up link has settled (its URL is written) before the click.
    await waitFor(() => expect(new URLSearchParams(window.location.search).get("f")).toBe("INBOX"));
    expect(view.queryByRole("button", { name: "Close domain view" })).toBeNull();
    const historyLength = window.history.length;

    fireEvent.click(within(group).getByRole("button", { name: "Sent" }));
    await waitFor(() => expect(activeRoles(group)).toEqual(["sent"]));
    await waitFor(() => expect(new URLSearchParams(window.location.search).get("f")).toBe("Sent"));
    expect(window.history.length).toBe(historyLength + 1);
  });

  it("marks no button when a folder without a role is open", async () => {
    const view = await renderClient("http://localhost:4000/?a=~account-a&f=Projects");
    const group = await view.findByRole("group", { name: "Mailbox folders" });
    await waitFor(() => expect(roleButtons(group)).toHaveLength(4));
    await waitFor(() => expect(new URLSearchParams(window.location.search).get("f")).toBe("Projects"));
    expect(activeRoles(group)).toEqual([]);
  });

  it("shows all roles and the close button in the domain view", async () => {
    const view = await renderClient("http://localhost:4000/?a=~account-a&d=example.test");
    const group = await view.findByRole("group", { name: "Folder in the domain view" });
    expect(roleButtons(group).map((button) => button.dataset.domainRole)).toEqual(["inbox", "sent", "drafts", "archive", "trash", "spam"]);
    expect(activeRoles(group)).toEqual(["inbox"]);
    expect(view.queryByRole("group", { name: "Mailbox folders" })).toBeNull();
    expect(view.container.textContent).not.toContain("All mailboxes ·");
    fireEvent.click(view.getByRole("button", { name: "Close domain view" }));
    await view.findByRole("group", { name: "Mailbox folders" });
    await waitFor(() => expect(new URLSearchParams(window.location.search).get("d")).toBeNull());
  });
});
