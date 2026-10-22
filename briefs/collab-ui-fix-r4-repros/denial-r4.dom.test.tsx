import { afterEach, expect, it } from 'bun:test';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { useThreadCollab } from '@/app/hooks/useThreadCollab';
import type { ThreadCollabState } from '@/app/components/collab/types';

const members = [{ userId: 'synthetic-editor', name: 'Synthetic Editor', email: 'editor@example.test', role: 'editor', isOwner: false }];
const state: ThreadCollabState = { accountId: 'a', threadId: 'one', status: 'open', assigneeUserId: null, assignedByUserId: null, assignedAt: null, statusChangedAt: null, statusChangedByUserId: null, commentCount: 0, lastActivityAt: 1, updatedAt: 1, updatedByUserId: null };
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
const snapshot = (accountId = 'a', threadId = 'one') => json({ ok: true, state: { ...state, accountId, threadId }, members, comments: [], activity: [] });
const forbidden = () => json({ message: 'Synthetic mailbox denial' }, 403);
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(r => { resolve = r; });
  return { promise, resolve };
}
function harness() {
  const reads: Array<ReturnType<typeof deferred<Response>>> = [];
  const denials: string[] = [];
  const apiFetch = (async (url: RequestInfo | URL) => {
    if (String(url).endsWith('/me')) return json({ user: { id: 'synthetic-editor' } });
    if (String(url).endsWith('/members')) return json({ members });
    const read = deferred<Response>();
    reads.push(read);
    return read.promise;
  }) as typeof fetch;
  const hook = renderHook(({ account, thread, session }) => useThreadCollab(account, thread, {
    apiFetch, sessionKey: session, onReadDenied: account => denials.push(account),
  }), { initialProps: { account: 'a', thread: 'one', session: 's1' } });
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
afterEach(cleanup);

it('R4-denial: newer pending DIFFERENT thread success restores the denied account scope', async () => {
  const h = harness();
  await h.resolve(0, snapshot());
  await h.reload();
  h.hook.rerender({ account: 'a', thread: 'two', session: 's1' });
  await waitFor(() => expect(h.reads).toHaveLength(3));
  await h.resolve(1, forbidden());
  h.denied();
  expect(await h.hook.result.current.update({ status: 'closed' })).toBe(false);
  await h.resolve(2, snapshot('a', 'two'));
  expect(h.hook.result.current.readDenied).toBe(false);
  expect(h.hook.result.current.state?.threadId).toBe('two');
  expect(h.hook.result.current.members).toEqual(members);
  expect(h.denials).toEqual(['a']);
  h.hook.rerender({ account: 'a', thread: 'one', session: 's1' });
  expect(h.hook.result.current.readDenied).toBe(false);
  expect(h.hook.result.current.state).toBeUndefined(); // revoked cache was purged
  await h.resolve(3, snapshot());
});

for (const denialFirst of [true, false]) {
  it(`R4-denial: account B success cannot lift A denial (${denialFirst ? 'denial before B success' : 'denial after B success'})`, async () => {
    const h = harness();
    await h.resolve(0, snapshot());
    await h.reload();
    if (denialFirst) { await h.resolve(1, forbidden()); h.denied(); }
    h.hook.rerender({ account: 'b', thread: 'one', session: 's1' });
    await h.resolve(2, snapshot('b'));
    if (!denialFirst) await h.resolve(1, forbidden());
    expect(h.hook.result.current.readDenied).toBe(false);
    expect(h.hook.result.current.state?.accountId).toBe('b');
    expect(h.hook.result.current.members).toEqual(members);
    h.hook.rerender({ account: 'a', thread: 'one', session: 's1' });
    h.denied();
    expect(h.denials).toEqual(['a']);
    await h.resolve(3, snapshot());
    expect(h.hook.result.current.readDenied).toBe(false);
  });
}

it('R4-denial: session change between denial and success rejects old success and retains old-scope denial', async () => {
  const h = harness();
  await h.resolve(0, forbidden());
  h.denied();
  await h.reload(); // s1 recovery pending
  h.hook.rerender({ account: 'a', thread: 'one', session: 's2' });
  await waitFor(() => expect(h.reads).toHaveLength(3));
  await h.resolve(1, snapshot()); // stale s1 recovery cannot populate s2
  expect(h.hook.result.current.readDenied).toBe(false);
  expect(h.hook.result.current.state).toBeUndefined();
  await h.resolve(2, snapshot());
  expect(h.hook.result.current.state?.threadId).toBe('one');
  h.hook.rerender({ account: 'a', thread: 'one', session: 's1' });
  h.denied(); // s2 success must not lift s1 denial
  await h.resolve(3, snapshot());
  expect(h.hook.result.current.readDenied).toBe(false);
  expect(h.denials).toEqual(['a']);
});

it('R4-denial: a previous session denial arriving after current-session success is ignored', async () => {
  const h = harness();
  h.hook.rerender({ account: 'a', thread: 'one', session: 's2' });
  await h.resolve(1, snapshot());
  await h.resolve(0, forbidden());
  expect(h.hook.result.current.readDenied).toBe(false);
  expect(h.hook.result.current.state?.threadId).toBe('one');
  expect(h.denials).toEqual([]);
});

it('R4-denial: two denials interleaved with accepted success require a second recovery', async () => {
  const h = harness();
  await h.reload(); // newer read will succeed
  await h.resolve(0, forbidden());
  h.denied();
  await h.resolve(1, snapshot());
  expect(h.hook.result.current.readDenied).toBe(false);
  await h.reload();
  await h.resolve(2, forbidden());
  h.denied();
  expect(h.denials).toEqual(['a', 'a']);
  await h.reload();
  await h.resolve(3, snapshot());
  expect(h.hook.result.current.readDenied).toBe(false);
});

for (const order of [[0, 1, 2], [2, 1, 0], [1, 0, 2]]) {
  it(`R4-denial: D1/S2/D3 response order ${order.join('-')} cannot let older success erase newer denial`, async () => {
    const h = harness();
    await h.reload();
    await h.reload();
    for (const i of order) await h.resolve(i, i === 1 ? snapshot() : forbidden());
    h.denied();
    expect(h.denials.length).toBeGreaterThan(0);
    await h.reload();
    await h.resolve(3, snapshot());
    expect(h.hook.result.current.readDenied).toBe(false);
    expect(h.hook.result.current.state?.threadId).toBe('one');
  });
}
