import { afterEach, expect, it } from "bun:test";
import { createRef, useImperativeHandle } from "react";
import { act, cleanup, render, renderHook, waitFor } from "@testing-library/react";
import { useThreadCollab, type ThreadCollabController } from "./useThreadCollab";
import type { ThreadCollabState, ThreadComment } from "@/app/components/collab/types";

const state: ThreadCollabState = {
  accountId: "a", threadId: "one", status: "open", assigneeUserId: null,
  assignedByUserId: null, assignedAt: null, statusChangedAt: null,
  statusChangedByUserId: null, commentCount: 0, lastActivityAt: 1,
  updatedAt: 1, updatedByUserId: null,
};
const members = [{ userId: "synthetic-editor", name: "Synthetic Editor", email: "editor@example.test", role: "editor", isOwner: false }];
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
      if (String(url).endsWith("/me")) return json({ user: { id: "synthetic-editor" } });
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
    if (String(url).endsWith("/me")) return json({ user: { id: "synthetic-editor" } });
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
    if (String(url).endsWith("/me")) return json({ user: { id: "synthetic-editor" } });
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
    if (String(url).endsWith("/me")) return json({ user: { id: "synthetic-editor" } });
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

const note = (id: string, time: number): ThreadComment => ({ id, accountId: "a", threadId: "one", authorUserId: "synthetic-editor", body: `Synthetic note ${id}`, createdAt: time, updatedAt: time, deletedAt: null });
const ownNote = note("own-note", 2);
const otherNote = { ...note("newer-collaborator-note", 3), authorUserId: "synthetic-collaborator" };
const getResponse = (state: ThreadCollabState, comments: ThreadComment[] = []) => json({ ok: true, state, comments, activity: [], members });

type Kind = "status" | "assignee" | "comment";
async function mutationRaceHarness(kind: Kind, readVersion = 3) {
  const mutation = deferred<Response>();
  const reads: Array<ReturnType<typeof deferred<Response>>> = [];
  const updates: ThreadCollabState[] = [];
  const controller = createRef<ThreadCollabController>();
  let writes = 0;
  const apiFetch = (async (url: RequestInfo | URL, init?: RequestInit) => {
    if (String(url).endsWith("/me")) return json({ user: { id: "synthetic-editor" } });
    if (String(url).endsWith("/members")) return json({ members });
    if (init?.method) { writes++; return mutation.promise; }
    const read = deferred<Response>(); reads.push(read); return read.promise;
  }) as typeof fetch;
  function Probe() {
    const collab = useThreadCollab("a", "one", { apiFetch, sessionKey: "s1", onUpdate: s => updates.push(s) });
    useImperativeHandle(controller, () => collab);
    return <output data-testid="visible-state">{JSON.stringify({ state: collab.state, comments: collab.comments })}</output>;
  }
  const view = render(<Probe />);
  await waitFor(() => expect(reads).toHaveLength(1));
  await act(async () => { reads[0].resolve(getResponse(state)); });
  let result!: Promise<boolean>;
  await act(async () => {
    result = kind === "status" ? controller.current!.update({ status: "closed" })
      : kind === "assignee" ? controller.current!.update({ assigneeUserId: "synthetic-editor" })
      : controller.current!.addNote(ownNote.body);
  });
  expect(writes).toBe(1);
  const older = { ...state, updatedAt: 2, lastActivityAt: 2,
    ...(kind === "status" ? { status: "closed" as const } : kind === "assignee" ? { assigneeUserId: "synthetic-editor" } : { commentCount: 1 }),
  };
  // Mutation commits at t2; collaborator updates at t3; GET starts after mutation and observes t3.
  // The mutation response can be delayed independently of server commit order.
  const newer = { ...older, updatedAt: readVersion, lastActivityAt: readVersion,
    ...(kind === "status" ? { status: "waiting" as const } : kind === "assignee" ? { assigneeUserId: "synthetic-collaborator" } : { commentCount: readVersion < 2 ? 1 : 2 }),
  };
  const newerComments = kind === "comment"
    ? readVersion < 2 ? [{ ...otherNote, createdAt: readVersion, updatedAt: readVersion }] : [ownNote, otherNote]
    : [];
  let refresh!: Promise<void>;
  await act(async () => { refresh = controller.current!.reload(); });
  expect(reads).toHaveLength(2);
  await act(async () => { reads[1].resolve(getResponse(newer, newerComments)); await refresh; });
  const visible = () => JSON.parse(view.getByTestId("visible-state").textContent!);
  expect(visible()).toEqual({ state: newer, comments: newerComments });
  return { mutation, reads, updates, result, older, newer, newerComments, visible, current: () => controller.current! };
}

for (const kind of ["status", "assignee", "comment"] as const) {
  it(`R4-race: late ${kind} mutation success must preserve newer GET when post-commit refresh fails`, async () => {
    const h = await mutationRaceHarness(kind);
    await act(async () => { h.mutation.resolve(json({ ok: true, state: h.older, ...(kind === "comment" ? { comment: ownNote } : {}) })); });
    await waitFor(() => expect(h.reads).toHaveLength(3));
    const beforeRefresh = h.visible();
    await act(async () => { h.reads[2].resolve(json({ message: "Synthetic refresh failure" }, 500)); expect(await h.result).toBe(true); });
    expect(h.current().pending).toBe(false);
    expect(beforeRefresh).toEqual({ state: h.newer, comments: h.newerComments });
    expect(h.visible()).toEqual({ state: h.newer, comments: h.newerComments });
    expect(h.updates.at(-1)?.updatedAt).toBe(3);
  });

  for (const failure of ["HTTP 500", "network"] as const) {
    it(`R4-race: late ${kind} mutation failure (${failure}) must not roll back a newer successful GET`, async () => {
      const h = await mutationRaceHarness(kind);
      await act(async () => {
        if (failure === "network") h.mutation.reject(new Error("Synthetic mutation network failure"));
        else h.mutation.resolve(json({ message: "Synthetic mutation failure" }, 500));
        expect(await h.result).toBe(false);
      });
      expect(h.current().pending).toBe(false);
      expect(h.current().error).toBe(failure === "network" ? "Synthetic mutation network failure" : "Synthetic mutation failure");
      expect(h.reads).toHaveLength(2); // failure path does not schedule recovery
      expect(h.visible()).toEqual({ state: h.newer, comments: h.newerComments });
      expect(h.updates.at(-1)?.updatedAt).toBe(3);
    });
  }
}

it("R4-race: successful post-commit GET preserves the newer status without a stale publication", async () => {
  const h = await mutationRaceHarness("status");
  await act(async () => { h.mutation.resolve(json({ ok: true, state: h.older })); });
  await waitFor(() => expect(h.reads).toHaveLength(3));
  expect(h.visible().state).toEqual(h.newer);
  await act(async () => { h.reads[2].resolve(getResponse(h.newer)); expect(await h.result).toBe(true); });
  expect(h.visible().state).toEqual(h.newer);
  expect(h.updates.slice(-2).map(s => s.updatedAt)).toEqual([3, 3]);
});

for (const includesOwnNote of [false, true]) {
  it(`R4-order: a newer committed note reconciles current comments (${includesOwnNote ? "deduplicates its id" : "preserves collaborator notes"})`, async () => {
    const h = await mutationRaceHarness("comment", includesOwnNote ? 2 : 1);
    const committed = { ...h.older, commentCount: 2, updatedAt: 4, lastActivityAt: 4 };
    await act(async () => { h.mutation.resolve(json({ ok: true, state: committed, comment: ownNote })); });
    await waitFor(() => expect(h.reads).toHaveLength(3));
    await act(async () => { h.reads[2].resolve(json({ message: "Synthetic refresh failure" }, 500)); expect(await h.result).toBe(true); });
    expect(h.current().state).toEqual(committed);
    expect(h.current().comments).toHaveLength(2);
    expect(new Set(h.current().comments.map(comment => comment.id))).toEqual(new Set([ownNote.id, otherNote.id]));
    expect(h.current().comments.find(comment => comment.id === otherNote.id)).toEqual(h.newerComments.find(comment => comment.id === otherNote.id));
  });
}

it("R4-order: a newer accepted GET wins a mutation success tie in server timestamps", async () => {
  const h = await mutationRaceHarness("status", 2);
  await act(async () => { h.mutation.resolve(json({ ok: true, state: h.older })); });
  await waitFor(() => expect(h.reads).toHaveLength(3));
  await act(async () => { h.reads[2].resolve(json({ message: "Synthetic refresh failure" }, 500)); expect(await h.result).toBe(true); });
  expect(h.current().state).toEqual(h.newer);
  expect(h.updates.at(-1)).toEqual(h.newer);
});

for (const startsBeforeMutation of [false, true]) {
  it(`R4-order: a GET started ${startsBeforeMutation ? "before the optimistic write" : "before commit acceptance"} cannot overwrite its newer committed snapshot`, async () => {
    const mutation = deferred<Response>();
    const read = deferred<Response>();
    const postCommitRead = deferred<Response>();
    let reads = 0;
    const apiFetch = (async (url: RequestInfo | URL, init?: RequestInit) => {
      if (String(url).endsWith("/me")) return json({ user: { id: "synthetic-editor" } });
      if (String(url).endsWith("/members")) return json({ members });
      if (init?.method) return mutation.promise;
      return ++reads === 1 ? getResponse(state) : reads === 2 ? read.promise : postCommitRead.promise;
    }) as typeof fetch;
    const updates: ThreadCollabState[] = [];
    const hook = renderHook(() => useThreadCollab("a", "one", { apiFetch, onUpdate: value => updates.push(value) }));
    await waitFor(() => expect(hook.result.current.state).toEqual(state));
    let reload!: Promise<void>;
    let result!: Promise<boolean>;
    await act(async () => {
      if (startsBeforeMutation) reload = hook.result.current.reload();
      result = hook.result.current.update({ status: "closed" });
      if (!startsBeforeMutation) reload = hook.result.current.reload();
    });
    const committed = { ...state, status: "closed" as const, updatedAt: 2 };
    await act(async () => {
      mutation.resolve(json({ ok: true, state: committed }));
    });
    await waitFor(() => expect(reads).toBe(3));
    await act(async () => {
      postCommitRead.resolve(json({ message: "Synthetic refresh failure" }, 500));
      expect(await result).toBe(true);
      read.resolve(getResponse(state));
      await reload;
    });
    expect(hook.result.current.state).toEqual(committed);
    expect(updates.at(-1)).toEqual(committed);
  });
}

it("R4-order: a post-commit GET cannot regress an accepted server timestamp", async () => {
  const h = await mutationRaceHarness("status");
  const committed = { ...h.older, updatedAt: 4, lastActivityAt: 4 };
  await act(async () => { h.mutation.resolve(json({ ok: true, state: committed })); });
  await waitFor(() => expect(h.reads).toHaveLength(3));
  await act(async () => { h.reads[2].resolve(getResponse(h.newer)); expect(await h.result).toBe(true); });
  expect(h.current().state).toEqual(committed);
  expect(h.updates.at(-1)).toEqual(committed);
});

it("R4-order: a newer committed deletion removes its note from the current GET without dropping collaborator notes", async () => {
  const mutation = deferred<Response>();
  let reads = 0;
  const apiFetch = (async (url: RequestInfo | URL, init?: RequestInit) => {
    if (String(url).endsWith("/me")) return json({ user: { id: "synthetic-editor" } });
    if (String(url).endsWith("/members")) return json({ members });
    if (init?.method) return mutation.promise;
    if (++reads === 1) return getResponse({ ...state, commentCount: 1 }, [ownNote]);
    if (reads === 2) return getResponse({ ...state, updatedAt: 3, commentCount: 2 }, [ownNote, otherNote]);
    return json({ message: "Synthetic refresh failure" }, 500);
  }) as typeof fetch;
  const hook = renderHook(() => useThreadCollab("a", "one", { apiFetch }));
  await waitFor(() => expect(hook.result.current.comments).toEqual([ownNote]));
  let result!: Promise<boolean>;
  await act(async () => { result = hook.result.current.deleteNote(ownNote.id); });
  await act(async () => { await hook.result.current.reload(); });
  expect(hook.result.current.comments).toEqual([ownNote, otherNote]);
  const committed = { ...state, updatedAt: 4, commentCount: 1 };
  await act(async () => { mutation.resolve(json({ ok: true, state: committed })); expect(await result).toBe(true); });
  expect(hook.result.current.state).toEqual(committed);
  expect(hook.result.current.comments).toEqual([otherNote]);
});

const accountSnapshot = (accountId = "a", threadId = "one") => json({
  ok: true, state: { ...state, accountId, threadId }, members, comments: [], activity: [],
});
const forbidden = () => json({ message: "Synthetic mailbox denial" }, 403);
function denialHarness() {
  const reads: Array<ReturnType<typeof deferred<Response>>> = [];
  const denials: string[] = [];
  const apiFetch = (async (url: RequestInfo | URL) => {
    if (String(url).endsWith("/me")) return json({ user: { id: "synthetic-editor" } });
    if (String(url).endsWith("/members")) return json({ members });
    const read = deferred<Response>();
    reads.push(read);
    return read.promise;
  }) as typeof fetch;
  const hook = renderHook(({ account, thread, session }) => useThreadCollab(account, thread, {
    apiFetch, sessionKey: session, onReadDenied: account => denials.push(account),
  }), { initialProps: { account: "a", thread: "one", session: "s1" } });
  const resolve = async (index: number, response: Response) => {
    await waitFor(() => expect(reads.length).toBeGreaterThan(index));
    await act(async () => { reads[index].resolve(response); });
  };
  const reload = async () => { await act(async () => { void hook.result.current.reload().catch(() => {}); }); };
  const denied = () => {
    expect(hook.result.current.readDenied).toBe(true);
    expect(hook.result.current.state).toBeUndefined();
    expect(hook.result.current.members).toEqual([]);
  };
  return { hook, reads, denials, resolve, reload, denied };
}

it("R4-denial: newer pending DIFFERENT thread success restores the denied account scope", async () => {
  const h = denialHarness();
  await h.resolve(0, accountSnapshot());
  await h.reload();
  h.hook.rerender({ account: "a", thread: "two", session: "s1" });
  await waitFor(() => expect(h.reads).toHaveLength(3));
  await h.resolve(1, forbidden());
  h.denied();
  expect(await h.hook.result.current.update({ status: "closed" })).toBe(false);
  await h.resolve(2, accountSnapshot("a", "two"));
  expect(h.hook.result.current.readDenied).toBe(false);
  expect(h.hook.result.current.state?.threadId).toBe("two");
  expect(h.hook.result.current.members).toEqual(members);
  expect(h.denials).toEqual(["a"]);
  h.hook.rerender({ account: "a", thread: "one", session: "s1" });
  expect(h.hook.result.current.readDenied).toBe(false);
  expect(h.hook.result.current.state).toBeUndefined(); // revoked cache was purged
  await h.resolve(3, accountSnapshot());
});

for (const denialFirst of [true, false]) {
  it(`R4-denial: account B success cannot lift A denial (${denialFirst ? "denial before B success" : "denial after B success"})`, async () => {
    const h = denialHarness();
    await h.resolve(0, accountSnapshot());
    await h.reload();
    if (denialFirst) { await h.resolve(1, forbidden()); h.denied(); }
    h.hook.rerender({ account: "b", thread: "one", session: "s1" });
    await h.resolve(2, accountSnapshot("b"));
    if (!denialFirst) await h.resolve(1, forbidden());
    expect(h.hook.result.current.readDenied).toBe(false);
    expect(h.hook.result.current.state?.accountId).toBe("b");
    expect(h.hook.result.current.members).toEqual(members);
    h.hook.rerender({ account: "a", thread: "one", session: "s1" });
    h.denied();
    expect(h.denials).toEqual(["a"]);
    await h.resolve(3, accountSnapshot());
    expect(h.hook.result.current.readDenied).toBe(false);
  });
}

it("R4-denial: session change between denial and success rejects old success and retains old-scope denial", async () => {
  const h = denialHarness();
  await h.resolve(0, forbidden());
  h.denied();
  await h.reload(); // s1 recovery pending
  h.hook.rerender({ account: "a", thread: "one", session: "s2" });
  await waitFor(() => expect(h.reads).toHaveLength(3));
  await h.resolve(1, accountSnapshot()); // stale s1 recovery cannot populate s2
  expect(h.hook.result.current.readDenied).toBe(false);
  expect(h.hook.result.current.state).toBeUndefined();
  await h.resolve(2, accountSnapshot());
  expect(h.hook.result.current.state?.threadId).toBe("one");
  h.hook.rerender({ account: "a", thread: "one", session: "s1" });
  h.denied(); // s2 success must not lift s1 denial
  await h.resolve(3, accountSnapshot());
  expect(h.hook.result.current.readDenied).toBe(false);
  expect(h.denials).toEqual(["a"]);
});

it("R4-denial: a previous session denial arriving after current-session success is ignored", async () => {
  const h = denialHarness();
  h.hook.rerender({ account: "a", thread: "one", session: "s2" });
  await h.resolve(1, accountSnapshot());
  await h.resolve(0, forbidden());
  expect(h.hook.result.current.readDenied).toBe(false);
  expect(h.hook.result.current.state?.threadId).toBe("one");
  expect(h.denials).toEqual([]);
});

it("R4-denial: two denials interleaved with accepted success require a second recovery", async () => {
  const h = denialHarness();
  await h.reload(); // newer read will succeed
  await h.resolve(0, forbidden());
  h.denied();
  await h.resolve(1, accountSnapshot());
  expect(h.hook.result.current.readDenied).toBe(false);
  await h.reload();
  await h.resolve(2, forbidden());
  h.denied();
  expect(h.denials).toEqual(["a", "a"]);
  await h.reload();
  await h.resolve(3, accountSnapshot());
  expect(h.hook.result.current.readDenied).toBe(false);
});

for (const order of [[0, 1, 2], [2, 1, 0], [1, 0, 2]]) {
  it(`R4-denial: D1/S2/D3 response order ${order.join("-")} cannot let older success erase newer denial`, async () => {
    const h = denialHarness();
    await h.reload();
    await h.reload();
    for (const i of order) await h.resolve(i, i === 1 ? accountSnapshot() : forbidden());
    h.denied();
    expect(h.denials.length).toBeGreaterThan(0);
    await h.reload();
    await h.resolve(3, accountSnapshot());
    expect(h.hook.result.current.readDenied).toBe(false);
    expect(h.hook.result.current.state?.threadId).toBe("one");
  });
}
