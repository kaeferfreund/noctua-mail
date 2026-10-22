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
    return <output data-testid="snapshot">{JSON.stringify({ state: current.state, comments: current.comments, activity: current.activity, members: current.members, pending: current.pending, readDenied: current.readDenied, error: current.error })}</output>;
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
  return { reads, writes, updates, commits, denials, read, reload, start, navigate, finish, visible, observed, current: () => current, unmount: () => view.unmount() };
}
afterEach(cleanup);


// Each test drives actual hook instances; only the transport is deferred.
const history = [{ id: "synthetic-history", accountId: "a", threadId: "X", type: "status_changed", actorUserId: "synthetic-editor", actorClientId: "web:review", payload: { from: "open", to: "closed" }, createdAt: T }];
const full = (s = state(), comments: ThreadComment[] = [], activity = history, mailboxMembers = members) => json({ ok: true, state: s, comments, activity, members: mailboxMembers });

it("R7-order-completion: earlier-started equal GET completes a higher-revision partial success", async () => {
  const h = harness(); await h.read(0, snapshot());
  await h.reload(); // GET begins before write, but its server query can run after commit.
  const op = await h.start(c => c.addNote("Synthetic own"));
  const committed = state({ revision: 3, commentCount: 2 });
  const own = note("Synthetic own", T, 3);
  const prior = { ...note("Synthetic collaborator", T, 2), id: "prior" };
  expect(await h.finish(0, json({ ok: true, state: committed, comment: own }), op, failedRead())).toBe(true);
  await h.read(1, full(committed, [prior, own]));
  expect(h.current().state).toEqual(committed);
  expect(h.current().comments).toEqual([prior, own]);
  expect(h.current().activity).toEqual(history);
});

it("R7-order: lower earlier GET cannot regress a higher-revision partial success", async () => {
  const h = harness(); await h.read(0, snapshot()); await h.reload();
  const op = await h.start(c => c.update({ status: "closed" }));
  const committed = state({ revision: 2, status: "closed" });
  expect(await h.finish(0, json({ ok: true, state: committed }), op, failedRead())).toBe(true);
  const count = h.updates.length;
  await h.read(1, snapshot());
  expect(h.current().state).toEqual(committed); expect(h.updates).toHaveLength(count);
});

it("R7-denial-completion: different-thread success lifts account denial and equal GET refreshes returned thread", async () => {
  const h = harness(); const s = state({ revision: 2, commentCount: 1 });
  await h.read(0, full(s, [note()])); await h.reload();
  h.navigate({ thread: "Y" });
  await h.read(1, forbidden());
  expect(h.current().readDenied).toBe(true);
  expect(await h.current().update({ status: "closed" })).toBe(false);
  await h.read(2, snapshot(state({ threadId: "Y" })));
  expect(h.current().readDenied).toBe(false);
  h.navigate({ thread: "X" });
  expect(h.current().state).toBeUndefined();
  await h.read(3, snapshot(s));
  const expanded = [...members, { ...members[0], userId: "synthetic-extra", email: "extra@example.test" }];
  await h.reload(); await h.read(4, full(s, [note()], history, expanded));
  expect(h.current().state).toEqual(s); expect(h.current().comments).toEqual([note()]);
  expect(h.current().activity).toEqual(history); expect(h.current().members).toEqual(expanded);
});

for (const failure of ["HTTP", "network"] as const) it(`R7-rollback: later equal-revision GET owns changed content and lists (${failure})`, async () => {
  const h = harness(); await h.read(0, snapshot());
  const op = await h.start(c => c.update({ status: "closed" }));
  await h.reload(); const latest = state({ status: "waiting", commentCount: 1 });
  await h.read(1, full(latest, [note("Synthetic same-revision historical", T, 1)]));
  const count = h.updates.length;
  if (failure === "HTTP") expect(await h.finish(0, failedRead(), op)).toBe(false);
  else await act(async () => { h.writes[0].reject(new Error("Synthetic failure")); expect(await op.result).toBe(false); });
  expect(h.current().state).toEqual(latest); expect(h.current().activity).toEqual(history);
  expect(h.current().comments).toHaveLength(1); expect(h.updates).toHaveLength(count);
  expect(h.current().pending).toBe(false);
});

it("R7-pending: A failure finalizer cannot clear B busy/pending or permit duplicate B", async () => {
  const h = harness(); await h.read(0, snapshot());
  const a = await h.start(c => c.update({ status: "closed" }));
  h.navigate({ thread: "Y" }); await h.read(1, snapshot(state({ threadId: "Y" })));
  const b = await h.start(c => c.update({ assigneeUserId: "synthetic-editor" }));
  expect(await h.finish(0, failedRead(), a)).toBe(false);
  expect(h.current().pending).toBe(true);
  const duplicate = await h.start(c => c.update({ status: "closed" }));
  expect(await duplicate.result).toBe(false); expect(h.writes).toHaveLength(2);
  expect(await h.finish(1, failedRead(), b)).toBe(false);
  expect(h.current().pending).toBe(false);
});

for (const success of [false, true]) it(`R7-unmount: pending ${success ? "success" : "failure"} cannot publish or notify after unmount`, async () => {
  const h = harness(); await h.read(0, snapshot());
  const op = await h.start(c => c.update({ status: "closed" }));
  h.unmount(); const count = h.updates.length;
  await act(async () => { h.writes[0].resolve(success ? json({ ok: true, state: state({ revision: 2, status: "closed" }) }) : failedRead()); });
  // Success currently performs a refresh after unmount; complete it to verify no publication.
  if (success) await h.read(1, full(state({ revision: 2, status: "closed" })));
  await act(async () => { expect(await op.result).toBe(success); });
  expect(h.updates).toHaveLength(count); expect(h.commits).toEqual([]); expect(h.denials).toEqual([]);
  const fresh = harness(); await fresh.read(0, snapshot());
  expect(fresh.current().state).toEqual(state()); expect(fresh.current().pending).toBe(false);
});

for (const success of [false, true]) it(`R7-session: session switch during pending ${success ? "success" : "rollback"} rejects old publications`, async () => {
  const h = harness(); await h.read(0, snapshot());
  const op = await h.start(c => c.update({ status: "closed" }));
  h.navigate({ session: "s2" });
  await h.read(1, full(state({ revision: 2, status: "waiting" })));
  const count = h.updates.length;
  expect(await h.finish(0, success ? json({ ok: true, state: state({ revision: 9, status: "closed" }) }) : failedRead(), op)).toBe(success);
  expect(h.updates).toHaveLength(count); expect(h.commits).toEqual([]);
  expect(h.current().state).toEqual(state({ revision: 2, status: "waiting" }));
  expect(h.current().error).toBeNull(); expect(h.current().pending).toBe(false);
  h.navigate({ session: "s1" }); await h.read(2, snapshot());
  expect(h.current().state).toEqual(state()); expect(h.current().pending).toBe(false);
});

it("R7-return: equal-revision later GET restores lists/members after leaving and returning", async () => {
  const h = harness(); const s = state({ revision: 2, commentCount: 1 });
  await h.read(0, snapshot(s));
  h.navigate({ thread: "Y" }); await h.read(1, snapshot(state({ threadId: "Y" })));
  h.navigate({ thread: "X" });
  const expanded = [...members, { ...members[0], userId: "synthetic-extra", email: "extra@example.test" }];
  await h.read(2, full(s, [note()], history, expanded));
  expect(h.current().comments).toEqual([note()]); expect(h.current().activity).toEqual(history);
  expect(h.current().members).toEqual(expanded); expect(h.current().state).toEqual(s);
});

// Multi-mount probes make the interpretation of "per scope key" observable.
function twoMounts() {
  const reads: Array<ReturnType<typeof deferred<Response>>> = [], writes: Array<ReturnType<typeof deferred<Response>>> = [];
  const current: ThreadCollabController[] = [];
  const apiFetch = (async (url: RequestInfo | URL, init?: RequestInit) => {
    if (String(url).endsWith("/me")) return json({ user: { id: "synthetic-editor" } });
    if (String(url).endsWith("/members")) return json({ members });
    const d = deferred<Response>(); (init?.method ? writes : reads).push(d); return d.promise;
  }) as typeof fetch;
  function Probe({ slot }: { slot: number }) { current[slot] = useThreadCollab("a", "X", { apiFetch, sessionKey: "s1" }); return null; }
  render(<><Probe slot={0} /><Probe slot={1} /></>);
  return { reads, writes, current };
}

it("R7-multimount observation: snapshots are independent per mounted controller", async () => {
  const h = twoMounts();
  await act(async () => { h.reads[0].resolve(snapshot()); h.reads[1].resolve(snapshot()); });
  let reload!: Promise<void>;
  await act(async () => { reload = h.current[0].reload(); });
  await act(async () => { h.reads[2].resolve(full(state({ revision: 2, status: "closed" }))); await reload; });
  console.log("R7-multimount revisions", h.current.map(c => c.state?.revision));
  expect(h.current[0].state?.revision).toBe(2); expect(h.current[1].state?.revision).toBe(1);
});

it("R7-multimount contract: one mutation per scope key across two mounted components", async () => {
  const h = twoMounts();
  await act(async () => { h.reads[0].resolve(snapshot()); h.reads[1].resolve(snapshot()); });
  let a!: Promise<boolean>, b!: Promise<boolean>;
  await act(async () => { a = h.current[0].update({ status: "closed" }); b = h.current[1].update({ assigneeUserId: "synthetic-editor" }); });
  const count = h.writes.length;
  console.log("R7-multimount simultaneous writes", count);
  await act(async () => { for (const d of h.writes) d.resolve(failedRead()); await Promise.all([a, b]); });
  expect(count).toBe(1);
});

it("R7-multimount contract: denial purges the same session/account in both mounts", async () => {
  const h = twoMounts();
  await act(async () => { h.reads[0].resolve(snapshot()); h.reads[1].resolve(snapshot()); });
  let reload!: Promise<void>;
  await act(async () => { reload = h.current[0].reload().catch(() => {}); });
  await act(async () => { h.reads[2].resolve(forbidden()); await reload; });
  console.log("R7-multimount denied", h.current.map(c => c.readDenied));
  expect(h.current[0].readDenied).toBe(true); expect(h.current[1].readDenied).toBe(true);
});

it("R7-members: late standalone members GET must not replace newer complete GET membership", async () => {
  const memberRead = deferred<Response>(), collabRead = deferred<Response>();
  const expanded = [...members, { ...members[0], userId: "synthetic-extra", email: "extra@example.test" }];
  const apiFetch = (async (url: RequestInfo | URL) => String(url).endsWith("/me") ? json({ user: { id: "synthetic-editor" } }) : String(url).endsWith("/members") ? memberRead.promise : collabRead.promise) as typeof fetch;
  let current!: ThreadCollabController;
  function Probe() { current = useThreadCollab("a", "X", { apiFetch, sessionKey: "s1" }); return null; }
  render(<Probe />);
  await act(async () => { collabRead.resolve(full(state(), [], history, expanded)); });
  expect(current.members).toEqual(expanded);
  await act(async () => { memberRead.resolve(json({ members })); });
  console.log("R7-late-members", current.members.map(m => m.userId));
  expect(current.members).toEqual(expanded);
});

for (const laterRead of ["pending", "HTTP 500", "network"] as const) it(`R7-denial: newer successful read restores denial despite an even newer ${laterRead} read`, async () => {
  const h = harness(); await h.read(0, snapshot());
  await h.reload(); // sequence 2: denial
  await h.reload(); // sequence 3: successful restoration, delayed independently
  await h.reload(); // sequence 4: still pending or failed; neither decides access
  await h.read(1, forbidden()); expect(h.current().readDenied).toBe(true);
  if (laterRead === "HTTP 500") await h.read(3, failedRead());
  if (laterRead === "network") await act(async () => { h.reads[3].reject(new Error("Synthetic network failure")); });
  const latest = state({ revision: 2, status: "waiting" });
  await h.read(2, full(latest));
  const observed = { readDenied: h.current().readDenied, state: h.current().state, members: h.current().members };
  console.log("R7-newer-success-with-later-read", laterRead, JSON.stringify(observed));
  if (laterRead === "pending") await h.read(3, failedRead()); // settle all requests before assertion
  expect(observed.readDenied).toBe(false); expect(observed.state).toEqual(latest);
  expect(observed.members).toEqual(members);
});

it("R7-denial control: success before older denial remains accepted with an even newer pending read", async () => {
  const h = harness(); await h.read(0, snapshot());
  await h.reload(); await h.reload(); await h.reload();
  const s = state({ revision: 2, status: "waiting" });
  await h.read(2, full(s)); await h.read(1, forbidden());
  expect(h.current().readDenied).toBe(false); expect(h.current().state).toEqual(s);
  await h.read(3, failedRead());
  expect(h.current().readDenied).toBe(false); expect(h.current().state).toEqual(s);
});

it("R7-completion control: early equal GET contradicting a partial write loses, higher revision repairs", async () => {
  const h = harness(); await h.read(0, snapshot()); await h.reload();
  const op = await h.start(c => c.addNote("Synthetic own"));
  const committed = state({ revision: 2, commentCount: 1 });
  const own = note("Synthetic own", T, 2);
  expect(await h.finish(0, json({ ok: true, state: committed, comment: own }), op, failedRead())).toBe(true);
  await h.read(1, snapshot(committed));
  expect(h.current().comments).toEqual([own]);
  await h.reload(); await h.read(3, snapshot(state({ revision: 3 })));
  expect(h.current().comments).toEqual([]); expect(h.current().state?.revision).toBe(3);
});
