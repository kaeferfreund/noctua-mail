import { afterEach, expect, it } from "bun:test";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { useThreadCollab } from "./useThreadCollab";
import type { ThreadCollabState } from "@/app/components/collab/types";

const state: ThreadCollabState = {
  accountId: "a", threadId: "one", status: "open", assigneeUserId: null,
  assignedByUserId: null, assignedAt: null, statusChangedAt: null,
  statusChangedByUserId: null, commentCount: 0, lastActivityAt: 1,
  updatedAt: 1, updatedByUserId: null,
};
const members = [{ userId: "alex", name: "Alex Example", email: "alex@example.test", role: "editor", isOwner: false }];
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { "Content-Type": "application/json" },
});
const snapshot = (threadId: string) => json({
  ok: true, state: { ...state, threadId }, members, comments: [], activity: [],
});
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}
afterEach(cleanup);

for (const sameThread of [false, true]) {
  it(`ignores an obsolete denied GET after a newer successful ${sameThread ? "reload" : "thread read"}`, async () => {
    let oldDenied!: (response: Response) => void;
    let reads = 0;
    const denials: string[] = [];
    const apiFetch = (async (url: RequestInfo | URL) => {
      if (String(url).endsWith("/me")) return json({ user: { id: "alex" } });
      if (String(url).endsWith("/members")) return json({ members });
      if (reads++ === 0) return new Promise<Response>(resolve => { oldDenied = resolve; });
      return json({ ok: true, state: { ...state, threadId: sameThread ? "one" : "two" }, members, comments: [], activity: [] });
    }) as typeof fetch;
    const hook = renderHook(({ thread }) => useThreadCollab("a", thread, { apiFetch, onReadDenied: account => denials.push(account) }), { initialProps: { thread: "one" } });
    await waitFor(() => expect(oldDenied).toBeDefined());
    if (sameThread) await act(async () => { await hook.result.current.reload(); });
    else hook.rerender({ thread: "two" });
    await waitFor(() => expect(hook.result.current.state?.threadId).toBe(sameThread ? "one" : "two"));
    await act(async () => { oldDenied(json({ message: "Mailbox access was revoked" }, 403)); });
    expect(hook.result.current.readDenied).toBe(false);
    expect(hook.result.current.state?.threadId).toBe(sameThread ? "one" : "two");
    expect(hook.result.current.members).toEqual(members);
    expect(denials).toEqual([]);
  });
}

it("R2-3: a denial after TWO newer successful reads must not erase the latest state or members", async () => {
  const denied = deferred<Response>();
  let reads = 0;
  const denials: string[] = [];
  const apiFetch = (async (url: RequestInfo | URL) => {
    if (String(url).endsWith("/me")) return json({ user: { id: "alex" } });
    if (String(url).endsWith("/members")) return json({ members });
    if (++reads === 1) return denied.promise;
    const threadId = String(url).match(/threads\/([^/]+)/)![1];
    return snapshot(threadId);
  }) as typeof fetch;
  const hook = renderHook(({ thread }) => useThreadCollab("a", thread, {
    apiFetch, sessionKey: "session-1", onReadDenied: account => denials.push(account),
  }), { initialProps: { thread: "one" } });
  await waitFor(() => expect(reads).toBe(1));
  hook.rerender({ thread: "two" });
  await waitFor(() => expect(hook.result.current.state?.threadId).toBe("two"));
  hook.rerender({ thread: "three" });
  await waitFor(() => expect(hook.result.current.state?.threadId).toBe("three"));
  await act(async () => { denied.resolve(json({ message: "Synthetic obsolete denial" }, 403)); });
  expect(hook.result.current.readDenied).toBe(false);
  expect(hook.result.current.state?.threadId).toBe("three");
  expect(hook.result.current.members).toEqual(members);
  expect(denials).toEqual([]);
});

it("R2-3: a latest genuine denial still clears cached state and prevents mutations", async () => {
  let reads = 0;
  let mutations = 0;
  const denials: string[] = [];
  const apiFetch = (async (url: RequestInfo | URL, init?: RequestInit) => {
    if (String(url).endsWith("/me")) return json({ user: { id: "alex" } });
    if (String(url).endsWith("/members")) return json({ members });
    if (init?.method) mutations++;
    return ++reads === 1 ? snapshot("one") : json({ message: "Synthetic revoked access" }, 403);
  }) as typeof fetch;
  const hook = renderHook(() => useThreadCollab("a", "one", {
    apiFetch, onReadDenied: account => denials.push(account),
  }));
  await waitFor(() => expect(hook.result.current.state?.threadId).toBe("one"));
  await act(async () => { await hook.result.current.reload().catch(() => {}); });
  expect(hook.result.current.readDenied).toBe(true);
  expect(hook.result.current.state).toBeUndefined();
  expect(hook.result.current.members).toEqual([]);
  expect(denials).toEqual(["a"]);
  expect(await hook.result.current.update({ status: "closed" })).toBe(false);
  expect(mutations).toBe(0);
});

async function pendingRefreshAfterCachedRead() {
  const denied = deferred<Response>();
  const refresh = deferred<Response>();
  let reads = 0;
  const denials: string[] = [];
  const apiFetch = (async (url: RequestInfo | URL) => {
    if (String(url).endsWith("/me")) return json({ user: { id: "alex" } });
    if (String(url).endsWith("/members")) return json({ members });
    reads++;
    return reads === 1 ? snapshot("one") : reads === 2 ? denied.promise : refresh.promise;
  }) as typeof fetch;
  const hook = renderHook(({ thread }) => useThreadCollab("a", thread, {
    apiFetch, sessionKey: "session-1", onReadDenied: account => denials.push(account),
  }), { initialProps: { thread: "one" } });
  await waitFor(() => expect(hook.result.current.state?.threadId).toBe("one"));
  hook.rerender({ thread: "two" });
  await waitFor(() => expect(reads).toBe(2));
  hook.rerender({ thread: "one" });
  await waitFor(() => expect(reads).toBe(3));
  expect(hook.result.current.state?.threadId).toBe("one");
  expect(hook.result.current.members).toEqual(members);
  return { hook, denied, refresh, denials };
}

for (const failure of ["HTTP 500", "network"] as const) {
  it(`R2-new: a later failed refresh cannot supersede an authoritative access denial (${failure})`, async () => {
    const { hook, denied, refresh, denials } = await pendingRefreshAfterCachedRead();
    await act(async () => {
      if (failure === "network") refresh.reject(new Error("Synthetic transient network failure"));
      else refresh.resolve(json({ message: "Synthetic transient server failure" }, 500));
    });
    await waitFor(() => expect(hook.result.current.error).toBe(
      failure === "network" ? "Synthetic transient network failure" : "Synthetic transient server failure",
    ));
    await act(async () => { denied.resolve(json({ message: "Synthetic mailbox access revoked" }, 403)); });
    expect(hook.result.current.readDenied).toBe(true);
    expect(hook.result.current.state).toBeUndefined();
    expect(hook.result.current.members).toEqual([]);
    expect(denials).toEqual(["a"]);
    expect(await hook.result.current.update({ status: "closed" })).toBe(false);
  });
}

it("R3: a denial stays applied while a newer read is pending, then its success restores access", async () => {
  const { hook, denied, refresh, denials } = await pendingRefreshAfterCachedRead();
  await act(async () => { denied.resolve(json({ message: "Synthetic mailbox access revoked" }, 403)); });
  expect(hook.result.current.readDenied).toBe(true);
  expect(hook.result.current.state).toBeUndefined();
  expect(hook.result.current.members).toEqual([]);
  expect(denials).toEqual(["a"]);
  expect(await hook.result.current.update({ status: "closed" })).toBe(false);
  await act(async () => { refresh.resolve(snapshot("one")); });
  expect(hook.result.current.readDenied).toBe(false);
  expect(hook.result.current.state?.threadId).toBe("one");
  expect(hook.result.current.members).toEqual(members);
  expect(hook.result.current.error).toBeNull();
  expect(denials).toEqual(["a"]);
});
