import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import React from "react";
import { act, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { render } from "@/lib/i18n/testRender";
import { Theme } from "@radix-ui/themes";
import { ThemeProvider } from "next-themes";

// A mailbox switch no longer re-reads /auth/me. Revocations must still reach the
// sidebar through the existing refresh paths: membership events and the session poll.
const names: Record<string, string> = { "account-a": "Synthetic Alpha", "account-b": "Synthetic Beta" };
const account = (id: string) => ({
  id, name: names[id], email: `${id}@example.test`, avatar: "", accessRole: "manager", settings: {},
  imap: { host: "imap.example.test", port: 993, secure: true, user: id, password: "" },
  smtp: { host: "smtp.example.test", port: 465, secure: true, user: id, password: "" }
});
const folders = (id: string) => [{ id: `${id}:INBOX`, accountId: id, name: "Inbox", specialUse: "\\Inbox", count: 0 }];

let server: { selected: string; accounts: string[] };
let calls: string[];
let events: ReadableStreamDefaultController<Uint8Array> | null;
let polls: Map<number, () => void>;
const originals = {
  fetch: globalThis.fetch, eventSource: globalThis.EventSource,
  setInterval: window.setInterval, clearInterval: window.clearInterval
};

beforeEach(() => {
  server = { selected: "account-a", accounts: ["account-a", "account-b"] };
  calls = []; events = null; polls = new Map();
  globalThis.EventSource = class extends EventTarget { close() {} } as unknown as typeof EventSource;
  // Keep the session poll (>= 60 s) under test control; shorter timers run normally.
  window.setInterval = ((handler: () => void, ms?: number) => {
    if ((ms ?? 0) < 60_000) return originals.setInterval(handler, ms);
    const id = originals.setInterval(() => {}, 2 ** 30);
    polls.set(id, handler);
    return id;
  }) as typeof window.setInterval;
  window.clearInterval = ((id?: number) => { if (id !== undefined) polls.delete(id); originals.clearInterval(id); }) as typeof window.clearInterval;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = (typeof input === "string" ? input : input instanceof URL ? input.href : input.url).replace(/^https?:\/\/[^/]+/, "");
    const path = url.split("?")[0];
    calls.push(path);
    if (path === "/api/me/events") return new Response(new ReadableStream<Uint8Array>({ start(controller) { events = controller; } }),
      { headers: { "content-type": "text/event-stream" } });
    if (path === "/api/auth/me") {
      if (!server.accounts.includes(server.selected)) server.selected = server.accounts[0] ?? "";
      return Response.json({ user: { id: "synthetic-user", email: "user@example.test", role: "user" },
        accounts: server.accounts.map(account), accountId: server.selected || null,
        mailboxState: server.selected ? "selected" : "none", security: {}, ttlSeconds: 3600 });
    }
    if (path === "/api/auth/switch-account") {
      const target = JSON.parse(String(init?.body)).accountId as string;
      if (!server.accounts.includes(target)) return Response.json({ ok: false }, { status: 403 });
      server.selected = target;
      return Response.json({ ok: true, accountId: target });
    }
    if (path === "/api/me/mailboxes/summary") return Response.json({ ok: true, mailboxes: [] });
    const folderAccount = /^\/api\/accounts\/([^/]+)\/folders$/.exec(path)?.[1];
    if (folderAccount) return server.accounts.includes(folderAccount)
      ? Response.json(folders(folderAccount)) : Response.json({ ok: false }, { status: 403 });
    return Response.json({ ok: true, items: [], messages: [], total: 0, hasMore: false, topics: [], stats: [], aliases: [],
      events: [], reminders: [], members: [], prefs: {}, decisions: [], threads: [], conflicts: [] });
  }) as typeof fetch;
});

afterEach(() => {
  cleanup();
  // Storage is shared by every DOM test file in the run; leave none behind for the next one.
  localStorage.clear();
  sessionStorage.clear();
  globalThis.fetch = originals.fetch;
  globalThis.EventSource = originals.eventSource;
  window.setInterval = originals.setInterval;
  window.clearInterval = originals.clearInterval;
});

async function mountAndSwitchToB() {
  const { default: MailClient } = await import("../MailClient");
  const view = render(<ThemeProvider attribute="class"><Theme><MailClient /></Theme></ThemeProvider>);
  const row = (name: string) => view.queryAllByText(name).map(el => el.closest("[data-sidebar='menu-button']")).find(Boolean) ?? null;
  const active = () => document.querySelector("[aria-current='true'][data-sidebar='menu-button']")?.textContent ?? "";
  await waitFor(() => expect(active()).toContain(names["account-a"]));
  await waitFor(() => expect(row(names["account-b"])).not.toBeNull());
  await act(async () => { fireEvent.click(row(names["account-b"])!); });
  await waitFor(() => expect(active()).toContain(names["account-b"]));
  return { view, row, active };
}

describe("mailbox revocation after a switch without /auth/me", () => {
  it("a mailboxes-changed event removes a revoked mailbox from the sidebar", async () => {
    const { row, active } = await mountAndSwitchToB();
    server.accounts = ["account-b"];
    await waitFor(() => expect(events).not.toBeNull());
    await act(async () => {
      events!.enqueue(new TextEncoder().encode(`event: mailboxes-changed\ndata: ${JSON.stringify({ type: "mailboxes-changed" })}\n\n`));
    });
    await waitFor(() => expect(row(names["account-a"])).toBeNull());
    expect(active()).toContain(names["account-b"]);
  }, 20_000);

  it("the session poll moves off a revoked active mailbox and drops it from the sidebar", async () => {
    const { row, active } = await mountAndSwitchToB();
    server.accounts = ["account-a"];
    await waitFor(() => expect(polls.size).toBeGreaterThan(0));
    await act(async () => { for (const poll of [...polls.values()]) poll(); });
    await waitFor(() => expect(row(names["account-b"])).toBeNull());
    await waitFor(() => expect(active()).toContain(names["account-a"]));
  }, 20_000);
});
