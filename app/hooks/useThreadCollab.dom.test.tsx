import { afterEach, describe, expect, it } from "bun:test";
import { createRef, useImperativeHandle } from "react";
import { act, cleanup, render, renderHook, waitFor } from "@testing-library/react";
import { useThreadCollab, type ThreadCollabController } from "./useThreadCollab";
import type { CollabMember, ThreadCollabState, ThreadComment } from "@/app/components/collab/types";

const state: ThreadCollabState = {
  accountId: "a", threadId: "one", status: "open", assigneeUserId: null,
  assignedByUserId: null, assignedAt: null, statusChangedAt: null,
  statusChangedByUserId: null, commentCount: 0, lastActivityAt: 1,
  updatedAt: 1, updatedByUserId: null, revision: 0,
};
const members: CollabMember[] = [{ userId: "synthetic-editor", name: "Synthetic Editor", email: "editor@example.test", role: "editor", isOwner: false }];
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

const note = (id: string, time: number): ThreadComment => ({ id, accountId: "a", threadId: "one", authorUserId: "synthetic-editor", body: `Synthetic note ${id}`, createdAt: time, updatedAt: time, deletedAt: null, revision: time });
const ownNote = note("own-note", 2);
const otherNote = { ...note("newer-collaborator-note", 3), authorUserId: "synthetic-collaborator" };
const getResponse = (state: ThreadCollabState, comments: ThreadComment[] = []) => json({ ok: true, state, comments, activity: [], members });

type Kind = "status" | "assignee" | "comment";
async function mutationRaceHarness(kind: Kind, readVersion = 3, readRevision = readVersion) {
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
  const older = { ...state, updatedAt: 2, lastActivityAt: 2, revision: 2,
    ...(kind === "status" ? { status: "closed" as const } : kind === "assignee" ? { assigneeUserId: "synthetic-editor" } : { commentCount: 1 }),
  };
  // Mutation commits at t2; collaborator updates at t3; GET starts after mutation and observes t3.
  // The mutation response can be delayed independently of server commit order.
  const newer = { ...older, updatedAt: readVersion, lastActivityAt: readVersion, revision: readRevision,
    ...(kind === "status" ? { status: "waiting" as const } : kind === "assignee" ? { assigneeUserId: "synthetic-collaborator" } : { commentCount: readVersion < 2 ? 1 : 2 }),
  };
  const newerComments = kind === "comment"
    ? readVersion < 2 ? [{ ...otherNote, createdAt: readVersion, updatedAt: readVersion, revision: readRevision }] : [ownNote, otherNote]
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
    const h = await mutationRaceHarness("comment", includesOwnNote ? 3 : 1);
    const committed = { ...h.older, commentCount: 2, revision: 4, updatedAt: 4, lastActivityAt: 4 };
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
  const h = await mutationRaceHarness("status", 2, 3);
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
    const committed = { ...state, status: "closed" as const, revision: 2, updatedAt: 2 };
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

it("R4-order: a post-commit GET cannot regress an accepted server revision", async () => {
  const h = await mutationRaceHarness("status");
  const committed = { ...h.older, revision: 4, updatedAt: 4, lastActivityAt: 4 };
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
    if (reads === 2) return getResponse({ ...state, revision: 3, updatedAt: 3, commentCount: 2 }, [ownNote, otherNote]);
    return json({ message: "Synthetic refresh failure" }, 500);
  }) as typeof fetch;
  const hook = renderHook(() => useThreadCollab("a", "one", { apiFetch }));
  await waitFor(() => expect(hook.result.current.comments).toEqual([ownNote]));
  let result!: Promise<boolean>;
  await act(async () => { result = hook.result.current.deleteNote(ownNote.id); });
  await act(async () => { await hook.result.current.reload(); });
  expect(hook.result.current.comments).toEqual([ownNote, otherNote]);
  const committed = { ...state, revision: 4, updatedAt: 4, commentCount: 1 };
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


describe("R5 server revision regressions", () => {
const T = 1800000000000;
const members: CollabMember[] = [{ userId: 'synthetic-editor', name: 'Synthetic Editor', email: 'editor@example.test', role: 'editor', isOwner: false }];
const state = (patch: Partial<ThreadCollabState> = {}): ThreadCollabState => ({ accountId: 'a', threadId: 'X', status: 'open', assigneeUserId: null, assignedByUserId: null, assignedAt: null, statusChangedAt: null, statusChangedByUserId: null, commentCount: 0, lastActivityAt: T, updatedAt: T, updatedByUserId: null, revision: 1, ...patch });
const note = (body = 'Synthetic original', time = T, revision = 2): ThreadComment => ({ id: 'synthetic-note', accountId: 'a', threadId: 'X', authorUserId: 'synthetic-editor', body, createdAt: time, updatedAt: time, deletedAt: null, revision });
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
const snapshot = (s = state(), comments: ThreadComment[] = []) => json({ ok: true, state: s, comments, activity: [], members });
const failedRead = () => json({ message: 'Synthetic refresh failure' }, 500);
const forbidden = () => json({ message: 'Synthetic revoked access' }, 403);
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((r, j) => { resolve = r; reject = j; });
  return { promise, resolve, reject };
}
type Props = { account: string; thread: string; session: string };
function harness({ deferMembers = false } = {}) {
  const memberReads: Array<ReturnType<typeof deferred<Response>>> = [];
  const reads: Array<ReturnType<typeof deferred<Response>> & { url: string }> = [];
  const writes: Array<ReturnType<typeof deferred<Response>> & { url: string; init?: RequestInit }> = [];
  const updates: ThreadCollabState[] = [];
  const commits: string[] = [];
  const denials: string[] = [];
  const controller = createRef<ThreadCollabController>();
  let props: Props = { account: 'a', thread: 'X', session: 's1' };
  const apiFetch = (async (url: RequestInfo | URL, init?: RequestInit) => {
    if (String(url).endsWith('/me')) return json({ user: { id: 'synthetic-editor' } });
    if (String(url).endsWith('/members')) {
      if (!deferMembers) return json({ members });
      const read = deferred<Response>();
      memberReads.push(read);
      return read.promise;
    }
    const request = { ...deferred<Response>(), url: String(url), init };
    (init?.method ? writes : reads).push(request);
    return request.promise;
  }) as typeof fetch;
  function Probe(p: Props) {
    const current = useThreadCollab(p.account, p.thread, { apiFetch, sessionKey: p.session, onUpdate: s => updates.push(s), onCommit: a => commits.push(a), onReadDenied: a => denials.push(a) });
    useImperativeHandle(controller, () => current);
    return <output data-testid="snapshot">{JSON.stringify({ state: current.state, comments: current.comments, pending: current.pending, readDenied: current.readDenied, error: current.error })}</output>;
  }
  const view = render(<Probe {...props} />);
  const read = async (i: number, response: Response) => {
    await waitFor(() => expect(reads.length).toBeGreaterThan(i));
    await act(async () => { reads[i].resolve(response); });
  };
  const reload = async () => { await act(async () => { void controller.current!.reload().catch(() => {}); }); };
  const start = async (fn: (c: ThreadCollabController) => Promise<boolean>) => {
    let result!: Promise<boolean>;
    await act(async () => { result = fn(controller.current!); });
    return { result };
  };
  const navigate = (patch: Partial<Props>) => { props = { ...props, ...patch }; view.rerender(<Probe {...props} />); };
  const finish = async (i: number, response: Response, operation: { result: Promise<boolean> }, refresh?: Response) => {
    const n = reads.length;
    await act(async () => { writes[i].resolve(response); });
    if (refresh) await read(n, refresh);
    let result!: boolean;
    await act(async () => { result = await operation.result; });
    return result;
  };
  const visible = () => JSON.parse(view.getByTestId('snapshot').textContent!);
  return { reads, memberReads, writes, updates, commits, denials, read, reload, start, navigate, finish, visible, current: () => controller.current! };
}


for (const kind of ['status', 'add', 'delete'] as const) {
  it(`R5-tie: later ${kind} commit sharing GET timestamp survives failed post-commit refresh`, async () => {
    const h = harness();
    const before = state({ revision: kind === 'delete' ? 2 : 1, commentCount: kind === 'delete' ? 1 : 0 });
    const beforeComments = kind === 'delete' ? [note()] : [];
    await h.read(0, snapshot(before, beforeComments));
    const op = await h.start(c => kind === 'status' ? c.update({ status: 'closed' }) : kind === 'add' ? c.addNote(note().body) : c.deleteNote(note().id));
    // GET starts after the write request, reads BEFORE its server commit, and takes ownership.
    // Equal milliseconds are display data; a later revision must still win.
    await h.reload();
    await h.read(1, snapshot(before, beforeComments));
    const committed = state({ revision: kind === 'delete' ? 3 : 2, status: kind === 'status' ? 'closed' : 'open', commentCount: kind === 'add' ? 1 : 0 });
    expect(await h.finish(0, json({ ok: true, state: committed, ...(kind === 'add' ? { comment: note() } : {}) }), op, failedRead())).toBe(true);
    expect(h.visible().state).toEqual(committed);
    expect(h.visible().comments).toEqual(kind === 'add' ? [note()] : []);
  });
}

it('R5-tie control: same-second commits with distinct milliseconds accept the genuinely newer mutation', async () => {
  const h = harness();
  await h.read(0, snapshot());
  const op = await h.start(c => c.update({ status: 'closed' }));
  await h.reload(); await h.read(1, snapshot());
  const committed = state({ revision: 2, status: 'closed', updatedAt: T + 1 });
  expect(await h.finish(0, json({ ok: true, state: committed }), op, failedRead())).toBe(true);
  expect(h.visible().state).toEqual(committed);
});

it('R5-tie control: a successful post-commit equal-time GET confirms the same revision', async () => {
  const h = harness(); await h.read(0, snapshot());
  const op = await h.start(c => c.update({ status: 'closed' }));
  await h.reload(); await h.read(1, snapshot());
  const committed = state({ revision: 2, status: 'closed' });
  expect(await h.finish(0, json({ ok: true, state: committed }), op, snapshot(committed))).toBe(true);
  expect(h.visible().state).toEqual(committed);
});

it('R5-comment: add then edit in the same millisecond keeps the edited note from GET', async () => {
  const h = harness(); await h.read(0, snapshot());
  const op = await h.start(c => c.addNote(note().body));
  const edited = note('Synthetic edited in same millisecond', T, 3);
  await h.reload(); await h.read(1, snapshot(state({ revision: 3, commentCount: 1 }), [edited]));
  expect(await h.finish(0, json({ ok: true, state: state({ revision: 2, commentCount: 1 }), comment: note() }), op, failedRead())).toBe(true);
  expect(h.visible().comments).toEqual([edited]);
});

it('R5-comment: add then delete in the same millisecond does not resurrect the late POST note', async () => {
  const h = harness(); await h.read(0, snapshot());
  const op = await h.start(c => c.addNote(note().body));
  await h.reload(); await h.read(1, snapshot(state({ revision: 3 })));
  expect(await h.finish(0, json({ ok: true, state: state({ revision: 2, commentCount: 1 }), comment: note() }), op, failedRead())).toBe(true);
  expect(h.visible().comments).toEqual([]);
  expect(h.visible().state.commentCount).toBe(0);
});

it('R5-clock: newer committed mutation and its successful refresh survive a backwards server clock', async () => {
  const h = harness(); await h.read(0, snapshot());
  const op = await h.start(c => c.addNote('Synthetic new note after clock movement'));
  const committed = state({ revision: 2, commentCount: 1, updatedAt: T - 1000 });
  const committedNote = note('Synthetic new note after clock movement', T - 1000);
  expect(await h.finish(0, json({ ok: true, state: committed, comment: committedNote }), op, snapshot(committed, [committedNote]))).toBe(true);
  expect(h.visible().comments).toEqual([committedNote]);
  expect(h.visible().state).toEqual(committed);
});

it('R5-clock: a later authoritative GET after backwards clock movement is accepted', async () => {
  const h = harness(); await h.read(0, snapshot());
  const latest = state({ revision: 2, status: 'waiting', assigneeUserId: 'synthetic-editor', updatedAt: T - 1000 });
  await h.reload(); await h.read(1, snapshot(latest));
  await h.reload(); await h.read(2, snapshot(latest));
  expect(h.visible().state).toEqual(latest);
});

it('R5-owner: GET started before failed mutation but reading a later server snapshot is not discarded', async () => {
  const h = harness(); await h.read(0, snapshot());
  await h.reload(); // Request sent before mutation; query/response can run after collaborator commits.
  const op = await h.start(c => c.update({ status: 'closed' }));
  expect(await h.finish(0, json({ message: 'Synthetic mutation failure' }, 500), op)).toBe(false);
  const latest = state({ revision: 2, status: 'waiting', updatedAt: T + 10 });
  await h.read(1, snapshot(latest));
  expect(h.visible().state).toEqual(latest);
});

for (const delta of [0, 1]) {
  it(`R5-navigation: X mutation survives X to Y to X before response (commit delta ${delta}ms)`, async () => {
    const h = harness(); await h.read(0, snapshot());
    const op = await h.start(c => c.update({ status: 'closed' }));
    h.navigate({ thread: 'Y' }); await h.read(1, snapshot(state({ threadId: 'Y' })));
    h.navigate({ thread: 'X' }); await h.read(2, snapshot());
    const committed = state({ revision: 2, status: 'closed', updatedAt: T + delta });
    expect(await h.finish(0, json({ ok: true, state: committed }), op, failedRead())).toBe(true);
    expect(h.visible().state).toEqual(committed);
    expect(h.commits).toEqual(['a']);
  });
}

for (const scope of ['thread', 'account'] as const) {
  it(`R5-pending: overlapping ${scope} mutations keep pending on the originating key after navigation`, async () => {
    const h = harness(); await h.read(0, snapshot());
    const first = await h.start(c => c.update({ status: 'closed' }));
    const secondScope = scope === 'thread' ? { thread: 'Y' } : { account: 'b' };
    h.navigate(secondScope);
    await h.read(1, snapshot(state({ accountId: scope === 'account' ? 'b' : 'a', threadId: scope === 'thread' ? 'Y' : 'X' })));
    const second = await h.start(c => c.update({ assigneeUserId: 'synthetic-editor' }));
    expect(h.writes).toHaveLength(2);
    h.navigate({ account: 'a', thread: 'X' }); await h.read(2, snapshot());
    const pendingWhileFirstInFlight = h.current().pending;
    // Finish second first, offscreen; it must not hide the still-running first operation.
    expect(await h.finish(1, json({ ok: true, state: state({ revision: 2, accountId: scope === 'account' ? 'b' : 'a', threadId: scope === 'thread' ? 'Y' : 'X', assigneeUserId: 'synthetic-editor', updatedAt: T + 1 }) }), second)).toBe(true);
    const pendingAfterSecondFinishes = h.current().pending;
    const duplicate = await h.start(c => c.update({ assigneeUserId: 'synthetic-editor' }));
    expect(await duplicate.result).toBe(false); // busy still knows X is running.
    expect(h.writes).toHaveLength(2);
    const committed = state({ revision: 2, status: 'closed', updatedAt: T + 1 });
    expect(await h.finish(0, json({ ok: true, state: committed }), first, snapshot(committed))).toBe(true);
    expect(pendingWhileFirstInFlight).toBe(true);
    expect(pendingAfterSecondFinishes).toBe(true);
  });
}

it('R5-pending control: first key finalizer leaves second key pending', async () => {
  const h = harness(); await h.read(0, snapshot());
  const first = await h.start(c => c.update({ status: 'closed' }));
  h.navigate({ thread: 'Y' }); await h.read(1, snapshot(state({ threadId: 'Y' })));
  const second = await h.start(c => c.update({ assigneeUserId: 'synthetic-editor' }));
  expect(await h.finish(0, json({ ok: true, state: state({ revision: 2, status: 'closed', updatedAt: T + 1 }) }), first)).toBe(true);
  expect(h.current().pending).toBe(true);
  const committed = state({ revision: 2, threadId: 'Y', assigneeUserId: 'synthetic-editor', updatedAt: T + 2 });
  expect(await h.finish(1, json({ ok: true, state: committed }), second, snapshot(committed))).toBe(true);
  expect(h.current().pending).toBe(false);
});

it('R5-serialization: same-thread status then assignee cannot both reach server; second completes first', async () => {
  const h = harness(); await h.read(0, snapshot());
  const status = await h.start(c => c.update({ status: 'closed' }));
  const assignee = await h.start(c => c.update({ assigneeUserId: 'synthetic-editor' }));
  expect(await assignee.result).toBe(false);
  expect(h.writes).toHaveLength(1);
  expect(h.current().pending).toBe(true);
  const committed = state({ revision: 2, status: 'closed', updatedAt: T + 1 });
  expect(await h.finish(0, json({ ok: true, state: committed }), status, snapshot(committed))).toBe(true);
  expect(h.visible().state).toEqual(committed);
  const retry = await h.start(c => c.update({ assigneeUserId: 'synthetic-editor' }));
  const assigned = { ...committed, revision: 3, assigneeUserId: 'synthetic-editor', updatedAt: T + 2 };
  expect(await h.finish(1, json({ ok: true, state: assigned }), retry, snapshot(assigned))).toBe(true);
  expect(h.visible().state).toEqual(assigned);
});

for (const failure of ['HTTP 500', 'network'] as const) {
  it(`R5-denial: older 403 still purges after newer ${failure} while mutation is in flight`, async () => {
    const h = harness(); await h.read(0, snapshot());
    const op = await h.start(c => c.update({ status: 'closed' }));
    await h.reload(); await h.reload();
    if (failure === 'network') await act(async () => { h.reads[2].reject(new Error('Synthetic network failure')); });
    else await h.read(2, failedRead());
    await h.read(1, forbidden());
    expect(h.current().readDenied).toBe(true);
    expect(h.current().members).toEqual([]);
    const committed = state({ revision: 2, status: 'closed', updatedAt: T + 1 });
    expect(await h.finish(0, json({ ok: true, state: committed }), op, failedRead())).toBe(true);
    expect(h.current().readDenied).toBe(true);
    expect(h.current().state).toBeUndefined();
    expect(await h.current().update({ status: 'open' })).toBe(false);
    expect(h.writes).toHaveLength(1);
    expect(h.denials).toEqual(['a']);
  });
}

it('R5-denial: older 403 after newer accepted success cannot revoke account', async () => {
  const h = harness(); await h.read(0, snapshot());
  await h.reload(); await h.reload();
  await h.read(2, snapshot(state({ revision: 2, status: 'waiting', updatedAt: T + 1 })));
  await h.read(1, forbidden());
  expect(h.current().readDenied).toBe(false);
  expect(h.current().state?.status).toBe('waiting');
  expect(h.denials).toEqual([]);
});

it("R6-order: later-started equal-revision GET accepts identical or differing content", async () => {
  const h = harness();
  const baseline = state();
  await h.read(0, snapshot(baseline));
  await h.reload(); await h.read(1, snapshot(baseline));
  expect(h.updates).toHaveLength(2);
  await h.reload(); await h.read(2, snapshot(state({ status: "closed" })));
  expect(h.visible().state).toEqual(state({ status: "closed" }));
  expect(h.updates).toHaveLength(3);
});

it("R5-completion: same-revision GET completes a partial mutation response with earlier collaborator notes", async () => {
  const h = harness(); await h.read(0, snapshot());
  const op = await h.start(c => c.update({ status: "closed" }));
  const committed = state({ status: "closed", revision: 3, commentCount: 1 });
  // A collaborator added this at revision 2, after our initial read but before our commit.
  const collaboratorNote = note("Synthetic collaborator note", T, 2);
  expect(await h.finish(0, json({ ok: true, state: committed }), op, snapshot(committed, [collaboratorNote]))).toBe(true);
  expect(h.visible().state).toEqual(committed);
  expect(h.visible().comments).toEqual([collaboratorNote]);
});


it("R5-idempotence: a late same-revision mutation preserves complete GET authority", async () => {
  const h = harness(); await h.read(0, snapshot());
  const op = await h.start(c => c.update({ status: "closed" }));
  const committed = state({ status: "closed", revision: 3, commentCount: 1 });
  const existing = note("Synthetic existing note", T, 2);
  await h.reload(); await h.read(1, snapshot(committed, [existing]));
  expect(await h.finish(0, json({ ok: true, state: committed }), op, failedRead())).toBe(true);
  expect(h.visible().comments).toEqual([existing]);
  const refreshed = { ...existing, body: "Synthetic refreshed body" };
  await h.reload(); await h.read(3, snapshot(committed, [refreshed]));
  expect(h.visible().comments).toEqual([refreshed]);
});


it("R6-partial: later add preserves collaborator edit and deletion already accepted by GET when refresh fails", async () => {
  const h = harness();
  const original = { ...note("Synthetic original edit target", T, 1), id: "edit-target" };
  const removed = { ...note("Synthetic delete target", T, 2), id: "delete-target" };
  await h.read(0, snapshot(state({ revision: 2, commentCount: 2 }), [original, removed]));
  const op = await h.start(c => c.addNote("Synthetic added note"));
  const edited = { ...original, body: "Synthetic collaborator edited", revision: 3 };
  await h.reload(); await h.read(1, snapshot(state({ revision: 4, commentCount: 1 }), [edited]));
  const added = { ...note("Synthetic added note", T, 5), id: "own-added" };
  const committed = state({ revision: 5, commentCount: 2 });
  expect(await h.finish(0, json({ ok: true, state: committed, comment: added }), op, failedRead())).toBe(true);
  expect(h.current().comments).toEqual([edited, added]);
  expect(h.current().state).toEqual(committed);
  expect(h.current().error).toBeNull();
  expect(h.current().pending).toBe(false);
});

// Real service evidence for these lifecycle responses is in lib/threadCollab.revision.test.ts.
// Message presence controls comment/activity visibility but does not bump revision.
for (const direction of ["restore", "hide"] as const) it(`R6-lifecycle: equal-revision complete GET must ${direction} comments and activity when message presence changes`, async () => {
  const h = harness();
  const historical = state({ revision: 2, commentCount: 1 });
  const comment = note("Synthetic historical note", T, 2);
  const activity = [{ id: "synthetic-history", accountId: "a", threadId: "X", type: "comment_added", actorUserId: "synthetic-editor", actorClientId: "web:test", payload: { commentId: comment.id }, createdAt: T }];
  const full = () => json({ ok: true, state: historical, comments: [comment], activity, members });
  await h.read(0, direction === "restore" ? snapshot(historical) : full());
  await h.reload(); await h.read(1, direction === "restore" ? full() : snapshot(historical));
  expect(h.current().comments).toEqual(direction === "restore" ? [comment] : []);
  expect(h.current().activity).toEqual(direction === "restore" ? activity : []);
});

it("R6-lifecycle-activity: equal-revision complete GET must restore activity even without comments", async () => {
  const h = harness(); const historical = state({ revision: 2, status: "waiting" });
  const activity = [{ id: "synthetic-status-history", accountId: "a", threadId: "X", type: "status_changed", actorUserId: "synthetic-editor", actorClientId: "web:test", payload: { from: "open", to: "waiting" }, createdAt: T }];
  await h.read(0, snapshot(historical)); // Historical state while message-less.
  const restored = () => json({ ok: true, state: historical, comments: [], activity, members });
  await h.reload(); await h.read(1, restored());
  await h.reload(); await h.read(2, restored()); // A repeated latest-started read also preserves restored activity.
  expect(h.current().comments).toEqual([]);
  expect(h.current().activity).toEqual(activity);
});


for (const resolvesLast of ["earlier", "later"] as const) {
  it(`R6-order: latest-started equal-revision GET wins (${resolvesLast} resolves last)`, async () => {
    const h = harness(); await h.read(0, snapshot());
    const historical = state({ revision: 2, commentCount: 1 });
    const comment = note("Synthetic historical", T, 2);
    const activity = [{ id: "synthetic-history", accountId: "a", threadId: "X", type: "comment_added", actorUserId: "synthetic-editor", actorClientId: "web:test", payload: { commentId: comment.id }, createdAt: T }];
    const expanded = [...members, { ...members[0], userId: "synthetic-new", email: "new@example.test" }];
    await h.reload(); await h.reload();
    const earlier = () => snapshot(historical); // Message absent when this read ran.
    const later = () => json({ ok: true, state: historical, comments: [comment], activity, members: expanded });
    if (resolvesLast === "earlier") {
      await h.read(2, later());
      const published = h.updates.length;
      await h.read(1, earlier());
      expect(h.updates).toHaveLength(published);
    } else {
      await h.read(1, earlier()); await h.read(2, later());
    }
    expect(h.current().state).toEqual(historical);
    expect(h.current().comments).toEqual([comment]);
    expect(h.current().activity).toEqual(activity);
    expect(h.current().members).toEqual(expanded);
  });
}

it("R6-order: higher revision wins regardless of request start", async () => {
  const h = harness(); await h.read(0, snapshot());
  await h.reload(); await h.reload();
  const olderRevision = state({ revision: 2, status: "waiting" });
  const higherRevision = state({ revision: 3, status: "closed" });
  await h.read(2, snapshot(olderRevision));
  await h.read(1, snapshot(higherRevision)); // Earlier request, higher revision.
  expect(h.current().state).toEqual(higherRevision);
  const published = h.updates.length;
  await h.reload(); await h.read(3, snapshot(olderRevision));
  expect(h.current().state).toEqual(higherRevision);
  expect(h.updates).toHaveLength(published);
});

for (const conflicting of [false, true]) {
  it(`R6-partial: equal-revision success preserves complete lists and merges its comment (${conflicting ? "conflicting" : "missing"} comment)`, async () => {
    const h = harness(); await h.read(0, snapshot());
    const op = await h.start(c => c.addNote("Synthetic own"));
    const committed = state({ revision: 3, commentCount: 2 });
    const existing = { ...note("Synthetic collaborator", T, 2), id: "collaborator" };
    const own = note("Synthetic own", T, 3);
    const acceptedOwn = { ...own, body: "Synthetic accepted revision-3 body" };
    const activity = [{ id: "synthetic-history", accountId: "a", threadId: "X", type: "comment_added", actorUserId: "synthetic-editor", actorClientId: "web:test", payload: { commentId: own.id }, createdAt: T }];
    await h.reload(); // An earlier request must stay obsolete across partial acceptance.
    await h.reload();
    await h.read(2, json({ ok: true, state: committed, comments: conflicting ? [existing, acceptedOwn] : [existing], activity, members }));
    expect(await h.finish(0, json({ ok: true, state: committed, comment: own }), op, failedRead())).toBe(true);
    const expected = [existing, conflicting ? acceptedOwn : own];
    expect(h.current().comments).toEqual(expected);
    expect(h.current().activity).toEqual(activity);
    expect(h.current().error).toBeNull();
    const published = h.updates.length;
    await h.read(1, snapshot(committed));
    expect(h.current().comments).toEqual(expected);
    expect(h.current().activity).toEqual(activity);
    expect(h.updates).toHaveLength(published);
    // The partial response retained the last complete GET's start, not its own owner.
    await h.reload(); await h.read(4, snapshot(committed));
    expect(h.current().comments).toEqual([]);
    expect(h.current().activity).toEqual([]);
  });
}

it("R6-partial: equal-revision deletion keeps complete GET lists", async () => {
  const h = harness();
  const existing = note("Synthetic retained note", T, 1);
  await h.read(0, snapshot(state({ commentCount: 1 }), [existing]));
  const op = await h.start(c => c.deleteNote(existing.id));
  const committed = state({ revision: 2 });
  const activity = [{ id: "synthetic-history", accountId: "a", threadId: "X", type: "comment_deleted", actorUserId: "synthetic-editor", actorClientId: "web:test", payload: { commentId: existing.id }, createdAt: T }];
  await h.reload(); await h.read(1, json({ ok: true, state: committed, comments: [existing], activity, members }));
  expect(await h.finish(0, json({ ok: true, state: committed }), op, failedRead())).toBe(true);
  expect(h.current().comments).toEqual([existing]);
  expect(h.current().activity).toEqual(activity);
});

for (const contradiction of ["missing", "different"] as const) {
  it(`R6-completion: equal-revision GET cannot contradict its written comment (${contradiction})`, async () => {
    const h = harness(); await h.read(0, snapshot());
    const op = await h.start(c => c.addNote("Synthetic own"));
    const committed = state({ revision: 2, commentCount: 1 });
    const own = note("Synthetic own", T, 2);
    expect(await h.finish(0, json({ ok: true, state: committed, comment: own }), op,
      snapshot(committed, contradiction === "missing" ? [] : [{ ...own, body: "Synthetic contradiction" }]))).toBe(true);
    expect(h.current().comments).toEqual([own]);
    const earlier = { ...note("Synthetic earlier", T, 1), id: "earlier" };
    await h.reload(); await h.read(2, snapshot(committed, [earlier, own]));
    expect(h.current().comments).toEqual([earlier, own]);
    // Once completed, a later complete GET may reflect message disappearance.
    await h.reload(); await h.read(3, snapshot(committed));
    expect(h.current().comments).toEqual([]);
  });
}

it("R6-completion: equal-revision GET cannot contradict partial state", async () => {
  const h = harness(); await h.read(0, snapshot());
  const op = await h.start(c => c.update({ status: "closed" }));
  const committed = state({ revision: 2, status: "closed" });
  expect(await h.finish(0, json({ ok: true, state: committed }), op,
    snapshot({ ...committed, status: "waiting" }))).toBe(true);
  expect(h.current().state).toEqual(committed);
  await h.reload(); await h.read(2, snapshot(committed));
  expect(h.current().state).toEqual(committed);
});

for (const readWins of [false, true]) {
  it(`R6-rollback: only the owning optimistic snapshot rolls back (${readWins ? "GET owns" : "mutation owns"})`, async () => {
    const h = harness(); await h.read(0, snapshot());
    await h.reload(); // Read starts BEFORE the mutation and retains a lower owner.
    const op = await h.start(c => c.update({ status: "closed" }));
    if (readWins) await h.read(1, snapshot()); // Same revision takes ownership.
    const published = h.updates.length;
    expect(await h.finish(0, failedRead(), op)).toBe(false);
    expect(h.current().state).toEqual(state());
    expect(h.updates).toHaveLength(published + (readWins ? 0 : 1));
    expect(h.current().pending).toBe(false);
    if (!readWins) await h.read(1, snapshot());
  });
}

it("R6-scope: session/account/thread isolation", async () => {
  const h = harness(); await h.read(0, snapshot(state({ status: "closed" })));
  await h.reload();
  h.navigate({ thread: "Y" });
  expect(h.current().state).toBeUndefined();
  await h.read(2, snapshot(state({ threadId: "Y", status: "waiting" })));
  h.navigate({ account: "b", thread: "X" });
  expect(h.current().state).toBeUndefined();
  await h.read(3, snapshot(state({ accountId: "b", status: "in_progress" })));
  h.navigate({ account: "a", session: "s2" });
  expect(h.current().state).toBeUndefined();
  await h.read(4, snapshot());
  await h.read(1, snapshot(state({ revision: 9, status: "waiting" })));
  expect(h.current().state).toEqual(state());
  h.navigate({ session: "s1" });
  expect(h.current().state?.status).toBe("closed");
  await h.read(5, snapshot(state({ status: "closed" })));
});

it("R6-repair: failed post-commit refresh is repaired by the next successful read", async () => {
  const h = harness(); await h.read(0, snapshot());
  const op = await h.start(c => c.addNote("Synthetic own"));
  const committed = state({ revision: 3, commentCount: 2 });
  const own = note("Synthetic own", T, 3);
  const earlier = { ...note("Synthetic earlier", T, 2), id: "earlier" };
  expect(await h.finish(0, json({ ok: true, state: committed, comment: own }), op, failedRead())).toBe(true);
  expect(h.current().comments).toEqual([own]);
  expect(h.current().error).toBeNull();
  const activity = [{ id: "synthetic-history", accountId: "a", threadId: "X", type: "comment_added", actorUserId: "synthetic-editor", actorClientId: "web:test", payload: { commentId: own.id }, createdAt: T }];
  await h.reload(); await h.read(2, json({ ok: true, state: committed, comments: [earlier, own], activity, members }));
  expect(h.current().comments).toEqual([earlier, own]);
  expect(h.current().activity).toEqual(activity);
});

const expandedMembers = [...members, { ...members[0], userId: "synthetic-extra", email: "extra@example.test" }];
const history = [{ id: "synthetic-history", accountId: "a", threadId: "X", type: "comment_added", actorUserId: "synthetic-editor", actorClientId: "web:test", payload: { commentId: "synthetic-note" }, createdAt: T }];
const fullSnapshot = (s = state(), comments: ThreadComment[] = [], mailboxMembers = members) =>
  json({ ok: true, state: s, comments, activity: history, members: mailboxMembers });

for (const laterRead of ["pending", "HTTP 500", "network"] as const) {
  it(`R7-denial: newer successful read restores denial despite an even newer ${laterRead} read`, async () => {
    const h = harness(); await h.read(0, snapshot());
    await h.reload(); await h.reload(); await h.reload();
    await h.read(1, forbidden());
    expect(h.current().readDenied).toBe(true);
    expect(await h.current().update({ status: "closed" })).toBe(false);
    if (laterRead === "HTTP 500") await h.read(3, failedRead());
    if (laterRead === "network") await act(async () => { h.reads[3].reject(new Error("Synthetic network failure")); });
    const recovered = state({ revision: 2, status: "waiting" });
    await h.read(2, fullSnapshot(recovered));
    expect(h.current().readDenied).toBe(false);
    expect(h.current().state).toEqual(recovered);
    expect(h.current().members).toEqual(members);
    expect(h.current().activity).toEqual(history);
    expect(h.current().error).toBeNull();
    const publications = h.updates.length;
    if (laterRead === "pending") await h.read(3, failedRead());
    expect(h.current().readDenied).toBe(false);
    expect(h.current().state).toEqual(recovered);
    expect(h.updates).toHaveLength(publications);
    // Restoration really unblocks transport, rather than only changing the UI.
    const op = await h.start(c => c.update({ status: "closed" }));
    expect(h.writes).toHaveLength(1);
    expect(await h.finish(0, failedRead(), op)).toBe(false);
  });
}

it("R7-denial: denial then success then later 403 requires a new successful recovery", async () => {
  const h = harness(); await h.read(0, snapshot());
  await h.reload(); await h.reload(); await h.reload();
  await h.read(1, forbidden());
  await h.read(2, snapshot(state({ revision: 2 })));
  expect(h.current().readDenied).toBe(false);
  await h.read(3, forbidden());
  expect(h.current().readDenied).toBe(true);
  expect(h.current().state).toBeUndefined();
  expect(h.current().members).toEqual([]);
  expect(await h.current().update({ status: "closed" })).toBe(false);
  await h.reload(); await h.reload(); // A later pending read must not veto either recovery.
  const recovered = state({ revision: 3, status: "waiting" });
  await h.read(4, snapshot(recovered));
  expect(h.current().readDenied).toBe(false);
  expect(h.current().state).toEqual(recovered);
  expect(h.denials).toEqual(["a", "a"]);
  await h.read(5, failedRead());
  expect(h.current().readDenied).toBe(false);
});

it("R7-members: late standalone members GET must not replace newer complete GET membership", async () => {
  const h = harness({ deferMembers: true });
  await h.read(0, fullSnapshot(state(), [], expandedMembers));
  expect(h.current().members).toEqual(expandedMembers);
  const publications = h.updates.length;
  await act(async () => { h.memberReads[0].resolve(json({ members })); });
  expect(h.current().members).toEqual(expandedMembers);
  expect(h.updates).toHaveLength(publications);
});

it("R7-members: late complete GET must not replace newer standalone members GET membership", async () => {
  const h = harness({ deferMembers: true });
  // Leave/return starts a newer standalone members read in the same account scope.
  h.navigate({ account: "b" }); h.navigate({ account: "a" });
  await act(async () => { h.memberReads[2].resolve(json({ members: expandedMembers })); });
  expect(h.current().members).toEqual(expandedMembers);
  const higher = state({ revision: 3, status: "waiting" });
  await h.read(0, fullSnapshot(higher));
  expect(h.current().state).toEqual(higher);
  expect(h.current().members).toEqual(expandedMembers);
  await h.read(1, failedRead()); await h.read(2, failedRead());
  await act(async () => {
    h.memberReads[0].resolve(json({ members }));
    h.memberReads[1].resolve(json({ members }));
  });
  expect(h.current().members).toEqual(expandedMembers);
});

for (const failure of ["HTTP 500", "network"] as const) {
  it(`R7-members: newer standalone members GET failure keeps accepted membership (${failure})`, async () => {
    const h = harness({ deferMembers: true });
    await h.read(0, fullSnapshot(state(), [], expandedMembers));
    await act(async () => { h.memberReads[0].resolve(json({ members })); });
    h.navigate({ account: "b" }); h.navigate({ account: "a" });
    expect(h.current().members).toEqual(expandedMembers);
    await act(async () => {
      if (failure === "network") h.memberReads[2].reject(new Error("Synthetic members failure"));
      else h.memberReads[2].resolve(failedRead());
      h.memberReads[1].resolve(json({ members }));
    });
    await h.read(1, failedRead()); await h.read(2, failedRead());
    expect(h.current().members).toEqual(expandedMembers);
    expect(h.current().state).toEqual(state());
  });
}

it("R7-members: complete GET membership uses start order independently of snapshot revision", async () => {
  const h = harness(); await h.read(0, snapshot());
  await h.reload(); await h.reload();
  await h.read(2, fullSnapshot(state({ revision: 2 }), [], expandedMembers));
  const higher = state({ revision: 3, status: "waiting" });
  await h.read(1, fullSnapshot(higher)); // Higher revision wins state, but its older members lose.
  expect(h.current().state).toEqual(higher);
  expect(h.current().members).toEqual(expandedMembers);
  const publications = h.updates.length;
  await h.reload(); await h.read(3, snapshot(state({ revision: 2 })));
  expect(h.current().state).toEqual(higher);
  expect(h.updates).toHaveLength(publications);
  expect(h.current().members).toEqual(members); // Newer membership wins even if thread revision loses.
});

it("R7-members: offscreen thread GET shares the account membership channel", async () => {
  const h = harness();
  h.navigate({ thread: "Y" });
  await h.read(0, fullSnapshot(state(), [], expandedMembers));
  expect(h.current().state).toBeUndefined();
  expect(h.current().members).toEqual(expandedMembers);
  await h.read(1, snapshot(state({ threadId: "Y" })));
  expect(h.current().members).toEqual(members);
});

it("R7-members: standalone members success cannot repopulate or lift a denied scope", async () => {
  const h = harness({ deferMembers: true });
  await h.read(0, forbidden());
  await act(async () => { h.memberReads[0].resolve(json({ members: expandedMembers })); });
  expect(h.current().readDenied).toBe(true);
  expect(h.current().members).toEqual([]);
  expect(h.current().state).toBeUndefined();
  expect(await h.current().update({ status: "closed" })).toBe(false);
  await h.reload(); await h.read(1, snapshot());
  expect(h.current().members).toEqual(members);
  expect(h.current().readDenied).toBe(false);
});

it("R7-snapshots: earlier-started GET completes partial success with comments and activity", async () => {
  const h = harness(); await h.read(0, snapshot());
  await h.reload();
  const op = await h.start(c => c.addNote("Synthetic own"));
  const committed = state({ revision: 3, commentCount: 2 });
  const own = note("Synthetic own", T, 3);
  const prior = { ...note("Synthetic collaborator", T, 2), id: "synthetic-prior" };
  expect(await h.finish(0, json({ ok: true, state: committed, comment: own }), op, failedRead())).toBe(true);
  expect(h.current().comments).toEqual([own]);
  expect(h.current().activity).toEqual([]);
  await h.read(1, fullSnapshot(committed, [prior, own]));
  expect(h.current().state).toEqual(committed);
  expect(h.current().comments).toEqual([prior, own]);
  expect(h.current().activity).toEqual(history);
});

it("R7-order: revisions beat opposing timestamps and request starts", async () => {
  const h = harness(); await h.read(0, snapshot());
  await h.reload(); await h.reload();
  const lower = state({ revision: 2, status: "waiting", updatedAt: T + 1000, lastActivityAt: T + 1000 });
  const higher = state({ revision: 3, status: "closed", updatedAt: T - 1000, lastActivityAt: T - 1000 });
  await h.read(2, fullSnapshot(lower, [note("Synthetic lower", T + 1000, 2)]));
  await h.read(1, snapshot(higher));
  expect(h.current().state).toEqual(higher);
  expect(h.current().comments).toEqual([]);
  expect(h.current().activity).toEqual([]);
  const publications = h.updates.length;
  await h.reload(); await h.read(3, fullSnapshot(lower, [note("Synthetic lower", T + 1000, 2)]));
  expect(h.current().state).toEqual(higher);
  expect(h.current().comments).toEqual([]);
  expect(h.current().activity).toEqual([]);
  expect(h.updates).toHaveLength(publications);
});

});
