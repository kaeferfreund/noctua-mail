import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import React from "react";
import { act, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { render } from "@/lib/i18n/testRender";
import { Theme } from "@radix-ui/themes";
import { ThemeProvider } from "next-themes";

// The selected mailbox's folders fail to load at startup. The error is shown and
// the sidebar stays usable: a click on another mailbox switches to it. The failed
// mailbox starts no sync without its folders.
const names: Record<string, string> = { "account-a": "Synthetic Alpha", "account-b": "Synthetic Beta" };
const account = (id: string) => ({
  id, name: names[id], email: `${id}@example.test`, avatar: "", accessRole: "manager", settings: {},
  imap: { host: "imap.example.test", port: 993, secure: true, user: id, password: "" },
  smtp: { host: "smtp.example.test", port: 465, secure: true, user: id, password: "" }
});
let calls: string[];
const originals = { fetch: globalThis.fetch, eventSource: globalThis.EventSource };

beforeEach(() => {
  calls = [];
  window.history.replaceState(null, "", "/");
  globalThis.EventSource = class extends EventTarget { close() {} } as unknown as typeof EventSource;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = (typeof input === "string" ? input : input instanceof URL ? input.href : input.url).replace(/^https?:\/\/[^/]+/, "");
    const path = url.split("?")[0];
    calls.push(`${init?.method ?? "GET"} ${path}`);
    if (path === "/api/me/events") return new Response(new ReadableStream<Uint8Array>({ start() {} }), { headers: { "content-type": "text/event-stream" } });
    if (path === "/api/auth/me") return Response.json({ user: { id: "synthetic-user", email: "user@example.test", role: "user" },
      accounts: Object.keys(names).map(account), accountId: "account-a", mailboxState: "selected", security: {}, ttlSeconds: 3600 });
    if (path === "/api/auth/switch-account") return Response.json({ ok: true, accountId: JSON.parse(String(init?.body)).accountId });
    if (path === "/api/me/mailboxes/summary") return Response.json({ ok: true, mailboxes: [] });
    if (path === "/api/accounts/account-a/folders") return Response.json({ ok: false, message: "Synthetic folder failure" }, { status: 500 });
    if (path === "/api/accounts/account-b/folders") {
      return Response.json([{ id: "account-b:INBOX", accountId: "account-b", name: "Inbox", specialUse: "\\Inbox", count: 0 }]);
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

describe("startup with a failed folder load", () => {
  it("shows the error and keeps sidebar clicks working, without a sync of the failed mailbox", async () => {
    const { default: MailClient } = await import("@/app/components/MailClient");
    const view = render(<ThemeProvider attribute="class"><Theme><MailClient /></Theme></ThemeProvider>);
    const row = (name: string) => view.queryAllByText(name).map(el => el.closest("[data-sidebar='menu-button']")).find(Boolean) ?? null;
    const active = () => document.querySelector("[aria-current='true'][data-sidebar='menu-button']")?.textContent ?? "";
    await waitFor(() => expect(calls).toContain("GET /api/accounts/account-a/folders"));
    await waitFor(() => expect(view.queryAllByText("Synthetic folder failure").length).toBeGreaterThan(0));
    await waitFor(() => expect(row(names["account-b"])).not.toBeNull());
    await act(async () => { fireEvent.click(row(names["account-b"])!); });
    await waitFor(() => expect(calls).toContain("POST /api/auth/switch-account"));
    await waitFor(() => expect(active()).toContain(names["account-b"]));
    await waitFor(() => expect(new URLSearchParams(window.location.search).get("a")).toBe("~account-b"));
    expect(calls).not.toContain("POST /api/accounts/account-a/sync");
  });
});
