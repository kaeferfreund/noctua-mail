import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import React from "react";
import { act, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { render } from "@/lib/i18n/testRender";
import { Theme } from "@radix-ui/themes";
import { ThemeProvider } from "next-themes";

// The next mailbox's first list page is requested together with the selection write
// and the folder read. It is shown only after the switch committed.
const names: Record<string, string> = { "account-a": "Synthetic Alpha", "account-b": "Synthetic Beta" };
const account = (id: string) => ({
  id, name: names[id], email: `${id}@example.test`, avatar: "", accessRole: "manager", settings: {},
  imap: { host: "imap.example.test", port: 993, secure: true, user: id, password: "" },
  smtp: { host: "smtp.example.test", port: 465, secure: true, user: id, password: "" }
});
const folders = (id: string) => [{ id: `${id}:INBOX`, accountId: id, name: "Inbox", specialUse: "\\Inbox", count: 1 }];
const row = (id: string) => ({
  id: `${id}-m1`, accountId: id, folderId: `${id}:INBOX`, threadId: `${id}-t1`, messageId: `<${id}-m1@example.test>`,
  subject: `Marker ${id} subject`, from: `Sender <sender@example.test>`, to: `${id}@example.test`, cc: "", bcc: "",
  preview: "Synthetic", date: "10/23/2026, 9:00:00 AM", dateValue: Date.UTC(2026, 9, 23, 9), seen: true, unread: false,
  flags: [], groupKey: "Today", threadSortDateValue: Date.UTC(2026, 9, 23, 9), topics: [], topicSuggestions: []
});

type Gate = { open: Promise<void>; release: () => void };
const gate = (): Gate => { let release = () => {}; const open = new Promise<void>(resolve => { release = resolve; }); return { open, release }; };
type ListCall = { url: string; signal?: AbortSignal | null; atSwitchPending: boolean };

let switchGate: Gate;
let switchStatus: number;
let switchPending: boolean;
let listCalls: ListCall[];
const originals = { fetch: globalThis.fetch, eventSource: globalThis.EventSource };

beforeEach(() => {
  switchGate = gate(); switchStatus = 200; switchPending = false; listCalls = [];
  globalThis.EventSource = class extends EventTarget { close() {} } as unknown as typeof EventSource;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = (typeof input === "string" ? input : input instanceof URL ? input.href : input.url).replace(/^https?:\/\/[^/]+/, "");
    const path = url.split("?")[0];
    if (path === "/api/auth/me") return Response.json({ user: { id: "synthetic-user", email: "user@example.test", role: "user" },
      accounts: ["account-a", "account-b"].map(account), accountId: "account-a", mailboxState: "selected", security: {}, ttlSeconds: 3600 });
    if (path === "/api/auth/switch-account") {
      switchPending = true;
      await switchGate.open;
      switchPending = false;
      return Response.json({ ok: switchStatus === 200 }, { status: switchStatus });
    }
    if (path === "/api/me/events") return new Response(new ReadableStream<Uint8Array>(), { headers: { "content-type": "text/event-stream" } });
    if (path === "/api/me/mailboxes/summary") return Response.json({ ok: true, mailboxes: [] });
    const folderAccount = /^\/api\/accounts\/([^/]+)\/folders$/.exec(path)?.[1];
    if (folderAccount) return Response.json(folders(folderAccount));
    const listAccount = /^\/api\/accounts\/([^/]+)\/threads$/.exec(path)?.[1];
    if (listAccount) {
      listCalls.push({ url, signal: init?.signal, atSwitchPending: switchPending });
      return Response.json({ items: [row(listAccount)], hasMore: false, total: 1 });
    }
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
});

async function mountOnA() {
  const { default: MailClient } = await import("../MailClient");
  const view = render(<ThemeProvider attribute="class"><Theme><MailClient /></Theme></ThemeProvider>);
  const row = (name: string) => view.queryAllByText(name).map(el => el.closest("[data-sidebar='menu-button']")).find(Boolean) ?? null;
  const active = () => document.querySelector("[aria-current='true'][data-sidebar='menu-button']")?.textContent ?? "";
  await waitFor(() => expect(view.queryByText("Marker account-a subject")).not.toBeNull());
  return { view, row, active };
}
const callsFor = (id: string) => listCalls.filter(call => call.url.startsWith(`/api/accounts/${id}/`));

describe("first page alongside the mailbox switch", () => {
  it("requests B's inbox page while the selection is still persisting and shows it from that one request", async () => {
    const { view, row, active } = await mountOnA();
    await act(async () => { fireEvent.click(row(names["account-b"])!); });
    await waitFor(() => expect(callsFor("account-b")).toHaveLength(1));
    expect(callsFor("account-b")[0].atSwitchPending).toBe(true);
    expect(new URL(callsFor("account-b")[0].url, "http://x").searchParams.get("folderId")).toBe("account-b:INBOX");
    // Nothing of B is visible before the server persisted the selection.
    expect(view.queryByText("Marker account-b subject")).toBeNull();
    expect(active()).toContain(names["account-a"]);
    await act(async () => { switchGate.release(); });
    await waitFor(() => expect(view.queryByText("Marker account-b subject")).not.toBeNull());
    expect(active()).toContain(names["account-b"]);
    expect(callsFor("account-b")).toHaveLength(1);
    expect(listCalls.some(call => call.url.startsWith("/api/accounts/account-b/") && call.url.includes("account-a"))).toBe(false);
  }, 20_000);

  it("a click back to the shown mailbox aborts the requested page of the cancelled switch", async () => {
    const { view, row, active } = await mountOnA();
    await act(async () => { fireEvent.click(row(names["account-b"])!); });
    await waitFor(() => expect(callsFor("account-b")).toHaveLength(1));
    await act(async () => { fireEvent.click(row(names["account-a"])!); });
    await act(async () => { switchGate.release(); });
    await waitFor(() => expect(callsFor("account-b")[0].signal?.aborted).toBe(true));
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 50)); });
    expect(view.queryByText("Marker account-b subject")).toBeNull();
    expect(view.queryByText("Marker account-a subject")).not.toBeNull();
    expect(active()).toContain(names["account-a"]);
    expect(callsFor("account-b")).toHaveLength(1);
  }, 20_000);

  it("a denied switch aborts the requested page and never shows it", async () => {
    const { view, row, active } = await mountOnA();
    switchStatus = 403;
    await act(async () => { fireEvent.click(row(names["account-b"])!); });
    await waitFor(() => expect(callsFor("account-b")).toHaveLength(1));
    await act(async () => { switchGate.release(); });
    await waitFor(() => expect(callsFor("account-b")[0].signal?.aborted).toBe(true));
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 50)); });
    expect(view.queryByText("Marker account-b subject")).toBeNull();
    expect(active()).toContain(names["account-a"]);
  }, 20_000);
});
