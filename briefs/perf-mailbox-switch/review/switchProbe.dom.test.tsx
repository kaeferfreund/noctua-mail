import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import React from "react";
import { act, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { render } from "@/lib/i18n/testRender";
import { Theme } from "@radix-ui/themes";
import { ThemeProvider } from "next-themes";

// Reviewer probe: rapid switching on the real MailClient, with switch-account delayed.
const names: Record<string, string> = { "account-a": "Synthetic Alpha", "account-b": "Synthetic Beta", "account-c": "Synthetic Gamma" };
const account = (id: string) => ({
  id, name: names[id], email: `${id}@example.test`, avatar: "", accessRole: "manager", settings: {},
  imap: { host: "imap.example.test", port: 993, secure: true, user: id, password: "" },
  smtp: { host: "smtp.example.test", port: 465, secure: true, user: id, password: "" }
});
const folders = (id: string) => [{ id: `${id}:INBOX`, accountId: id, name: "Inbox", specialUse: "\\Inbox", count: 0 }];
let server: { selected: string; accounts: string[] };
let calls: string[];
let switchDelayMs = 1500;
const originals = { fetch: globalThis.fetch, eventSource: globalThis.EventSource };
const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

beforeEach(() => {
  server = { selected: "account-a", accounts: ["account-a", "account-b", "account-c"] };
  calls = [];
  globalThis.EventSource = class extends EventTarget { close() {} } as unknown as typeof EventSource;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = (typeof input === "string" ? input : input instanceof URL ? input.href : input.url).replace(/^https?:\/\/[^/]+/, "");
    const path = url.split("?")[0];
    calls.push(url);
    if (path === "/api/me/events") return new Response(new ReadableStream<Uint8Array>({ start() {} }), { headers: { "content-type": "text/event-stream" } });
    if (path === "/api/auth/me") return Response.json({ user: { id: "synthetic-user", email: "user@example.test", role: "user" },
      accounts: server.accounts.map(account), accountId: server.selected, mailboxState: "selected", security: {}, ttlSeconds: 3600 });
    if (path === "/api/auth/switch-account") {
      const target = JSON.parse(String(init?.body)).accountId as string;
      await delay(switchDelayMs);
      server.selected = target;
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
afterEach(() => { cleanup(); globalThis.fetch = originals.fetch; globalThis.EventSource = originals.eventSource; });

async function mount() {
  const { default: MailClient } = await import("@/app/components/MailClient");
  const view = render(<ThemeProvider attribute="class"><Theme><MailClient /></Theme></ThemeProvider>);
  const row = (name: string) => view.queryAllByText(name).map(el => el.closest("[data-sidebar='menu-button']")).find(Boolean) ?? null;
  const active = () => document.querySelector("[aria-current='true'][data-sidebar='menu-button']")?.textContent ?? "";
  await waitFor(() => expect(active()).toContain(names["account-a"]));
  await waitFor(() => expect(row(names["account-c"])).not.toBeNull());
  return { view, row, active };
}
const lastListFor = () => calls.filter(u => /\/api\/accounts\/[^/]+\/(threads|messages)\?/.test(u)).map(u => /accounts\/([^/]+)\//.exec(u)![1]);

describe("reviewer rapid-switch probe", () => {
  it("A -> B -> C: final state is C, list requests end on C, no topic of another mailbox", async () => {
    const { row, active, view } = await mount();
    const seen: string[] = []; const t0 = Date.now();
    const tick = setInterval(() => { const a = active(); if (seen.at(-1)?.split("@")[0] !== a) seen.push(a + "@" + (Date.now() - t0)); }, 2);
    const mark = calls.length;
    await act(async () => { fireEvent.click(row(names["account-b"])!); });
    console.log("B clicked at", Date.now() - t0);
    await act(async () => { await delay(10); fireEvent.click(row(names["account-c"])!); });
    console.log("C clicked at", Date.now() - t0);
    await act(async () => { await delay(3500); });
    clearInterval(tick);
    console.log("ACTIVE TIMELINE", seen.join(" | "));
    console.log("CALLS AFTER CLICK", calls.slice(mark).filter(u => !u.includes("/sync")).map(u => u.split("?")[0]).join("\n"));
    await waitFor(() => expect(active()).toContain(names["account-c"]));
    await act(async () => { await delay(300); });
    expect(active()).toContain(names["account-c"]);
    expect(server.selected).toBe("account-c");
    const lists = lastListFor();
    console.log("A->B->C list requests by account:", lists.join(","));
    expect(lists.at(-1)).toBe("account-c");
    expect(lists).not.toContain("account-b");
    expect(view.queryByText("Topic of Synthetic Beta")).toBeNull();
    expect(view.queryByText("Topic of Synthetic Alpha")).toBeNull();
  }, 30_000);

  it("A -> B -> A (second click before B commits): final state should be A", async () => {
    const { row, active } = await mount();
    const seen: string[] = []; const t0 = Date.now();
    const tick = setInterval(() => { const a = active(); if (seen.at(-1)?.split("@")[0] !== a) seen.push(a + "@" + (Date.now() - t0)); }, 2);
    await act(async () => { fireEvent.click(row(names["account-b"])!); });
    console.log("B clicked at", Date.now() - t0);
    await act(async () => { await delay(10); fireEvent.click(row(names["account-a"])!); });
    console.log("A clicked at", Date.now() - t0);
    await act(async () => { await delay(3500); });
    clearInterval(tick);
    console.log("ACTIVE TIMELINE", seen.join(" | "));
    console.log("A->B->A final active:", active(), "server selected:", server.selected,
      "switch posts:", calls.filter(u => u.includes("switch-account")).length);
    expect(active()).toContain(names["account-a"]);
    expect(server.selected).toBe("account-a");
  }, 30_000);
});
