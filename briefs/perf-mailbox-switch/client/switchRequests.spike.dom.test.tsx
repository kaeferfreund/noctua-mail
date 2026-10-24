// SPIKE HARNESS (perf-mailbox-switch, client path). Not part of the suite.
// Mounts the real MailClient with only the browser transports replaced
// (fetch, EventSource, requestIdleCallback) and records every request of an
// A -> B -> A mailbox switch. Responses are gated in "waves": the harness waits
// until the client is quiet, then releases every pending response at once.
// A request first seen after wave N was released depends on (at least) N
// round trips, so the wave index is the length of its awaited chain.
import { expect, it, mock } from "bun:test";
import React, { Profiler } from "react";
import { act, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { render } from "@/lib/i18n/testRender";
import { Theme } from "@radix-ui/themes";
import { ThemeProvider } from "next-themes";

type Req = { seq: number; wave: number; method: string; url: string; idle: boolean; phase: string };
type Pending = { resolve: (response: Response) => void; build: () => Response; req: Req };

const SETTLE_MS = Number(process.env.SPIKE_SETTLE_MS ?? 260);
const accountIds = ["account-a", "account-b"] as const;
let selected = "account-a";
const requests: Req[] = [];
const pending: Pending[] = [];
const streams: Array<{ url: string; phase: string; wave: number; closed: boolean }> = [];
let phase = "boot";
let wave = 0;
let inIdle = false;
let commits = 0;
const commitsByPhase: Record<string, number> = {};

const account = (id: string) => ({
  id, name: id === "account-a" ? "Synthetic Alpha" : "Synthetic Beta", email: `${id}@example.test`, avatar: "",
  accessRole: "manager", settings: {}, ownAddresses: [`${id}@example.test`],
  imap: { host: "imap.example.test", port: 993, secure: true, user: id, password: "" },
  smtp: { host: "smtp.example.test", port: 465, secure: true, user: id, password: "" }
});
const folders = (id: string) => [
  { id: `${id}:INBOX`, accountId: id, name: "Inbox", specialUse: "\\Inbox", count: 2, unreadCount: 1 },
  { id: `${id}:Sent`, accountId: id, name: "Sent", specialUse: "\\Sent", count: 0 },
  { id: `${id}:Archive`, accountId: id, name: "Archive", count: 0 },
  { id: `${id}:Trash`, accountId: id, name: "Trash", specialUse: "\\Trash", count: 0 }
];
const message = (id: string, n: number) => ({
  id: `${id}-m${n}`, threadId: `${id}-t${n}`, messageId: `<${id}-m${n}@example.test>`,
  subject: `Subject ${id} ${n}`, from: `Sender ${n} <sender${n}@example.test>`, fromEmail: `sender${n}@example.test`,
  to: `${id}@example.test`, preview: "Synthetic preview", date: "2026-10-23T10:00:00.000Z",
  dateValue: Date.parse("2026-10-23T10:00:00.000Z") - n * 60_000, folderId: `${id}:INBOX`, accountId: id,
  body: "", seen: n !== 1, unread: n === 1, imapUid: n
});

function respond(method: string, url: string): Response {
  const path = url.split("?")[0];
  const acct = /^\/api\/accounts\/([^/]+)/.exec(path)?.[1];
  if (path === "/api/auth/me") return Response.json({
    user: { id: "synthetic-user", email: "user@example.test", role: "user" },
    accounts: accountIds.map(account), accountId: selected, mailboxState: "selected",
    security: {}, ttlSeconds: 3600
  });
  if (path === "/api/auth/switch-account" && method === "POST") return Response.json({ ok: true, accountId: selected });
  if (path === "/api/me/mailboxes/summary") return Response.json({ ok: true, mailboxes: accountIds.map(id => ({
    accountId: id, unread: 1, assignedToMe: 0, unassignedOpen: 0, open: 0, watcher: { state: "idling" } })) });
  if (acct && path.endsWith("/folders")) return Response.json(folders(acct));
  if (acct && (path.endsWith("/messages") || path.endsWith("/threads")) && method === "GET") {
    const params = new URL(url, "http://x").searchParams;
    if (params.get("pageSize") === "1" && params.get("folderId")) return Response.json({ items: [message(acct, 1)], total: 2, hasMore: true });
    if (params.get("pageSize") === "1") return Response.json({ items: [], hasMore: false,
      // 7/3 = correct per-account count; 70/30 = computed before the account's folder exclusions were known.
      total: (acct === "account-a" ? 7 : 3) * (params.get("excludeFolderIds") ? 1 : 10) });
    return Response.json({ items: [message(acct, 1), message(acct, 2)], total: 2, hasMore: false, baseCount: 2 });
  }
  if (acct && path.endsWith("/topics")) return Response.json({ ok: true, topics: [{ id: `topic-${acct}`, name: `Topic ${acct}`,
    color: "iris", accountId: acct, imapKeyword: `kw-${acct}`, createdAt: 1, updatedAt: 1 }] });
  if (acct && path.endsWith("/sync") && method === "POST") return Response.json({ ok: true, jobId: `job-${acct}` });
  if (acct && path.endsWith("/sync/status")) return Response.json({ ok: true, job: { status: "done", result: { count: 0 } } });
  if (acct && path.includes("/consistency")) return Response.json({ ok: true, needsRepair: false, remote: null });
  return Response.json({ ok: true, items: [], messages: [], total: 0, hasMore: false, topics: [], stats: [], aliases: [],
    events: [], reminders: [], members: [], prefs: {}, decisions: [], threads: [], conflicts: [] });
}

function normalize(input: RequestInfo | URL) {
  const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  return raw.replace(/^https?:\/\/[^/]+/, "");
}

async function settle() {
  // Quiet = no new request for SETTLE_MS, including debounced (160 ms) and idle work.
  let last = -1;
  for (;;) {
    const count = requests.length + streams.length;
    if (count === last) return;
    last = count;
    await act(async () => { await new Promise(resolve => setTimeout(resolve, SETTLE_MS)); });
  }
}
let holdPattern: RegExp | null = null;
const held: Pending[] = [];
async function releaseWave() {
  const all = pending.splice(0);
  const batch = holdPattern ? all.filter(item => !holdPattern!.test(item.req.url)) : all;
  if (holdPattern) held.push(...all.filter(item => holdPattern!.test(item.req.url)));
  wave += 1;
  await act(async () => { for (const item of batch) item.resolve(item.build()); });
  return batch.length;
}
let probe: (() => void) | null = null;
async function runUntilQuiet(maxWaves = 40, shown?: () => boolean) {
  let shownAtWave: number | null = shown?.() ? wave : null;
  for (let i = 0; i < maxWaves; i += 1) {
    await settle();
    probe?.();
    if (shown && shownAtWave === null && shown()) shownAtWave = wave;
    if (pending.length === 0) break;
    await releaseWave();
  }
  await settle();
  if (shown && shownAtWave === null && shown()) shownAtWave = wave;
  return shownAtWave;
}

it("mailbox switch request trace (spike)", async () => {
  const originalFetch = globalThis.fetch;
  const originalEventSource = globalThis.EventSource;
  const originalIdle = window.requestIdleCallback;
  const originalCancelIdle = window.cancelIdleCallback;
  window.innerWidth = 1440; window.innerHeight = 900;
  const idleTimers = new Map<number, ReturnType<typeof setTimeout>>();
  let idleId = 0;
  window.requestIdleCallback = (callback) => {
    const id = ++idleId;
    idleTimers.set(id, setTimeout(() => {
      idleTimers.delete(id);
      inIdle = true;
      try { callback({ didTimeout: false, timeRemaining: () => 50 }); } finally { inIdle = false; }
    }, 120));
    return id;
  };
  window.cancelIdleCallback = (id) => { clearTimeout(idleTimers.get(id)); idleTimers.delete(id); };
  globalThis.EventSource = class extends EventTarget {
    entry: { url: string; phase: string; wave: number; closed: boolean };
    constructor(url: string | URL) {
      super();
      this.entry = { url: normalize(url), phase, wave, closed: false };
      streams.push(this.entry);
    }
    close() { this.entry.closed = true; }
  } as unknown as typeof EventSource;
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const url = normalize(input);
    const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
    const req: Req = { seq: requests.length, wave, method, url, idle: inIdle, phase };
    requests.push(req);
    if (url === "/api/me/events") {
      // User-wide SSE stays open; not gated.
      return Promise.resolve(new Response(new ReadableStream({ start() {} }),
        { headers: { "content-type": "text/event-stream" } }));
    }
    if (url === "/api/auth/switch-account" && method === "POST") {
      selected = JSON.parse(String(init?.body)).accountId;
    }
    return new Promise<Response>((resolve, reject) => {
      const signal = init?.signal;
      signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
      pending.push({ resolve, build: () => respond(method, url), req });
    });
  }) as typeof fetch;

  try {
    if (process.env.SPIKE_PROTO) {
      // Swap in the untracked prototype controller without touching tracked files.
      const proto = await import("./useAccountController.proto.spike");
      mock.module("./useAccountController", () => proto);
    }
    if (process.env.SPIKE_DEEPLINK) {
      (window as unknown as { happyDOM: { setURL(url: string): void } }).happyDOM
        .setURL("http://localhost/?accountId=account-b&messageId=%3Caccount-b-m2%40example.test%3E");
    }
    const { default: MailClient } = await import("../MailClient");
    const view = render(
      <ThemeProvider attribute="class"><Theme>
        <Profiler id="mail" onRender={() => { commits += 1; commitsByPhase[phase] = (commitsByPhase[phase] ?? 0) + 1; }}>
          <MailClient />
        </Profiler>
      </Theme></ThemeProvider>
    );
    const listShows = (id: string) => () => Boolean(view.queryAllByText(`Subject ${id} 1`).length);
    if (process.env.SPIKE_DEEPLINK) {
      await runUntilQuiet(40, listShows("account-b"));
      const out = requests.map(r => `${r.wave}: ${r.method} ${r.url}`);
      await Bun.write(process.env.SPIKE_OUT ?? "/tmp/spike-switch-client/trace-deeplink.json", JSON.stringify({
        switchPosts: requests.filter(r => r.url === "/api/auth/switch-account").length,
        me: requests.filter(r => r.url === "/api/auth/me").length,
        bFolders: requests.filter(r => r.url === "/api/accounts/account-b/folders").length,
        listShowsB: listShows("account-b")(), requests: out }, null, 2));
      view.unmount();
      return;
    }
    const bootShown = await runUntilQuiet(40, listShows("account-a"));
    if (!listShows("account-a")()) {
      console.log("BOOT REQUESTS", JSON.stringify(requests.map(r => `${r.wave}: ${r.method} ${r.url}`), null, 1));
      console.log("BODY", document.body.textContent?.slice(0, 3000));
    }
    expect(listShows("account-a")()).toBe(true);

    const report: Record<string, unknown> = { bootShownAtWave: bootShown };
    for (const [from, to] of [["account-a", "account-b"], ["account-b", "account-a"], ["account-a", "account-b"]] as const) {
      const label = `${from === "account-a" ? "A" : "B"}->${to === "account-a" ? "A" : "B"}#${requests.filter(r => r.phase.startsWith("switch")).length ? "n" : "1"}`;
      phase = `switch ${label}`;
      wave = 0;
      const startSeq = requests.length;
      const startStream = streams.length;
      const name = to === "account-a" ? "Synthetic Alpha" : "Synthetic Beta";
      const button = view.getAllByRole("button").find(el => el.textContent?.includes(name) && el.getAttribute("data-sidebar") === "menu-button")
        ?? view.getAllByText(name)[0].closest("button")!;
      // Wrong-mailbox probe: after every commit, the header must never show the
      // new mailbox while rows of the old one are visible (and vice versa).
      const probes: string[] = [];
      probe = () => {
        const active = document.querySelector('[aria-current="true"][data-sidebar="menu-button"]')?.textContent ?? "?";
        const text = document.body.textContent ?? "";
        const rows = ["account-a", "account-b"].filter(id => text.includes(`Subject ${id} 1`));
        const topics = ["account-a", "account-b"].filter(id => text.includes(`Topic ${id}`));
        const counts = [...document.querySelectorAll("[aria-label$=' unread']")].map(el => el.getAttribute("aria-label")).join(",");
        probes.push(`wave ${wave}: counts=[${counts}] active=${active.includes("Alpha") ? "A" : active.includes("Beta") ? "B" : active} rows=${rows.join("+") || "-"} topics=${topics.join("+") || "-"}`);
      };
      if (process.env.SPIKE_HOLD_STALE && phase.includes("#1")) holdPattern = new RegExp(`/accounts/${from}/threads`);
      await act(async () => { fireEvent.click(button); });
      const shownAt = await runUntilQuiet(40, listShows(to));
      const slice = requests.slice(startSeq);
      report[phase] = {
        listShownAtWave: shownAt,
        totalRequests: slice.length,
        byWave: slice.reduce<Record<number, string[]>>((acc, r) => {
          (acc[r.wave] ??= []).push(`${r.method} ${r.url}${r.idle ? " [idle]" : ""}`); return acc;
        }, {}),
        staleOldMailbox: slice.filter(r => r.url.includes(`/accounts/${from}/`)).map(r => `${r.wave}: ${r.method} ${r.url}`),
        streams: streams.slice(startStream).map(s => `${s.wave}: ${s.url}${s.closed ? " (closed)" : ""}`),
        commits: commitsByPhase[phase] ?? 0,
        probes
      };
      if (holdPattern) {
        holdPattern = null;
        await act(async () => { for (const item of held.splice(0)) item.resolve(item.build()); });
        await runUntilQuiet(10, listShows(to));
      }
      if (!process.env.SPIKE_HOLD_STALE) expect(listShows(to)()).toBe(true);
    }
    report.bootRequests = requests.filter(r => r.phase === "boot").map(r => `${r.wave}: ${r.method} ${r.url}${r.idle ? " [idle]" : ""}`);
    report.bootCommits = commitsByPhase.boot;
    const out = process.env.SPIKE_OUT ?? "/tmp/spike-switch-client/trace.json";
    await Bun.write(out, JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
    view.unmount();
  } finally {
    cleanup();
    for (const timer of idleTimers.values()) clearTimeout(timer);
    globalThis.fetch = originalFetch;
    globalThis.EventSource = originalEventSource;
    window.requestIdleCallback = originalIdle;
    window.cancelIdleCallback = originalCancelIdle;
  }
}, 120000);
