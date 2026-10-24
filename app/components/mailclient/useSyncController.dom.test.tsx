import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { act, cleanup, renderHook } from "@testing-library/react";
import { useRef } from "react";
import type { Folder } from "@/lib/data";
import { useSyncController, type UseSyncControllerParams } from "./useSyncController";

import { I18nTestProvider } from "@/lib/i18n/testRender";

afterEach(cleanup);
const noop = () => {};
const folder = (accountId: string): Folder => ({ id: `${accountId}:INBOX`, accountId, name: "INBOX", count: 0, specialUse: "\\Inbox" });

type JobStatus = { result?: { count: number; newMessages?: readonly unknown[] }; progress?: { mode: string } };

function mount(confirm: UseSyncControllerParams["confirmFullSyncStart"] = async () => true, jobStatus: JobStatus = { result: { count: 0 } }, authState: UseSyncControllerParams["authState"] = "loading") {
  const jobs: { accountId: string; folderId?: string }[] = [];
  const requests: string[] = [];
  const refreshes: Array<{ skipIfCurrent?: boolean } | undefined> = [];
  const apiFetch: UseSyncControllerParams["apiFetch"] = async (input, init) => {
    const path = String(input);
    requests.push(path);
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
    inboxMailboxPath: authState === "ok" ? "INBOX" : "", accountFolders: [folder(accountId)], inboxFolder: folder(accountId), apiFetch,
    readErrorMessage: async res => `HTTP ${res.status}`, reportError: noop, pushNotice: noop, showNotification: async () => false,
    refreshMailboxData: async options => { refreshes.push(options); return true; }, refreshFolders: async () => [folder(accountId)], refreshPendingCalendarReminders: async () => {},
    setFolders: noop, setMessages: noop, setActiveFolderId: noop, isNotificationSuppressedFolder: () => false,
    updateMessagesWithCurrentResultPrune: noop, confirmFullSyncStart: confirm, currentKeyRef: useRef(accountId)
  }), { initialProps: { accountId: "synthetic-a", folderId: "synthetic-a:INBOX" }, wrapper: I18nTestProvider });
  return { ...hook, jobs, refreshes, requests };
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
  beforeEach(() => {
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
    expect(sources[1].url).toBe(sources[0].url);
    expect(h.result.current.streamMode).toBe("stream");
    expect(h.result.current.mailCheckMode).toBe("idle");
    expect(h.requests.some(path => path.includes("/imap/poll"))).toBe(false);
    expect(intervalSpy).not.toHaveBeenCalled();
    expect(timeoutSpy.mock.calls.some(([, ms]) => ms === 15000)).toBe(false);
    // Even a queued event from the replaced source must not create a third one.
    act(() => { sources[0].dispatchEvent(new Event("reconnect")); });
    expect(sources).toHaveLength(2);
  });

  test("reconnect from an old folder/account or after unmount cannot reopen a stream", async () => {
    const h = mount(undefined, undefined, "ok");
    await act(async () => {});
    const original = sources[0];
    h.rerender({ accountId: "synthetic-a", folderId: "synthetic-a:Archive" });
    const folderSource = sources[1];
    h.rerender({ accountId: "synthetic-b", folderId: "synthetic-b:INBOX" });
    expect(sources).toHaveLength(3);
    const current = sources[2];
    act(() => { original.dispatchEvent(new Event("reconnect")); folderSource.dispatchEvent(new Event("reconnect")); });
    expect(sources).toHaveLength(3);
    expect(current.closes).toBe(0);
    h.unmount();
    act(() => { current.dispatchEvent(new Event("reconnect")); });
    expect(sources).toHaveLength(3);
    expect(sources.every(source => source.closes === 1)).toBe(true);
    expect(intervalSpy).not.toHaveBeenCalled();
  });

  test("reconnect while hidden closes the source and waits for visibility before reopening", async () => {
    const h = mount(undefined, undefined, "ok");
    await act(async () => {});
    visibility("hidden");
    act(() => { sources[0].dispatchEvent(new Event("reconnect")); });
    expect(sources).toHaveLength(1);
    expect(sources[0].closes).toBe(1);
    expect(intervalSpy).not.toHaveBeenCalled();
    expect(h.requests.some(path => path.includes("/imap/poll"))).toBe(false);
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
