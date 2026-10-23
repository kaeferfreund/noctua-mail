import { afterEach, expect, test } from "bun:test";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { useSearchState } from "./useSearchState";

afterEach(cleanup);
test("summary owns all collaboration view counts; search never requests a listThreads message total", async () => {
  const calls: string[] = [];
  const apiFetch = async (url: string) => { calls.push(url); return Response.json({ total: 2 }); };
  const hook = renderHook(({ account, sync }) => useSearchState({ activeAccountId: account, activeFolderId: "", setActiveFolderId: () => {}, accountFolders: [], folderById: new Map(), query: "", setQuery: () => {},
    isRelatedSearch: false, relatedRestoreRef: { current: null }, relatedQueryId: null, virtualDefaultExcludedFolderIdsKey: "synthetic-trash", syncCompletionVersion: sync, apiFetch }), { initialProps: { account: "synthetic-a", sync: 0 } });
  await waitFor(() => expect(hook.result.current.state.focusedUnreadCount).toBe(2));
  expect(calls).toHaveLength(4);
  hook.rerender({ account: "synthetic-b", sync: 1 });
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 200)); });
  expect(calls).toHaveLength(8);
  expect(calls.every(url => !url.includes("/threads?") && !url.includes("badges=open") && !url.includes("badges=unassigned") && !url.includes("assigned-to-me"))).toBe(true);
});

test("QA-101 virtual unread counts follow authoritative folder counts without a full sync", async () => {
  let unread = 110;
  const calls: string[] = [];
  const apiFetch = async (url: string) => { calls.push(url); return Response.json({ total: unread }); };
  const folder = { id: "synthetic:INBOX", accountId: "synthetic", name: "INBOX", count: 300, unreadCount: 110 };
  const hook = renderHook(({ folders }) => useSearchState({ activeAccountId: "synthetic", activeFolderId: folder.id, setActiveFolderId: () => {}, accountFolders: folders, folderById: new Map(folders.map(item => [item.id, item])), query: "", setQuery: () => {},
    isRelatedSearch: false, relatedRestoreRef: { current: null }, relatedQueryId: null, virtualDefaultExcludedFolderIdsKey: "", syncCompletionVersion: 0, apiFetch }), { initialProps: { folders: [folder] } });
  await waitFor(() => expect(hook.result.current.state.focusedUnreadCount).toBe(110));
  for (const next of [109, 110, 111]) {
    unread = next;
    hook.rerender({ folders: [{ ...folder, unreadCount: next }] });
    await waitFor(() => expect(hook.result.current.state.focusedUnreadCount).toBe(next));
  }
  expect(calls).toHaveLength(16);
  // Re-delivering the same absolute counts should not issue another four reads.
  hook.rerender({ folders: [{ ...folder, unreadCount: 111 }] });
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 200)); });
  expect(calls).toHaveLength(16);
});
