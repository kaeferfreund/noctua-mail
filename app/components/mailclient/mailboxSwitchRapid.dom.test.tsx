import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import React from "react";
import { act, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { render } from "@/lib/i18n/testRender";
import { Theme } from "@radix-ui/themes";
import { ThemeProvider } from "next-themes";

// Rapid mailbox switching on the real MailClient with a slow switch-account: the
// last click wins in the sidebar and in the persisted server selection.
const names: Record<string, string> = { "account-a": "Synthetic Alpha", "account-b": "Synthetic Beta", "account-c": "Synthetic Gamma" };
const account = (id: string) => ({
  id, name: names[id], email: `${id}@example.test`, avatar: "", accessRole: "manager", settings: {},
  imap: { host: "imap.example.test", port: 993, secure: true, user: id, password: "" },
  smtp: { host: "smtp.example.test", port: 465, secure: true, user: id, password: "" }
});
const folders = (id: string) => [{ id: `${id}:INBOX`, accountId: id, name: "Inbox", specialUse: "\\Inbox", count: 0 }];
let server: { selected: string; accounts: string[] };
let calls: string[];
// Abort signal of every list request, per mailbox.
let listSignals: { accountId: string; url: string; signal?: AbortSignal | null }[];
// Selection writes in the order the server applied them.
let applied: string[];
let pendingWrites: number;
let switchDelayMs: (target: string) => number;
let tick: ReturnType<typeof setInterval> | undefined;
const originals = { fetch: globalThis.fetch, eventSource: globalThis.EventSource };
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

beforeEach(() => {
  server = { selected: "account-a", accounts: ["account-a", "account-b", "account-c"] };
  calls = []; applied = []; pendingWrites = 0; listSignals = [];
  switchDelayMs = () => 600;
  globalThis.EventSource = class extends EventTarget { close() {} } as unknown as typeof EventSource;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = (typeof input === "string" ? input : input instanceof URL ? input.href : input.url).replace(/^https?:\/\/[^/]+/, "");
    const path = url.split("?")[0];
    calls.push(url);
    const listAccount = /^\/api\/accounts\/([^/]+)\/(threads|messages)$/.exec(path)?.[1];
    if (listAccount) listSignals.push({ accountId: listAccount, url, signal: init?.signal });
    if (path === "/api/me/events") return new Response(new ReadableStream<Uint8Array>({ start() {} }), { headers: { "content-type": "text/event-stream" } });
    if (path === "/api/auth/me") return Response.json({ user: { id: "synthetic-user", email: "user@example.test", role: "user" },
      accounts: server.accounts.map(account), accountId: server.selected, mailboxState: "selected", security: {}, ttlSeconds: 3600 });
    if (path === "/api/auth/switch-account") {
      const target = JSON.parse(String(init?.body)).accountId as string;
      pendingWrites++;
      await delay(switchDelayMs(target));
      server.selected = target; applied.push(target); pendingWrites--;
      return Response.json({ ok: true, accountId: target });
    }
    if (path === "/api/me/mailboxes/summary") return Response.json({ ok: true, mailboxes: [] });
    const folderAccount = /^\/api\/accounts\/([^/]+)\/folders$/.exec(path)?.[1];
    if (folderAccount) { await delay(20); return Response.json(folders(folderAccount)); }
    const topicsAccount = /^\/api\/accounts\/([^/]+)\/topics$/.exec(path)?.[1];
    if (topicsAccount) return Response.json({ ok: true, topics: [{ id: `${topicsAccount}-t1`, name: `Topic of ${names[topicsAccount]}`, color: "blue" }] });
    return Response.json({ ok: true, items: [], messages: [], total: 0, hasMore: false, topics: [], stats: [], aliases: [],
      events: [], reminders: [], members: [], prefs: {}, decisions: [], threads: [], conflicts: [] });
  }) as typeof fetch;
});
afterEach(() => { clearInterval(tick); cleanup(); globalThis.fetch = originals.fetch; globalThis.EventSource = originals.eventSource; });

async function mount() {
  const { default: MailClient } = await import("@/app/components/MailClient");
  const view = render(<ThemeProvider attribute="class"><Theme><MailClient /></Theme></ThemeProvider>);
  const row = (name: string) => view.queryAllByText(name).map(el => el.closest("[data-sidebar='menu-button']")).find(Boolean) ?? null;
  const active = () => document.querySelector("[aria-current='true'][data-sidebar='menu-button']")?.textContent ?? "";
  await waitFor(() => expect(active()).toContain(names["account-a"]));
  await waitFor(() => expect(row(names["account-c"])).not.toBeNull());
  // The sidebar appears before bootstrap has selected A's inbox. Prefetching B
  // requires that inbox view, so wait for its concrete first-page request.
  await waitFor(() => expect(listSignals.some(entry => entry.accountId === "account-a"
    && new URL(entry.url, "http://localhost").searchParams.get("folderId") === "account-a:INBOX")).toBe(true));
  // Every mailbox the sidebar showed as active from here on.
  const shown: string[] = [];
  tick = setInterval(() => {
    const id = Object.keys(names).find(key => active().includes(names[key]));
    if (id && shown.at(-1) !== id) shown.push(id);
  }, 2);
  const mark = calls.length;
  const clickInOrder = async (...ids: string[]) => {
    for (const id of ids) {
      await act(async () => { fireEvent.click(row(names[id])!); });
      // Navigation runs in an effect. Supersede B only once its prefetch exists,
      // rather than assuming the next render happens within a fixed delay.
      if (id === "account-b") {
        await waitFor(() => expect(listSignals.filter(entry => entry.accountId === id)).toHaveLength(1));
        expect(listSignals.find(entry => entry.accountId === id)?.signal?.aborted).toBe(false);
      }
    }
  };
  // Waits until every selection write was applied and the client had time to commit.
  const settled = async () => {
    await waitFor(() => expect(pendingWrites).toBe(0), { timeout: 5_000 });
    await act(async () => { await delay(300); });
    clearInterval(tick);
  };
  const callsSinceClick = () => calls.slice(mark);
  const listRequestsSinceClick = () => callsSinceClick().filter(url => /\/api\/accounts\/[^/]+\/(threads|messages)\?/.test(url))
    .map(url => /accounts\/([^/]+)\//.exec(url)![1]);
  // The click on B requests its inbox's first page alongside the switch; the
  // superseded switch aborts it, and B is listed nowhere else.
  const expectOnlyAbortedFirstPageOfB = () => {
    expect(listRequestsSinceClick().filter(id => id === "account-b")).toHaveLength(1);
    expect(listSignals.filter(entry => entry.accountId === "account-b").every(entry => entry.signal?.aborted)).toBe(true);
  };
  return { view, row, active, shown, clickInOrder, settled, callsSinceClick, listRequestsSinceClick, expectOnlyAbortedFirstPageOfB };
}

describe("rapid mailbox switching on the real MailClient", () => {
  it("A -> B -> C ends on C; no list or topic of B", async () => {
    const h = await mount();
    await h.clickInOrder("account-b");
    expect(h.row(names["account-b"])?.getAttribute("aria-busy")).toBe("true");
    await act(async () => { await delay(150); });
    expect(h.row(names["account-b"])?.getAttribute("aria-busy")).toBe("true");
    await h.clickInOrder("account-c");
    await h.settled();
    expect(h.active()).toContain(names["account-c"]);
    expect(h.row(names["account-c"])?.getAttribute("aria-busy")).not.toBe("true");
    expect(server.selected).toBe("account-c");
    expect(applied).toEqual(["account-b", "account-c"]);
    expect(h.shown).toEqual(["account-a", "account-c"]);
    const lists = h.listRequestsSinceClick();
    expect(lists.at(-1)).toBe("account-c");
    h.expectOnlyAbortedFirstPageOfB();
    expect(h.view.queryByText("Topic of Synthetic Beta")).toBeNull();
    expect(h.view.queryByText("Topic of Synthetic Alpha")).toBeNull();
  }, 20_000);

  it("A -> B -> A before B commits ends on A in the sidebar and on the server, without reloading A", async () => {
    const h = await mount();
    await h.clickInOrder("account-b", "account-a");
    await h.settled();
    expect(h.active()).toContain(names["account-a"]);
    expect(server.selected).toBe("account-a");
    // A's write waits for B's response, so it is applied last.
    expect(applied).toEqual(["account-b", "account-a"]);
    expect(h.shown).toEqual(["account-a"]);
    // Returning to the mailbox still shown neither re-reads its folders nor lists B.
    expect(h.callsSinceClick()).not.toContain("/api/accounts/account-a/folders");
    h.expectOnlyAbortedFirstPageOfB();
    expect(h.view.queryByText("Topic of Synthetic Beta")).toBeNull();
  }, 20_000);

  for (const last of ["account-a", "account-c"]) {
    it(`a slow first write cannot overwrite the later choice (A -> B -> ${last.slice(-1).toUpperCase()})`, async () => {
      switchDelayMs = target => target === "account-b" ? 900 : 10;
      const h = await mount();
      await h.clickInOrder("account-b", last);
      await h.settled();
      expect(applied).toEqual(["account-b", last]);
      expect(server.selected).toBe(last);
      expect(h.active()).toContain(names[last]);
      expect(h.shown).not.toContain("account-b");
    }, 20_000);
  }
});
