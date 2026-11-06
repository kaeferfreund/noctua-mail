import { afterEach, expect, test } from "bun:test";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { UiLocale } from "@/lib/i18n/config";
import type { ReactNode } from "react";
import { I18nTestProvider } from "@/lib/i18n/testRender";
import { useSearchState } from "./useSearchState";

afterEach(cleanup);
/** The counts route answers one total per `set` parameter, in order. */
const countsResponse = (url: string, total: (set: string) => number) =>
  Response.json({ ok: true, counts: new URL(url, "http://localhost").searchParams.getAll("set").map(total) });
test("summary owns all collaboration view counts; search never requests a listThreads message total", async () => {
  const calls: string[] = [];
  const apiFetch = async (url: string) => { calls.push(url); return countsResponse(url, () => 2); };
  const hook = renderHook(({ account, sync }) => useSearchState({ activeAccountId: account, activeFolderId: "", setActiveFolderId: () => {}, accountFolders: [], folderById: new Map(), query: "", setQuery: () => {},
    isRelatedSearch: false, relatedRestoreRef: { current: null }, relatedQueryId: null, virtualDefaultExcludedFolderIdsKey: "synthetic-trash", syncCompletionVersion: sync, apiFetch }), { wrapper: I18nTestProvider, initialProps: { account: "synthetic-a", sync: 0 } });
  await waitFor(() => expect(hook.result.current.state.focusedUnreadCount).toBe(2));
  // One counts-only request carries all five virtual-folder badge sets.
  expect(calls).toHaveLength(1);
  expect(calls[0].startsWith("/api/accounts/synthetic-a/messages/counts?")).toBe(true);
  expect(new URL(calls[0], "http://localhost").searchParams.getAll("set")).toEqual(["focused", "todo", "calendar", "calendar,unread", "suspicious,unread"]);
  expect(new URL(calls[0], "http://localhost").searchParams.get("excludeFolderIds")).toBe("synthetic-trash");
  hook.rerender({ account: "synthetic-b", sync: 1 });
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 200)); });
  expect(calls).toHaveLength(2);
  expect(calls.every(url => !url.includes("/threads?") && !url.includes("badges=open") && !url.includes("badges=unassigned") && !url.includes("assigned-to-me"))).toBe(true);
});

test("QA-101 virtual unread counts follow authoritative folder counts without a full sync", async () => {
  let unread = 110;
  const calls: string[] = [];
  const apiFetch = async (url: string) => { calls.push(url); return countsResponse(url, () => unread); };
  const folder = { id: "synthetic:INBOX", accountId: "synthetic", name: "INBOX", count: 300, unreadCount: 110 };
  const hook = renderHook(({ folders }) => useSearchState({ activeAccountId: "synthetic", activeFolderId: folder.id, setActiveFolderId: () => {}, accountFolders: folders, folderById: new Map(folders.map(item => [item.id, item])), query: "", setQuery: () => {},
    isRelatedSearch: false, relatedRestoreRef: { current: null }, relatedQueryId: null, virtualDefaultExcludedFolderIdsKey: "", syncCompletionVersion: 0, apiFetch }), { wrapper: I18nTestProvider, initialProps: { folders: [folder] } });
  await waitFor(() => expect(hook.result.current.state.focusedUnreadCount).toBe(110));
  for (const next of [109, 110, 111]) {
    unread = next;
    hook.rerender({ folders: [{ ...folder, unreadCount: next }] });
    await waitFor(() => expect(hook.result.current.state.focusedUnreadCount).toBe(next));
  }
  expect(calls).toHaveLength(4);
  // Re-delivering the same absolute counts should not issue another read.
  hook.rerender({ folders: [{ ...folder, unreadCount: 111 }] });
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 200)); });
  expect(calls).toHaveLength(4);
});


test("changing locale preserves the selected virtual view and its protocol filters", async () => {
  let locale: UiLocale = "de";
  const wrapper = ({ children }: { children: ReactNode }) => <I18nTestProvider locale={locale}>{children}</I18nTestProvider>;
  const hook = renderHook(() => useSearchState({ activeAccountId: "synthetic", activeFolderId: "", setActiveFolderId: () => {}, accountFolders: [], folderById: new Map(), query: "", setQuery: () => {},
    isRelatedSearch: false, relatedRestoreRef: { current: null }, relatedQueryId: null, virtualDefaultExcludedFolderIdsKey: "", apiFetch: async (url: string) => countsResponse(url, () => 0) }), { wrapper });
  act(() => hook.result.current.actions.activateVirtualFolder("virtual:action-queue"));
  expect(hook.result.current.state.activeVirtualFolder?.name).toBe("Markiert & Aufgaben");
  expect(hook.result.current.state.activeVirtualFolder?.badgeLabel).toBe("Markiert oder Aufgabe");
  locale = "en";
  hook.rerender();
  expect(hook.result.current.state.activeVirtualFolder?.name).toBe("Action Queue");
  expect(hook.result.current.state.activeVirtualFolder?.badgeLabel).toBe("Flagged or To-Do");
  expect(hook.result.current.state.activeVirtualFolder?.queryBadges).toEqual(["attention"]);
  expect(hook.result.current.state.activeVirtualFolderId).toBe("virtual:action-queue");
  expect(hook.result.current.state.searchScope).toBe("all");
});

test("one mailbox's virtual-folder counts never show under another", async () => {
  const held: Array<{ url: string; resolve: (res: Response) => void }> = [];
  const apiFetch = (url: string) => new Promise<Response>(resolve => { held.push({ url, resolve }); });
  const releaseAll = async (total: (url: string) => number) => {
    await act(async () => { for (const item of held.splice(0)) item.resolve(countsResponse(item.url, () => total(item.url))); });
  };
  const hook = renderHook(({ account }) => useSearchState({ activeAccountId: account, activeFolderId: "", setActiveFolderId: () => {}, accountFolders: [], folderById: new Map(), query: "", setQuery: () => {},
    isRelatedSearch: false, relatedRestoreRef: { current: null }, relatedQueryId: null, virtualDefaultExcludedFolderIdsKey: "", syncCompletionVersion: 0, apiFetch }), { wrapper: I18nTestProvider, initialProps: { account: "synthetic-a" } });
  await waitFor(() => expect(held).toHaveLength(1));
  await releaseAll(() => 7);
  await waitFor(() => expect(hook.result.current.state.focusedUnreadCount).toBe(7));
  hook.rerender({ account: "synthetic-b" });
  // Unknown until B's own counts arrive, not A's 7.
  const counts = () => { const { focusedUnreadCount, actionQueueTodoCount, inviteDeckTotalCount, inviteDeckUnreadCount } = hook.result.current.state;
    return [focusedUnreadCount, actionQueueTodoCount, inviteDeckTotalCount, inviteDeckUnreadCount]; };
  expect(counts()).toEqual([null, null, null, null]);
  await waitFor(() => expect(held).toHaveLength(1));
  expect(held.every(item => item.url.startsWith("/api/accounts/synthetic-b/"))).toBe(true);
  await releaseAll(() => 3);
  await waitFor(() => expect(counts()).toEqual([3, 3, 3, 3]));
  hook.rerender({ account: "" });
  expect(counts()).toEqual([null, null, null, null]);
});

test("the Verdächtig view counts unread suspicious mail and filters by the suspicious badge", async () => {
  const calls: string[] = [];
  const apiFetch = async (url: string) => { calls.push(url); return countsResponse(url, set => set === "suspicious,unread" ? 4 : 0); };
  const wrapper = ({ children }: { children: ReactNode }) => <I18nTestProvider locale="de">{children}</I18nTestProvider>;
  const hook = renderHook(() => useSearchState({ activeAccountId: "synthetic", activeFolderId: "", setActiveFolderId: () => {}, accountFolders: [], folderById: new Map(), query: "", setQuery: () => {},
    isRelatedSearch: false, relatedRestoreRef: { current: null }, relatedQueryId: null, virtualDefaultExcludedFolderIdsKey: "synthetic-trash", apiFetch }), { wrapper });
  await waitFor(() => expect(hook.result.current.state.suspiciousUnreadCount).toBe(4));
  expect(calls.some(url => new URL(url, "http://localhost").searchParams.getAll("set").includes("suspicious,unread"))).toBe(true);
  act(() => hook.result.current.actions.activateVirtualFolder("virtual:suspicious"));
  expect(hook.result.current.state.activeVirtualFolder).toMatchObject({ name: "Verdächtig", queryBadges: ["suspicious"] });
});
