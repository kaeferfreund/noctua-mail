import { afterEach, expect, test } from "bun:test";
import { act, cleanup, renderHook } from "@testing-library/react";
import { useRef } from "react";
import type { Folder } from "@/lib/data";
import { useSyncController, type UseSyncControllerParams } from "./useSyncController";

import { I18nTestProvider } from "@/lib/i18n/testRender";

afterEach(cleanup);
const noop = () => {};
const folder = (accountId: string): Folder => ({ id: `${accountId}:INBOX`, accountId, name: "INBOX", count: 0, specialUse: "\\Inbox" });

function mount(confirm: UseSyncControllerParams["confirmFullSyncStart"] = async () => true) {
  const jobs: { accountId: string; folderId?: string }[] = [];
  const apiFetch: UseSyncControllerParams["apiFetch"] = async (input, init) => {
    const path = String(input);
    if (path.endsWith("/sync")) {
      jobs.push({ ...JSON.parse(String(init?.body)), accountId: path.split("/")[3] });
      return Response.json({ ok: true, jobId: "synthetic-job" });
    }
    if (path.includes("/sync/status")) return Response.json({ ok: true, job: { status: "done", result: { count: 0 } } });
    if (path.endsWith("/new-candidates")) return Response.json({ ok: true, decisions: [] });
    return Response.json({ ok: true, needsRepair: false });
  };
  const hook = renderHook(({ accountId, folderId }) => useSyncController({
    activeAccountId: accountId, activeFolderId: folderId, activeVirtualFolderId: "", searchScope: "folder", authState: "loading",
    inboxMailboxPath: "", accountFolders: [folder(accountId)], inboxFolder: folder(accountId), apiFetch,
    readErrorMessage: async res => `HTTP ${res.status}`, reportError: noop, pushNotice: noop, showNotification: async () => false,
    refreshMailboxData: async () => true, refreshFolders: async () => [folder(accountId)], refreshPendingCalendarReminders: async () => {},
    setFolders: noop, setMessages: noop, setActiveFolderId: noop, isNotificationSuppressedFolder: () => false,
    updateMessagesWithCurrentResultPrune: noop, confirmFullSyncStart: confirm, currentKeyRef: useRef(accountId)
  }), { initialProps: { accountId: "synthetic-a", folderId: "synthetic-a:INBOX" }, wrapper: I18nTestProvider });
  return { ...hook, jobs };
}

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
