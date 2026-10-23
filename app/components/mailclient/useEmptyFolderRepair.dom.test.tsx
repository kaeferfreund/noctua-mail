import { afterEach, expect, test } from "bun:test";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { useRef } from "react";
import type { Folder } from "@/lib/data";
import { useEmptyFolderRepair } from "./useEmptyFolderRepair";

afterEach(cleanup);
const folders = (accountId: string): Folder[] => [{ id: `${accountId}:INBOX`, accountId, name: "INBOX", count: 0 }];

for (const total of [0, 2]) test(`ignores a previous account's deferred empty-folder response (total=${total})`, async () => {
  let resolve!: (response: Response) => void;
  const pending = new Promise<Response>(done => { resolve = done; });
  const requests: string[] = [];
  const actions: string[] = [];
  const apiFetch = async (input: RequestInfo | URL) => { requests.push(String(input)); return pending; };
  const { rerender } = renderHook(({ accountId, folderId }) => {
    const attemptedFolderIdsRef = useRef(new Set<string>());
    const recomputeThreadsRef = useRef(async () => {});
    const syncFolderRef = useRef(async () => null);
    recomputeThreadsRef.current = async () => { actions.push(`recompute:${accountId}`); };
    syncFolderRef.current = async () => { actions.push(`sync:${accountId}:${folderId}`); return null; };
    useEmptyFolderRepair({ accountId, folderId, accountFolders: folders(accountId), enabled: accountId === "synthetic-a",
      apiFetch, attemptedFolderIdsRef, recomputeThreadsRef, syncFolderRef });
  }, { initialProps: { accountId: "synthetic-a", folderId: "synthetic-a:INBOX" } });
  await waitFor(() => expect(requests).toHaveLength(1));
  rerender({ accountId: "synthetic-b", folderId: "synthetic-a:INBOX" });
  await act(async () => { resolve(Response.json({ total })); });
  expect(actions).toEqual([]);
});

test("never checks an empty folder belonging to the previous account", async () => {
  const requests: string[] = [];
  renderHook(() => useEmptyFolderRepair({ accountId: "synthetic-b", folderId: "synthetic-a:INBOX",
    accountFolders: folders("synthetic-b"), enabled: true,
    apiFetch: async input => { requests.push(String(input)); return Response.json({ total: 0 }); },
    attemptedFolderIdsRef: useRef(new Set()), recomputeThreadsRef: useRef(async () => {}), syncFolderRef: useRef(async () => null)
  }));
  expect(requests).toEqual([]);
});
