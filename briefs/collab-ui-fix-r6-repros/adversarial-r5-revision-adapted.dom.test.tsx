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

for (const kind of ['status', 'add', 'delete'] as const) {
  it(`R5-tie: later ${kind} commit sharing GET timestamp survives failed post-commit refresh`, async () => {
    const h = harness();
    const before = state({ revision: kind === 'delete' ? 2 : 1, commentCount: kind === 'delete' ? 1 : 0 });
    const beforeComments = kind === 'delete' ? [note()] : [];
    await h.read(0, snapshot(before, beforeComments));
    const op = await h.start(c => kind === 'status' ? c.update({ status: 'closed' }) : kind === 'add' ? c.addNote(note().body) : c.deleteNote(note().id));
    // GET starts after the write request, reads BEFORE its server commit, and takes ownership.
    // The actual server uses Date.now() without a uniqueness guard, so equal milliseconds are legal.
    await h.reload();
    await h.read(1, snapshot(before, beforeComments));
    const committed = state({ revision: kind === 'delete' ? 3 : 2, status: kind === 'status' ? 'closed' : 'open', commentCount: kind === 'add' ? 1 : 0 });
    expect(await h.finish(0, json({ ok: true, state: committed, ...(kind === 'add' ? { comment: note() } : {}) }), op, failedRead())).toBe(true);
    h.observed(`R5-tie-${kind}`);
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

it('R5-tie control: a successful post-commit equal-time GET repairs the dropped commit', async () => {
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
  h.observed('R5-clock-mutation');
  expect(h.visible().comments).toEqual([committedNote]);
  expect(h.visible().state).toEqual(committed);
});

it('R5-clock: a later authoritative GET after backwards clock movement is accepted', async () => {
  const h = harness(); await h.read(0, snapshot());
  const latest = state({ revision: 2, status: 'waiting', assigneeUserId: 'synthetic-editor', updatedAt: T - 1000 });
  await h.reload(); await h.read(1, snapshot(latest));
  await h.reload(); await h.read(2, snapshot(latest));
  h.observed('R5-clock-GET');
  expect(h.visible().state).toEqual(latest);
});

it('R5-owner: GET started before failed mutation but reading a later server snapshot is not discarded', async () => {
  const h = harness(); await h.read(0, snapshot());
  await h.reload(); // Request sent before mutation; query/response can run after collaborator commits.
  const op = await h.start(c => c.update({ status: 'closed' }));
  expect(await h.finish(0, json({ message: 'Synthetic mutation failure' }, 500), op)).toBe(false);
  const latest = state({ revision: 2, status: 'waiting', updatedAt: T + 10 });
  await h.read(1, snapshot(latest));
  h.observed('R5-owner-fresh-GET');
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
    h.observed(`R5-navigation-${delta}`);
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
    console.log(`R5-pending-${scope}`, { pendingWhileFirstInFlight, pendingAfterSecondFinishes, final: h.visible() });
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
