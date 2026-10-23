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

// Regression cases from review r1, including equivalent folder refreshes.

const accountId = "synthetic-current";
const folderId = `${accountId}:INBOX`;
const currentFolders = (): Folder[] => [{id:folderId,accountId,name:"INBOX",count:0}];
for (const total of [0,2]) for (const refresh of [false,true]) test(`current account repair total=${total}, folder array refresh=${refresh}`, async () => {
 let resolve!: (r:Response)=>void;
 const pending=new Promise<Response>(r=>resolve=r);
 const actions:string[]=[];
 const apiFetch=async()=>pending;
 const initial=currentFolders();
 const {rerender}=renderHook(({accountFolders})=>useEmptyFolderRepair({accountId,folderId,accountFolders,enabled:true,apiFetch,
  attemptedFolderIdsRef:useRef(new Set()),recomputeThreadsRef:useRef(async()=>{actions.push("recompute")}),
  syncFolderRef:useRef(async()=>{actions.push("sync");return null;})}),{initialProps:{accountFolders:initial}});
 if(refresh) rerender({accountFolders:currentFolders()});
 await act(async()=>{resolve(Response.json({total}));await pending;});
 expect(actions).toEqual([total===0?"sync":"recompute"]);
});

for (const total of [0, 2]) test(`an ineligible check can retry, but a launched repair stays once-only (total=${total})`, async () => {
  const checks: Array<(response: Response) => void> = [];
  const actions: string[] = [];
  const apiFetch = async () => new Promise<Response>(resolve => { checks.push(resolve); });
  const { rerender } = renderHook(({ enabled }) => useEmptyFolderRepair({
    accountId, folderId, accountFolders: currentFolders(), enabled, apiFetch,
    attemptedFolderIdsRef: useRef(new Set<string>()),
    recomputeThreadsRef: useRef(async () => { actions.push("recompute"); }),
    syncFolderRef: useRef(async () => { actions.push("sync"); return null; })
  }), { initialProps: { enabled: true } });
  rerender({ enabled: false });
  await act(async () => { checks[0](Response.json({ total })); });
  expect(actions).toEqual([]);
  rerender({ enabled: true });
  expect(checks).toHaveLength(2);
  await act(async () => { checks[1](Response.json({ total })); });
  expect(actions).toEqual([total === 0 ? "sync" : "recompute"]);
  rerender({ enabled: false });
  rerender({ enabled: true });
  expect(checks).toHaveLength(2);
});
