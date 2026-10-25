import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import React from "react";
import { cleanup, fireEvent, waitFor } from "@testing-library/react";
import { render } from "@/lib/i18n/testRender";
import { Theme } from "@radix-ui/themes";
import { ThemeProvider } from "next-themes";

// A scanned invite link (/#invite=<code>) is consumed once at start: prefilled for a
// sign-up when nobody is signed in, dropped otherwise, and never copied into later URLs.
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
const originals = { fetch: globalThis.fetch, eventSource: globalThis.EventSource, pushState: window.history.pushState, replaceState: window.history.replaceState };
let signedIn: boolean;
let historyUrls: string[];

beforeEach(() => {
  signedIn = true;
  historyUrls = [];
  (window as unknown as { happyDOM: { setURL: (url: string) => void } }).happyDOM.setURL("http://localhost:4000/?a=~account-a&f=INBOX#invite=synthetic-scanned-code");
  window.history.pushState = function (this: History, ...args: Parameters<History["pushState"]>) { historyUrls.push(String(args[2])); return originals.pushState.apply(this, args); };
  window.history.replaceState = function (this: History, ...args: Parameters<History["replaceState"]>) { historyUrls.push(String(args[2])); return originals.replaceState.apply(this, args); };
  globalThis.EventSource = class extends EventTarget { close() {} } as unknown as typeof EventSource;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = (typeof input === "string" ? input : input instanceof URL ? input.href : input.url).replace(/^https?:\/\/[^/]+/, "");
    const path = url.split("?")[0];
    if (path === "/api/auth/me") return signedIn ? Response.json({ user: { id: "synthetic-user", email: "user@example.test", role: "user" },
      accounts: [account], accountId: "account-a", mailboxState: "selected", security: {}, ttlSeconds: 3600 }) : Response.json({ ok: false }, { status: 401 });
    if (path === "/api/me/events") return new Response(new ReadableStream<Uint8Array>(), { headers: { "content-type": "text/event-stream" } });
    if (path === "/api/accounts/account-a/folders") return Response.json([{ id: "account-a:INBOX", accountId: "account-a", name: "Inbox", specialUse: "\\Inbox", count: 1 }]);
    if (path === "/api/accounts/account-a/messages/synthetic-row") {
      return Response.json({ ok: true, message: { ...row("synthetic-row", "Synthetic invite-link subject"), body: "Synthetic body", contentState: "stored" } });
    }
    if (/^\/api\/accounts\/account-a\/(threads|messages)$/.test(path)) return Response.json({ items: [row("synthetic-row", "Synthetic invite-link subject")], hasMore: false, total: 1 });
    return Response.json({ ok: true, items: [], messages: [], total: 0, hasMore: false, topics: [], stats: [], aliases: [], mailboxes: [], methods: { imap: false },
      events: [], reminders: [], members: [], prefs: {}, decisions: [], threads: [], conflicts: [] });
  }) as typeof fetch;
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  sessionStorage.clear();
  globalThis.fetch = originals.fetch;
  globalThis.EventSource = originals.eventSource;
  window.history.pushState = originals.pushState;
  window.history.replaceState = originals.replaceState;
  window.history.replaceState(null, "", "/");
});

describe("scanned invite link", () => {
  it("is dropped with a notice when someone is already signed in and never reaches a later history entry", async () => {
    const { default: MailClient } = await import("../MailClient");
    const view = render(<ThemeProvider attribute="class"><Theme><MailClient /></Theme></ThemeProvider>);
    await waitFor(() => expect(window.location.hash).toBe(""));
    expect(`${window.location.pathname}${window.location.search}`).toBe("/?a=~account-a&f=INBOX");
    expect(await view.findByText("You are already signed in. The invite code is for a new sign-up.")).toBeTruthy();
    const subject = (await view.findAllByText("Synthetic invite-link subject"))[0];
    const before = historyUrls.length;
    fireEvent.click(subject);
    await waitFor(() => expect(window.location.search).toContain("m="));
    expect(historyUrls.length).toBeGreaterThan(before);
    expect(historyUrls.join(" ")).not.toContain("invite");
    expect(window.location.href).not.toContain("invite");
  });

  it("opens the sign-up with the code filled in when nobody is signed in", async () => {
    signedIn = false;
    const { default: MailClient } = await import("../MailClient");
    const view = render(<ThemeProvider attribute="class"><Theme><MailClient /></Theme></ThemeProvider>);
    await waitFor(() => expect((view.getByLabelText("Invite code") as HTMLInputElement).value).toBe("synthetic-scanned-code"));
    expect(window.location.hash).toBe("");
    expect(historyUrls.join(" ")).not.toContain("invite");
  });
});
