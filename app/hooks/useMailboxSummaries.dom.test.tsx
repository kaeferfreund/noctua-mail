import { afterEach, expect, test } from "bun:test";
import { act, cleanup, render, waitFor } from "@testing-library/react";
import { Theme } from "@radix-ui/themes";
import { SidebarProvider } from "@/app/components/ui/sidebar";
import { MailboxRows, ViewRow } from "@/app/components/shell/ShellSidebar";
import type { ShellAccount } from "@/app/components/shell/types";
import { COLLAB_FOLDERS } from "@/app/components/mailclient/useSearchState";
import { collaborationViewCount } from "./mailboxSummaryEvents";
import { useMailboxSummaries } from "./useMailboxSummaries";
import type { MailboxState } from "@/lib/authClient";
import type { UserMailboxSummary } from "@/lib/mailboxSummary";

afterEach(cleanup);
const mailbox: UserMailboxSummary = { accountId: "synthetic-mailbox", name: "Synthetic", email: "team@example.test",
  accessRole: "viewer", isOwner: false, shared: true, unread: 2, assignedToMe: 3, unassignedOpen: 4, open: 6, watcher: { state: "disabled" } };
const personal = { ...mailbox, accountId: "synthetic-personal", shared: false, unread: null, watcher: { state: "idling" as const } };
const response = (rows: UserMailboxSummary[]) => Response.json({ ok: true, mailboxes: rows, generatedAt: 1 });
function harness() {
  const requests: string[] = [];
  const snapshots: Array<(response: Response) => void> = [];
  const sources: ReadableStreamDefaultController<Uint8Array>[] = [];
  const sourceRequests: string[] = [];
  let streamStatus = 200;
  let mailboxChanges = 0;
  const threadChanges: string[] = [];
  const summaryChanges: string[] = [];
  const apiFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    requests.push(String(input));
    if (String(input).endsWith("/summary")) return new Promise<Response>((resolve, reject) => {
      snapshots.push(resolve);
      init?.signal?.addEventListener("abort", () => reject(new DOMException("Synthetic aborted read", "AbortError")), { once: true });
    });
    expect(String(input)).toBe("/api/me/events");
    sourceRequests.push(String(input));
    if (streamStatus !== 200) return new Response(null, { status: streamStatus });
    const body = new ReadableStream<Uint8Array>({ start(controller) {
      sources.push(controller);
      init?.signal?.addEventListener("abort", () => { try { controller.close(); } catch {} }, { once: true });
    } });
    return new Response(body, { headers: { "Content-Type": "text/event-stream" } });
  };
  function View({ sessionKey, authState = "selected" }: { sessionKey: string | null; authState?: MailboxState | null }) {
    const rows = useMailboxSummaries({ sessionKey, authState, apiFetch, onSummaryChanged: id => summaryChanges.push(id), onMailboxesChanged: () => { mailboxChanges++; }, onThreadChanged: id => threadChanges.push(id) });
    return <Theme><SidebarProvider><output>{JSON.stringify(rows)}</output>
      <MailboxRows accounts={[personal, mailbox].map(row => ({ id: row.accountId, name: row.name, email: row.email, shared: row.shared }) as ShellAccount)} summaries={rows} activeAccountId={personal.accountId} onSwitch={() => {}} />
      <ul>{COLLAB_FOLDERS.map(folder => {
        const count = collaborationViewCount(folder.id, rows.find(row => row.accountId === mailbox.accountId));
        return <ViewRow key={folder.id} view={{ ...folder, icon: null, count, countAriaLabel: `${count ?? 0} threads`, active: false, onSelect: () => {} }} />;
      })}</ul>
    </SidebarProvider></Theme>;
  }
  const view = render(<View sessionKey="synthetic-session-a" />);
  const send = async (event: object, index = sources.length - 1) => {
    await act(async () => sources[index].enqueue(new TextEncoder().encode(`event: ${(event as { type: string }).type}\ndata: ${JSON.stringify(event)}\n\n`)));
  };
  const read = async (rows = [personal, mailbox]) => {
    await waitFor(() => expect(snapshots.length).toBeGreaterThan(0));
    await act(async () => snapshots.shift()!(response(rows)));
  };
  return { view, requests, sources, sourceRequests, snapshots, send, read, View, threadChanges, summaryChanges,
    changes: () => mailboxChanges, denyStream: (status = 403) => { streamStatus = status; } };
}

test("sidebar shows inactive and personal badges and view counts; burst SSE applies without full reads", async () => {
  const h = harness(); await h.read();
  expect(h.sourceRequests).toHaveLength(1); expect(h.snapshots).toHaveLength(0);
  expect(h.view.getByLabelText("Unread count unavailable")).toBeTruthy();
  expect(h.view.getByLabelText("Watcher: idling")).toBeTruthy();
  expect(h.view.getAllByRole("button")[0].getAttribute("title")).toContain("Watcher: idling");
  expect(h.view.getByLabelText("2 unread")).toBeTruthy();
  expect(h.view.getByLabelText("3 threads")).toBeTruthy();
  for (const unread of [7, 8, 9]) await h.send({ type: "mailbox-summary", accountId: mailbox.accountId, unread, assignedToMe: 8, unassignedOpen: 7, open: 10, watcher: { state: "auth_failed", lastEventAt: 1234 } });
  expect(h.summaryChanges).toEqual([mailbox.accountId, mailbox.accountId, mailbox.accountId]);
  expect(h.view.getByLabelText("9 unread")).toBeTruthy();
  expect(h.view.getByLabelText("8 assigned to me")).toBeTruthy();
  expect(h.view.getByLabelText("8 threads")).toBeTruthy();
  expect(h.view.getByLabelText("7 threads")).toBeTruthy();
  expect(h.snapshots).toHaveLength(0);
  expect(h.view.getByLabelText("10 threads")).toBeTruthy();
  expect(h.view.getByLabelText("Watcher: auth_failed")).toBeTruthy();
  for (const revision of [2, 2, 1, 3]) await h.send({ type: "thread-collab", accountId: mailbox.accountId, threadId: "synthetic-thread", revision });
  expect(h.threadChanges).toEqual([mailbox.accountId, mailbox.accountId]);
  expect(h.snapshots).toHaveLength(0);
});

test("events during initial snapshot overlay latest absolute counts without a second GET", async () => {
  const h = harness();
  await waitFor(() => expect(h.snapshots).toHaveLength(1));
  await h.send({ type: "mailbox-summary", accountId: mailbox.accountId, unread: 9, assignedToMe: 8, unassignedOpen: 7, open: 10, watcher: { state: "auth_failed", lastEventAt: 1234 } });
  expect(h.snapshots).toHaveLength(1);
  await h.read();
  expect(h.view.getByLabelText("9 unread")).toBeTruthy();
  expect(h.snapshots).toHaveLength(0);
});

test("membership invalidation clears badges immediately and cannot accept an older in-flight read", async () => {
  const h = harness(); await h.read();
  await h.send({ type: "mailbox-summary", accountId: "synthetic-grant", unread: 1, assignedToMe: 0, unassignedOpen: 1, open: 1, watcher: { state: "idling" } });
  const stale = h.snapshots.shift()!;
  await h.send({ type: "mailboxes-changed" });
  expect(h.changes()).toBe(1); expect(h.view.queryByLabelText("2 unread")).toBeNull();
  expect(h.view.queryByLabelText("6 threads")).toBeNull();
  await act(async () => stale(response([personal, mailbox])));
  await h.read([personal]);
  expect(h.view.queryByLabelText("2 unread")).toBeNull();
  expect(h.view.getByLabelText("Unread count unavailable")).toBeTruthy();
});

for (const denial of ["summary", "stream"] as const) test(`reconnect reads once; ${denial} 403 clears data and permanently stops retries`, async () => {
  const h = harness(); await h.read();
  const originalTimeout = globalThis.setTimeout;
  const retries: Array<{ delay: number; run: () => void }> = [];
  const handles: ReturnType<typeof setTimeout>[] = [];
  globalThis.setTimeout = ((fn: () => void, delay: number, ...args: unknown[]) => {
    if ([1000, 2000, 4000, 8000, 16000, 30000].includes(delay)) {
      retries.push({ delay, run: fn }); const handle = originalTimeout(() => {}, 60_000); handles.push(handle); return handle;
    }
    return originalTimeout(fn, delay, ...args);
  }) as typeof setTimeout;
  try {
    await act(async () => h.sources[0].close());
    expect(retries.map(retry => retry.delay)).toEqual([1000]);
    await act(async () => retries.shift()!.run());
    expect(h.snapshots).toHaveLength(1);
    await act(async () => h.snapshots.shift()!(response([{ ...mailbox, unread: 5 }])));
    expect(h.sourceRequests).toHaveLength(2); expect(h.snapshots).toHaveLength(0);
    expect(h.view.getByLabelText("5 unread")).toBeTruthy();
    await act(async () => h.sources[1].close());
    expect(retries[0].delay).toBe(2000);
    if (denial === "stream") h.denyStream();
    await act(async () => retries.shift()!.run());
    if (denial === "summary") await act(async () => h.snapshots.shift()!(new Response(null, { status: 403 })));
    expect(h.view.queryByLabelText("5 unread")).toBeNull();
    expect(h.view.queryByLabelText("6 threads")).toBeNull();
    expect(retries).toHaveLength(0);
    expect(h.changes()).toBe(0); // No logout or bootstrap request on a denied stream.
  } finally { cleanup(); globalThis.setTimeout = originalTimeout; handles.forEach(clearTimeout); }
});

test("session changes isolate late snapshots and cancel old streams", async () => {
  const h = harness();
  await waitFor(() => expect(h.snapshots).toHaveLength(1));
  const old = h.snapshots.shift()!;
  h.view.rerender(<h.View sessionKey="synthetic-session-b" />);
  await act(async () => old(response([mailbox])));
  expect(h.view.queryByLabelText("2 unread")).toBeNull();
  await h.read([{ ...mailbox, unread: 1 }]);
  expect(h.view.getByLabelText("1 unread")).toBeTruthy();
  h.view.rerender(<h.View sessionKey={null} />);
  expect(h.view.queryByLabelText("1 unread")).toBeNull();
});


test("disconnect during a pending snapshot cancels the old read and reconnects without waiting for it", async () => {
  const h = harness();
  await waitFor(() => expect(h.snapshots).toHaveLength(1));
  const obsolete = h.snapshots.shift()!;
  await act(async () => h.sources[0].close());
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 1050)); });
  expect(h.sourceRequests).toHaveLength(2);
  await h.read([{ ...mailbox, unread: 5 }]);
  await act(async () => obsolete(response([mailbox])));
  expect(h.view.getByLabelText("5 unread")).toBeTruthy();
  expect(h.view.queryByLabelText("2 unread")).toBeNull();
  expect(h.snapshots).toHaveLength(0);
});

async function withRetryTimers(run: (retries: Array<{ delay: number; run: () => void }>) => Promise<void>) {
  const original = globalThis.setTimeout;
  const retries: Array<{ delay: number; run: () => void }> = [];
  const handles: ReturnType<typeof setTimeout>[] = [];
  globalThis.setTimeout = ((fn: () => void, delay: number, ...args: unknown[]) => {
    if ([1000, 2000, 4000, 8000, 16000, 30000].includes(delay)) {
      retries.push({ delay, run: fn });
      const handle = original(() => {}, 60_000); handles.push(handle); return handle;
    }
    return original(fn, delay, ...args);
  }) as typeof setTimeout;
  try { await run(retries); }
  finally { cleanup(); globalThis.setTimeout = original; handles.forEach(clearTimeout); }
}

for (const denial of ["summary", "stream"] as const) {
  test(`${denial} 401 clears data, retries with bounded backoff, and resumes canonical reads and live events`, async () => {
    const h = harness(); await h.read();
    await withRetryTimers(async retries => {
      await act(async () => h.sources[0].close());
      if (denial === "stream") h.denyStream(401);
      await act(async () => retries.shift()!.run());
      if (denial === "summary") await act(async () => h.snapshots.shift()!(new Response(null, { status: 401 })));
      expect(h.view.queryByLabelText("2 unread")).toBeNull();
      expect(retries.map(retry => retry.delay)).toEqual([2000]);
      h.denyStream(200);
      const before = h.requests.filter(path => path.endsWith("/summary")).length;
      await act(async () => retries.shift()!.run());
      await h.read();
      expect(h.requests.filter(path => path.endsWith("/summary"))).toHaveLength(before + 1);
      await h.send({ type: "mailbox-summary", accountId: mailbox.accountId, unread: 11, assignedToMe: 3, unassignedOpen: 4, open: 8, watcher: { state: "idling" } });
      expect(h.view.getByLabelText("11 unread")).toBeTruthy();
      expect(h.view.getByLabelText("8 threads")).toBeTruthy();
      expect(h.snapshots).toHaveLength(0);
    });
  });

  test(`${denial} 401 immediately retries once when the four-state auth signal recovers with the same sessionKey`, async () => {
    const h = harness(); await h.read();
    await withRetryTimers(async retries => {
      await act(async () => h.sources[0].close());
      if (denial === "stream") h.denyStream(401);
      await act(async () => retries.shift()!.run());
      if (denial === "summary") await act(async () => h.snapshots.shift()!(new Response(null, { status: 401 })));
      const before = h.requests.filter(path => path.endsWith("/summary")).length;
      h.view.rerender(<h.View sessionKey="synthetic-session-a" authState="enrollment" />);
      expect(h.view.queryByLabelText("2 unread")).toBeNull();
      h.denyStream(200);
      h.view.rerender(<h.View sessionKey="synthetic-session-a" authState="unselected" />);
      await h.read();
      expect(h.requests.filter(path => path.endsWith("/summary"))).toHaveLength(before + 1);
      await h.send({ type: "mailbox-summary", accountId: mailbox.accountId, unread: 12, assignedToMe: 3, unassignedOpen: 4, open: 8, watcher: { state: "idling" } });
      expect(h.view.getByLabelText("12 unread")).toBeTruthy();
      expect(h.snapshots).toHaveLength(0);
    });
  });
}

test("403 remains stopped across auth-state recovery for the same session", async () => {
  const h = harness();
  await waitFor(() => expect(h.snapshots).toHaveLength(1));
  await act(async () => h.snapshots.shift()!(new Response(null, { status: 403 })));
  h.view.rerender(<h.View sessionKey="synthetic-session-a" authState="enrollment" />);
  h.view.rerender(<h.View sessionKey="synthetic-session-a" authState="selected" />);
  expect(h.sourceRequests).toHaveLength(1);
  expect(h.snapshots).toHaveLength(0);
});

test("unknown mailbox during pending GET is repaired by exactly one coalesced canonical read", async () => {
  const h = harness();
  await waitFor(() => expect(h.snapshots).toHaveLength(1));
  const added = { ...mailbox, accountId: "synthetic-b", unread: 13 };
  for (let i = 0; i < 20; i++) await h.send({ type: "mailbox-summary", accountId: added.accountId, unread: 13, assignedToMe: 3, unassignedOpen: 4, open: 6, watcher: { state: "idling" } });
  expect(h.requests.filter(path => path.endsWith("/summary"))).toHaveLength(1);
  await h.read([mailbox]);
  await waitFor(() => expect(h.snapshots).toHaveLength(1));
  await h.read([mailbox, added]);
  expect(JSON.parse(h.view.container.querySelector("output")!.textContent!).map((row: UserMailboxSummary) => row.accountId)).toEqual([mailbox.accountId, added.accountId]);
  expect(h.requests.filter(path => path.endsWith("/summary"))).toHaveLength(2);
  expect(h.snapshots).toHaveLength(0);
});

test("watcher transition replaces stale state and timestamp incrementally; legacy events share one metadata repair", async () => {
  const h = harness(); await h.read([{ ...mailbox, watcher: { state: "idling", lastEventAt: 1234 } }]);
  await h.send({ type: "mailbox-summary", accountId: mailbox.accountId, unread: 2, assignedToMe: 3, unassignedOpen: 4, open: 6, watcher: { state: "auth_failed" } });
  expect(h.view.getByLabelText("Watcher: auth_failed")).toBeTruthy();
  expect(JSON.parse(h.view.container.querySelector("output")!.textContent!)[0].watcher).toEqual({ state: "auth_failed" });
  expect(h.snapshots).toHaveLength(0);
  for (let i = 0; i < 20; i++) await h.send({ type: "mailbox-summary", accountId: mailbox.accountId, unread: 3, assignedToMe: 3, unassignedOpen: 4 });
  expect(h.snapshots).toHaveLength(1);
  await h.read([{ ...mailbox, watcher: { state: "backoff" } }]);
  expect(h.view.getByLabelText("Watcher: backoff")).toBeTruthy();
  expect(h.requests.filter(path => path.endsWith("/summary"))).toHaveLength(2);
  expect(h.snapshots).toHaveLength(0);
});

test("request-count table: open 1 GET + 1 stream; 20 events 0 GETs; reconnect 1; membership change 1", async () => {
  const h = harness(); await h.read();
  await withRetryTimers(async retries => {
    const gets = () => h.requests.filter(path => path.endsWith("/summary")).length;
    expect(gets()).toBe(1); expect(h.sourceRequests).toHaveLength(1);
    for (let unread = 1; unread <= 20; unread++) await h.send({ type: "mailbox-summary", accountId: mailbox.accountId, unread, assignedToMe: 3, unassignedOpen: 4, open: 6, watcher: { state: "idling" } });
    expect(gets()).toBe(1);
    await act(async () => h.sources[0].close());
    await act(async () => retries.shift()!.run()); await h.read();
    expect(gets()).toBe(2);
    await h.send({ type: "mailboxes-changed" }); await h.read();
    expect(gets()).toBe(3); expect(h.sourceRequests).toHaveLength(2);
  });
});
