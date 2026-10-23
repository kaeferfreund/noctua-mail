import { afterEach, expect, test } from "bun:test";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { UiLocale } from "@/lib/i18n/config";
import type { ReactNode } from "react";
import { I18nTestProvider } from "@/lib/i18n/testRender";
import { useSearchState } from "./useSearchState";

afterEach(cleanup);
test("summary owns all collaboration view counts; search never requests a listThreads message total", async () => {
  const calls: string[] = [];
  const apiFetch = async (url: string) => { calls.push(url); return Response.json({ total: 2 }); };
  const hook = renderHook(({ account, sync }) => useSearchState({ activeAccountId: account, activeFolderId: "", setActiveFolderId: () => {}, accountFolders: [], folderById: new Map(), query: "", setQuery: () => {},
    isRelatedSearch: false, relatedRestoreRef: { current: null }, relatedQueryId: null, virtualDefaultExcludedFolderIdsKey: "synthetic-trash", syncCompletionVersion: sync, apiFetch }), { wrapper: I18nTestProvider, initialProps: { account: "synthetic-a", sync: 0 } });
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
    isRelatedSearch: false, relatedRestoreRef: { current: null }, relatedQueryId: null, virtualDefaultExcludedFolderIdsKey: "", syncCompletionVersion: 0, apiFetch }), { wrapper: I18nTestProvider, initialProps: { folders: [folder] } });
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


test("changing locale preserves the selected virtual view and its protocol filters", async () => {
  let locale: UiLocale = "de";
  const wrapper = ({ children }: { children: ReactNode }) => <I18nTestProvider locale={locale}>{children}</I18nTestProvider>;
  const hook = renderHook(() => useSearchState({ activeAccountId: "synthetic", activeFolderId: "", setActiveFolderId: () => {}, accountFolders: [], folderById: new Map(), query: "", setQuery: () => {},
    isRelatedSearch: false, relatedRestoreRef: { current: null }, relatedQueryId: null, virtualDefaultExcludedFolderIdsKey: "", apiFetch: async () => Response.json({ total: 0 }) }), { wrapper });
  act(() => hook.result.current.actions.activateVirtualFolder("virtual:action-queue"));
  expect(hook.result.current.state.activeVirtualFolder?.name).toBe("Aufgaben");
  expect(hook.result.current.state.activeVirtualFolder?.badgeLabel).toBe("Markiert oder Aufgabe");
  locale = "en";
  hook.rerender();
  expect(hook.result.current.state.activeVirtualFolder?.name).toBe("Action Queue");
  expect(hook.result.current.state.activeVirtualFolder?.badgeLabel).toBe("Flagged or To-Do");
  expect(hook.result.current.state.activeVirtualFolder?.queryBadges).toEqual(["attention"]);
  expect(hook.result.current.state.activeVirtualFolderId).toBe("virtual:action-queue");
  expect(hook.result.current.state.searchScope).toBe("all");
});
