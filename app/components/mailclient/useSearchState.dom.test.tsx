import { afterEach, expect, test } from "bun:test";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { useSearchState } from "./useSearchState";

afterEach(cleanup);
test("slice2b counts: summary owns assigned/unassigned; Open uses distinct whole-mailbox threads and clears on switch", async () => {
  const calls: string[] = [];
  const pending: Array<() => void> = [];
  const apiFetch = async (url: string) => {
    calls.push(url);
    if (url.includes("synthetic-b")) await new Promise<void>(resolve => pending.push(resolve));
    return Response.json({ total: url.includes("/threads?") ? 7 : 2 });
  };
  const hook = renderHook(({ account, revision }) => useSearchState({ activeAccountId: account, activeFolderId: "", setActiveFolderId: () => {}, accountFolders: [], folderById: new Map(), query: "", setQuery: () => {},
    isRelatedSearch: false, relatedRestoreRef: { current: null }, relatedQueryId: null, virtualDefaultExcludedFolderIdsKey: "synthetic-trash", collabRevision: revision, apiFetch }), { initialProps: { account: "synthetic-a", revision: 0 } });
  await waitFor(() => expect(hook.result.current.state.collabCounts).toEqual({ "virtual:open": 7 }));
  expect(calls).toHaveLength(5);
  const open = new URL(calls.find(url => url.includes("/threads?"))!, "http://example.test");
  expect(open.searchParams.get("badges")).toBe("open");
  expect(open.searchParams.get("excludeFolderIds")).toBe("");
  expect(calls.some(url => url.includes("assigned-to-me") || url.includes("badges=unassigned"))).toBe(false);
  hook.rerender({ account: "synthetic-a", revision: 1 });
  await waitFor(() => expect(calls).toHaveLength(6));
  expect(calls[5]).toContain("/threads?");
  hook.rerender({ account: "synthetic-b", revision: 1 });
  expect(hook.result.current.state.collabCounts).toEqual({});
  await waitFor(() => expect(pending).toHaveLength(5));
  await act(async () => pending.forEach(resolve => resolve()));
  expect(hook.result.current.state.collabCounts).toEqual({ "virtual:open": 7 });
});
