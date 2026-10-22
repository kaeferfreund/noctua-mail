import { afterEach, expect, it } from 'bun:test';
import React from 'react';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { useThreadCollab, type ThreadCollabController } from '@/app/hooks/useThreadCollab';
import type { ThreadCollabState, ThreadComment } from '@/app/components/collab/types';

const T = 1800000000000;
const members = [{ userId: 'synthetic-editor', name: 'Synthetic Editor', email: 'editor@example.test', role: 'editor', isOwner: false }];
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
function harness() {
  const reads: Array<ReturnType<typeof deferred<Response>> & { url: string }> = [];
  const writes: Array<ReturnType<typeof deferred<Response>> & { url: string; init?: RequestInit }> = [];
  const updates: ThreadCollabState[] = [];
  const commits: string[] = [];
  const denials: string[] = [];
  let current!: ThreadCollabController;
  let props: Props = { account: 'a', thread: 'X', session: 's1' };
  const apiFetch = (async (url: RequestInfo | URL, init?: RequestInit) => {
    if (String(url).endsWith('/me')) return json({ user: { id: 'synthetic-editor' } });
    if (String(url).endsWith('/members')) return json({ members });
    const request = { ...deferred<Response>(), url: String(url), init };
    (init?.method ? writes : reads).push(request);
    return request.promise;
  }) as typeof fetch;
  function Probe(p: Props) {
    current = useThreadCollab(p.account, p.thread, { apiFetch, sessionKey: p.session, onUpdate: s => updates.push(s), onCommit: a => commits.push(a), onReadDenied: a => denials.push(a) });
    return <output data-testid="snapshot">{JSON.stringify({ state: current.state, comments: current.comments, pending: current.pending, readDenied: current.readDenied, error: current.error })}</output>;
  }
  const view = render(<Probe {...props} />);
  const read = async (i: number, response: Response) => {
    await waitFor(() => expect(reads.length).toBeGreaterThan(i));
    await act(async () => { reads[i].resolve(response); });
  };
  const reload = async () => { await act(async () => { void current.reload().catch(() => {}); }); };
  const start = async (fn: (c: ThreadCollabController) => Promise<boolean>) => {
    let result!: Promise<boolean>;
    await act(async () => { result = fn(current); });
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
  const observed = (label: string) => console.log(label, JSON.stringify({ visible: visible(), updates: updates.map(s => ({ thread: s.threadId, status: s.status, at: s.updatedAt, count: s.commentCount })), writes: writes.length, commits, denials }));
  return { reads, writes, updates, commits, denials, read, reload, start, navigate, finish, visible, observed, current: () => current };
}
afterEach(cleanup);


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

it("R6-idempotence: same-revision GET completes mutation and never publishes old state via onUpdate", async () => {
  const h = harness(); await h.read(0, snapshot());
  const op = await h.start(c => c.update({ status: "closed" }));
  const committed = state({ revision: 2, status: "closed" });
  expect(await h.finish(0, json({ ok: true, state: committed }), op, snapshot(committed))).toBe(true);
  const published = h.updates.map(s => ({ revision: s.revision, status: s.status }));
  console.log("R6-idempotence publications", JSON.stringify(published));
  expect(published).toEqual([{ revision: 1, status: "open" }, { revision: 1, status: "closed" }, { revision: 2, status: "closed" }, { revision: 2, status: "closed" }]);
  await h.reload(); await h.read(2, snapshot(committed));
  expect(h.updates.slice(2).every(s => JSON.stringify(s) === JSON.stringify(committed))).toBe(true);
  expect(h.current().error).toBeNull();
});

it("R6-lower: lower-revision mutation success is ignored error-free and schedules a refresh", async () => {
  const h = harness(); await h.read(0, snapshot());
  const op = await h.start(c => c.update({ status: "closed" }));
  const latest = state({ revision: 5, status: "waiting" });
  await h.reload(); await h.read(1, snapshot(latest));
  const n = h.updates.length;
  expect(await h.finish(0, json({ ok: true, state: state({ revision: 2, status: "closed" }) }), op, failedRead())).toBe(true);
  expect(h.reads).toHaveLength(3);
  expect(h.updates).toHaveLength(n);
  expect(h.current().state).toEqual(latest);
  expect(h.current().error).toBeNull();
});

for (const failure of ["HTTP", "network"]) it(`R6-rollback: ${failure} failure cannot undo a higher-revision GET`, async () => {
  const h = harness(); await h.read(0, snapshot());
  const op = await h.start(c => c.update({ status: "closed" }));
  const latest = state({ revision: 7, status: "waiting" });
  await h.reload(); await h.read(1, snapshot(latest));
  const n = h.updates.length;
  if (failure === "network") {
    await act(async () => { h.writes[0].reject(new Error("Synthetic network failure")); expect(await op.result).toBe(false); });
  } else expect(await h.finish(0, failedRead(), op)).toBe(false);
  expect(h.current().state).toEqual(latest);
  expect(h.updates).toHaveLength(n);
  expect(h.current().error).toBeString();
});

it("R6-pending: navigation and offscreen completion preserve per-key busy state", async () => {
  const h = harness(); await h.read(0, snapshot());
  const first = await h.start(c => c.addNote("Synthetic X note"));
  h.navigate({ thread: "Y" }); await h.read(1, snapshot(state({ threadId: "Y" })));
  const second = await h.start(c => c.update({ status: "closed" }));
  h.navigate({ thread: "X" }); await h.read(2, snapshot());
  expect(h.current().pending).toBe(true);
  expect(await h.finish(1, json({ ok: true, state: state({ threadId: "Y", revision: 2, status: "closed" }) }), second)).toBe(true);
  expect(h.current().pending).toBe(true);
  expect(await h.finish(0, json({ ok: true, state: state({ revision: 2, commentCount: 1 }), comment: note("Synthetic X note") }), first, failedRead())).toBe(true);
  expect(h.current().pending).toBe(false);
  expect(h.current().comments).toHaveLength(1);
});

it("R6-denial: older 403 still purges after newer failed read and late mutation success", async () => {
  const h = harness(); await h.read(0, snapshot());
  const op = await h.start(c => c.update({ status: "closed" }));
  await h.reload(); await h.reload();
  await h.read(2, failedRead()); await h.read(1, forbidden());
  const n = h.updates.length;
  expect(await h.finish(0, json({ ok: true, state: state({ revision: 2, status: "closed" }) }), op, failedRead())).toBe(true);
  expect(h.current().readDenied).toBe(true);
  expect(h.current().state).toBeUndefined();
  expect(h.current().members).toEqual([]);
  expect(h.updates).toHaveLength(n);
  expect(await h.current().addNote("Synthetic blocked")).toBe(false);
});

it("R6-denial: stale session denial cannot clear current session or its members", async () => {
  const h = harness(); await h.read(0, snapshot()); await h.reload();
  h.navigate({ session: "s2" }); await h.read(2, snapshot(state({ revision: 2, status: "waiting" })));
  await h.read(1, forbidden());
  expect(h.current().readDenied).toBe(false);
  expect(h.current().state?.status).toBe("waiting");
  expect(h.current().members).toEqual(members);
  expect(h.denials).toEqual([]);
});

it("R6-members: equal complete revision accepts refreshed membership without a collab mutation", async () => {
  const h = harness(); await h.read(0, snapshot());
  const expanded = [...members, { ...members[0], userId: "synthetic-new-member", email: "new@example.test" }];
  await h.reload(); await h.read(1, json({ ok: true, state: state(), comments: [], activity: [], members: expanded }));
  expect(h.current().members).toEqual(expanded);
  expect(h.current().state).toEqual(state());
});

it("R6-completion: equal-revision GET adds unknown earlier comments and activity to partial mutation", async () => {
  const h = harness(); await h.read(0, snapshot());
  const op = await h.start(c => c.addNote("Synthetic own"));
  const earlier = { ...note("Synthetic earlier collaborator", T, 2), id: "earlier" };
  const own = note("Synthetic own", T, 3);
  const committed = state({ revision: 3, commentCount: 2 });
  const activity = [{ id: "synthetic-activity", accountId: "a", threadId: "X", type: "comment_added", actorUserId: "synthetic-editor", actorClientId: "web:test", payload: { commentId: own.id }, createdAt: T }];
  expect(await h.finish(0, json({ ok: true, state: committed, comment: own }), op,
    json({ ok: true, state: committed, comments: [earlier, own], activity, members }))).toBe(true);
  expect(h.current().comments).toEqual([earlier, own]);
  expect(h.current().activity).toEqual(activity);
});

it("R6-navigation: offscreen mutation is completed by same-revision GET on return", async () => {
  const h = harness(); await h.read(0, snapshot());
  const op = await h.start(c => c.addNote("Synthetic offscreen"));
  h.navigate({ thread: "Y" }); await h.read(1, snapshot(state({ threadId: "Y" })));
  const added = note("Synthetic offscreen", T, 2), committed = state({ revision: 2, commentCount: 1 });
  expect(await h.finish(0, json({ ok: true, state: committed, comment: added }), op)).toBe(true);
  expect(h.current().state?.threadId).toBe("Y");
  h.navigate({ thread: "X" }); await h.read(2, snapshot(committed, [added]));
  expect(h.current().comments).toEqual([added]);
  expect(h.current().state).toEqual(committed);
  expect(h.current().pending).toBe(false);
});

// Real service evidence for these lifecycle responses is in revision-r6.test.ts.
// Message presence controls comment/activity visibility but does not bump revision.
for (const direction of ["restore", "hide"] as const) it(`R6-lifecycle: equal-revision complete GET must ${direction} comments and activity when message presence changes`, async () => {
  const h = harness();
  const historical = state({ revision: 2, commentCount: 1 });
  const comment = note("Synthetic historical note", T, 2);
  const activity = [{ id: "synthetic-history", accountId: "a", threadId: "X", type: "comment_added", actorUserId: "synthetic-editor", actorClientId: "web:test", payload: { commentId: comment.id }, createdAt: T }];
  const full = () => json({ ok: true, state: historical, comments: [comment], activity, members });
  await h.read(0, direction === "restore" ? snapshot(historical) : full());
  await h.reload(); await h.read(1, direction === "restore" ? full() : snapshot(historical));
  console.log(`R6-lifecycle-${direction}`, JSON.stringify({ comments: h.current().comments, activity: h.current().activity, updates: h.updates.length }));
  expect(h.current().comments).toEqual(direction === "restore" ? [comment] : []);
  expect(h.current().activity).toEqual(direction === "restore" ? activity : []);
});

it("R6-lifecycle-activity: equal-revision complete GET must restore activity even without comments", async () => {
  const h = harness(); const historical = state({ revision: 2, status: "waiting" });
  const activity = [{ id: "synthetic-status-history", accountId: "a", threadId: "X", type: "status_changed", actorUserId: "synthetic-editor", actorClientId: "web:test", payload: { from: "open", to: "waiting" }, createdAt: T }];
  await h.read(0, snapshot(historical)); // Historical state while message-less.
  const restored = () => json({ ok: true, state: historical, comments: [], activity, members });
  await h.reload(); await h.read(1, restored());
  await h.reload(); await h.read(2, restored()); // Repeating a successful refresh does not repair it.
  expect(h.current().comments).toEqual([]);
  expect(h.current().activity).toEqual(activity);
});
