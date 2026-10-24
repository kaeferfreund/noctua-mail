import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { act, cleanup, renderHook } from "@testing-library/react";
import { useRef } from "react";
import type { Folder } from "@/lib/data";
import { useSyncController, type UseSyncControllerParams } from "./useSyncController";

import { I18nTestProvider } from "@/lib/i18n/testRender";

afterEach(cleanup);
const noop = () => {};
const folder = (accountId: string): Folder => ({ id: `${accountId}:INBOX`, accountId, name: "INBOX", count: 0, specialUse: "\\Inbox" });
const archive = (accountId: string): Folder => ({ id: `${accountId}:Archive`, accountId, name: "Archive", count: 0 });
let streamFolderStatus = 200;

type JobStatus = { result?: { count: number; newMessages?: readonly unknown[] }; progress?: { mode: string } };

function mount(confirm: UseSyncControllerParams["confirmFullSyncStart"] = async () => true, jobStatus: JobStatus = { result: { count: 0 } }, authState: UseSyncControllerParams["authState"] = "loading") {
  const jobs: { accountId: string; folderId?: string }[] = [];
  const requests: string[] = [];
  const refreshes: Array<{ skipIfCurrent?: boolean } | undefined> = [];
  const folderSwitches: Array<{ path: string; body: unknown }> = [];
  const apiFetch: UseSyncControllerParams["apiFetch"] = async (input, init) => {
    const path = String(input);
    requests.push(path);
    if (path.endsWith("/imap/stream/folder")) {
      folderSwitches.push({ path, body: JSON.parse(String(init?.body)) });
      return Response.json({ ok: streamFolderStatus === 200 }, { status: streamFolderStatus });
    }
    if (path.endsWith("/sync")) {
      jobs.push({ ...JSON.parse(String(init?.body)), accountId: path.split("/")[3] });
      return Response.json({ ok: true, jobId: "synthetic-job" });
    }
    if (path.includes("/sync/status")) return Response.json({ ok: true, job: { status: "done", ...jobStatus } });
    if (path.endsWith("/new-candidates")) return Response.json({ ok: true, decisions: [] });
    return Response.json({ ok: true, needsRepair: false });
  };
  const hook = renderHook(({ accountId, folderId }) => useSyncController({
    activeAccountId: accountId, activeFolderId: folderId, activeVirtualFolderId: "", searchScope: "folder", authState,
    inboxMailboxPath: authState === "ok" ? "INBOX" : "", accountFolders: [folder(accountId), archive(accountId)], inboxFolder: folder(accountId), apiFetch,
    readErrorMessage: async res => `HTTP ${res.status}`, reportError: noop, pushNotice: noop, showNotification: async () => false,
    refreshMailboxData: async options => { refreshes.push(options); return true; }, refreshFolders: async () => [folder(accountId)], refreshPendingCalendarReminders: async () => {},
    setFolders: noop, setMessages: noop, setActiveFolderId: noop, isNotificationSuppressedFolder: () => false,
    updateMessagesWithCurrentResultPrune: noop, confirmFullSyncStart: confirm, currentKeyRef: useRef(accountId)
  }), { initialProps: { accountId: "synthetic-a", folderId: "synthetic-a:INBOX" }, wrapper: I18nTestProvider });
  return { ...hook, jobs, refreshes, requests, folderSwitches };
}

describe("planned SSE reconnect", () => {
  const sources: SyntheticEventSource[] = [];
  class SyntheticEventSource extends EventTarget {
    closes = 0;
    constructor(readonly url: string) { super(); sources.push(this); }
    close() { this.closes++; }
  }
  let originalEventSource: typeof EventSource;
  let originalVisibility: PropertyDescriptor | undefined;
  let intervalSpy: ReturnType<typeof spyOn<typeof window, "setInterval">>;
  let timeoutSpy: ReturnType<typeof spyOn<typeof window, "setTimeout">>;
  const visibility = (value: DocumentVisibilityState) => Object.defineProperty(document, "visibilityState", { configurable: true, value });
  const streamParams = (source: SyntheticEventSource) => new URL(source.url, "http://localhost").searchParams;
  const withoutKey = (source: SyntheticEventSource) => {
    const params = streamParams(source); params.delete("streamKey");
    return `${source.url.split("?")[0]}?${params}`;
  };
  beforeEach(() => {
    streamFolderStatus = 200;
    originalEventSource = globalThis.EventSource;
    originalVisibility = Object.getOwnPropertyDescriptor(document, "visibilityState");
    globalThis.EventSource = SyntheticEventSource as unknown as typeof EventSource;
    visibility("visible");
    intervalSpy = spyOn(window, "setInterval");
    timeoutSpy = spyOn(window, "setTimeout");
  });
  afterEach(() => {
    cleanup();
    intervalSpy.mockRestore();
    timeoutSpy.mockRestore();
    globalThis.EventSource = originalEventSource;
    if (originalVisibility) Object.defineProperty(document, "visibilityState", originalVisibility);
    else Reflect.deleteProperty(document, "visibilityState");
    sources.length = 0;
  });

  test("reconnect closes the old source and immediately opens exactly one new source without polling or retry delay", async () => {
    const h = mount(undefined, undefined, "ok");
    await act(async () => { sources[0].dispatchEvent(new Event("open")); });
    expect(h.result.current.streamMode).toBe("stream");
    await act(async () => { sources[0].dispatchEvent(new MessageEvent("reconnect", { data: '{"streamId":"12345678"}' })); });
    expect(sources).toHaveLength(2);
    expect(sources[0].closes).toBe(1);
    expect(sources[1].closes).toBe(0);
    // Same account and folder; every stream carries its own key.
    expect(withoutKey(sources[1])).toBe(withoutKey(sources[0]));
    expect(streamParams(sources[1]).get("streamKey")).not.toBe(streamParams(sources[0]).get("streamKey"));
    expect(h.result.current.streamMode).toBe("stream");
    expect(h.result.current.mailCheckMode).toBe("idle");
    expect(h.requests.some(path => path.includes("/imap/poll"))).toBe(false);
    expect(intervalSpy).not.toHaveBeenCalled();
    expect(timeoutSpy.mock.calls.some(([, ms]) => ms === 15000)).toBe(false);
    // Even a queued event from the replaced source must not create a third one.
    act(() => { sources[0].dispatchEvent(new Event("reconnect")); });
    expect(sources).toHaveLength(2);
  });

  test("reconnect from an old account or after unmount cannot reopen a stream", async () => {
    const h = mount(undefined, undefined, "ok");
    await act(async () => {});
    const original = sources[0];
    h.rerender({ accountId: "synthetic-a", folderId: "synthetic-a:Archive" });
    h.rerender({ accountId: "synthetic-b", folderId: "synthetic-b:INBOX" });
    expect(sources).toHaveLength(2);
    const current = sources[1];
    act(() => { original.dispatchEvent(new Event("reconnect")); });
    expect(sources).toHaveLength(2);
    expect(current.closes).toBe(0);
    h.unmount();
    act(() => { current.dispatchEvent(new Event("reconnect")); });
    expect(sources).toHaveLength(2);
    expect(sources.every(source => source.closes === 1)).toBe(true);
    expect(intervalSpy).not.toHaveBeenCalled();
  });

  test("a folder switch moves the open stream; only an account switch opens a new one", async () => {
    const h = mount(undefined, undefined, "ok");
    await act(async () => { sources[0].dispatchEvent(new Event("open")); });
    const streamKey = streamParams(sources[0]).get("streamKey");
    expect(streamKey).toMatch(/^[a-f0-9]{32}$/);
    expect(streamParams(sources[0]).get("activeFolderId")).toBe("synthetic-a:INBOX");
    await act(async () => { h.rerender({ accountId: "synthetic-a", folderId: "synthetic-a:Archive" }); });
    await act(async () => { h.rerender({ accountId: "synthetic-a", folderId: "synthetic-a:INBOX" }); });
    // Before: every folder switch closed the source and opened a new one (INBOX reconnect on the server).
    expect(sources).toHaveLength(1);
    expect(sources[0].closes).toBe(0);
    expect(h.folderSwitches).toEqual([
      { path: "/api/accounts/synthetic-a/imap/stream/folder", body: { streamKey, folderId: "synthetic-a:Archive", seq: 1 } },
      { path: "/api/accounts/synthetic-a/imap/stream/folder", body: { streamKey, folderId: "synthetic-a:INBOX", seq: 2 } }
    ]);
    expect(h.result.current.streamMode).toBe("stream");
    await act(async () => { h.rerender({ accountId: "synthetic-b", folderId: "synthetic-b:INBOX" }); });
    expect(sources).toHaveLength(2);
    expect(sources[0].closes).toBe(1);
    expect(sources[1].url.startsWith("/api/accounts/synthetic-b/imap/stream?")).toBe(true);
    expect(h.folderSwitches).toHaveLength(2);
  });

  test("a switch made while the stream opens is sent once it is open", async () => {
    const h = mount(undefined, undefined, "ok");
    await act(async () => { h.rerender({ accountId: "synthetic-a", folderId: "synthetic-a:Archive" }); });
    expect(h.folderSwitches).toHaveLength(0);
    await act(async () => { sources[0].dispatchEvent(new Event("open")); });
    expect(h.folderSwitches.map(entry => entry.body)).toEqual([
      { streamKey: streamParams(sources[0]).get("streamKey"), folderId: "synthetic-a:Archive", seq: 1 }
    ]);
    expect(sources).toHaveLength(1);
  });

  test("a switch the server cannot apply reopens the stream on the current folder", async () => {
    const h = mount(undefined, undefined, "ok");
    await act(async () => { sources[0].dispatchEvent(new Event("open")); });
    streamFolderStatus = 404;
    await act(async () => { h.rerender({ accountId: "synthetic-a", folderId: "synthetic-a:Archive" }); });
    expect(sources).toHaveLength(2);
    expect(sources[0].closes).toBe(1);
    expect(streamParams(sources[1]).get("activeFolderId")).toBe("synthetic-a:Archive");
  });

  test("reconnect while hidden closes the source, polls in the background and reopens on visibility", async () => {
    const h = mount(undefined, undefined, "ok");
    await act(async () => { sources[0].dispatchEvent(new Event("open")); });
    expect(h.result.current.streamMode).toBe("stream");
    // `visibilitychange` was missed: the page is hidden but still in stream mode.
    visibility("hidden");
    await act(async () => { sources[0].dispatchEvent(new Event("reconnect")); });
    expect(sources).toHaveLength(1);
    expect(sources[0].closes).toBe(1);
    expect(h.result.current.streamMode).toBe("polling");
    expect(h.result.current.mailCheckMode).toBe("polling");
    expect(intervalSpy.mock.calls.filter(([, ms]) => ms === 300000)).toHaveLength(1);
    expect(h.requests.filter(path => path.includes("/imap/poll"))).toHaveLength(1);
    visibility("visible");
    act(() => { document.dispatchEvent(new Event("visibilitychange")); });
    expect(sources).toHaveLength(2);
  });
});

test("a switched controller rejects the old folder and retained callbacks, then syncs its own INBOX", async () => {
  const { result, rerender, jobs } = mount();
  const oldSync = result.current.syncAccount;
  rerender({ accountId: "synthetic-b", folderId: "synthetic-a:INBOX" });
  await act(async () => {
    await oldSync("synthetic-a:INBOX", "new");
    await result.current.syncAccount("synthetic-a:INBOX", "full");
    await result.current.syncFolderWithBackgroundRef.current("synthetic-a:INBOX", true, "full");
    await result.current.syncAccount("synthetic-b:INBOX", "new");
  });
  expect(jobs).toHaveLength(1);
  expect(jobs[0]).toMatchObject({ accountId: "synthetic-b", folderId: "synthetic-b:INBOX" });
});

test("a full sync awaiting confirmation is cancelled when the account changes", async () => {
  let resolve!: (accepted: boolean) => void;
  const confirmation = new Promise<boolean>(done => { resolve = done; });
  const { result, rerender, jobs } = mount(() => confirmation);
  let pending!: Promise<unknown>;
  act(() => { pending = result.current.syncFolderWithBackgroundRef.current("synthetic-a:INBOX", true, "full"); });
  rerender({ accountId: "synthetic-b", folderId: "synthetic-b:INBOX" });
  await act(async () => { resolve(true); await pending; });
  expect(jobs).toEqual([]);
});

describe("refresh after a folder sync", () => {
  const syncInbox = async (jobStatus: JobStatus, mode: "new" | "recent" = "new") => {
    const h = mount(undefined, jobStatus);
    const before = h.result.current.syncCompletionVersion;
    await act(async () => { await h.result.current.syncFolderWithBackgroundRef.current("synthetic-a:INBOX", true, mode); });
    return { refreshes: h.refreshes, countsReloaded: h.result.current.syncCompletionVersion !== before };
  };

  test("a new-mail sync that wrote nothing keeps the page on screen and the virtual counts", async () => {
    const { refreshes, countsReloaded } = await syncInbox({ result: { count: 0 }, progress: { mode: "new" } });
    expect(refreshes).toEqual([{ skipIfCurrent: true }]);
    expect(countsReloaded).toBe(false);
  });

  test("a sync that wrote messages, escalated or ran in another mode re-reads list and counts as before", async () => {
    for (const [status, mode] of [
      [{ result: { count: 2 }, progress: { mode: "new" } }, "new"],
      [{ result: { count: 0, newMessages: [{}] }, progress: { mode: "new" } }, "new"],
      [{ result: { count: 0 }, progress: { mode: "full" } }, "new"],
      [{ result: { count: 0 }, progress: { mode: "recent" } }, "recent"]
    ] as const) {
      const { refreshes, countsReloaded } = await syncInbox(status, mode);
      expect(refreshes).toEqual([undefined]);
      expect(countsReloaded).toBe(true);
      cleanup();
    }
  });
});
