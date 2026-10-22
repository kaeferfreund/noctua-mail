import { afterEach, expect, it } from 'bun:test';
import React from 'react';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { useThreadCollab, type ThreadCollabController } from '@/app/hooks/useThreadCollab';
import type { ThreadCollabState, ThreadComment } from '@/app/components/collab/types';

const initial: ThreadCollabState = { accountId: 'a', threadId: 'one', status: 'open', assigneeUserId: null, assignedByUserId: null, assignedAt: null, statusChangedAt: null, statusChangedByUserId: null, commentCount: 0, lastActivityAt: 1, updatedAt: 1, updatedByUserId: null, revision: 1 };
const members = [{ userId: 'synthetic-editor', name: 'Synthetic Editor', email: 'editor@example.test', role: 'editor', isOwner: false }];
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((r, j) => { resolve = r; reject = j; });
  return { promise, resolve, reject };
}
const note = (id: string, time: number): ThreadComment => ({ id, accountId: 'a', threadId: 'one', authorUserId: 'synthetic-editor', body: `Synthetic note ${id}`, createdAt: time, updatedAt: time, deletedAt: null, revision: time });
const ownNote = note('own-note', 2);
const otherNote = { ...note('newer-collaborator-note', 3), authorUserId: 'synthetic-collaborator' };
const getResponse = (state: ThreadCollabState, comments: ThreadComment[] = []) => json({ ok: true, state, comments, activity: [], members });
afterEach(cleanup);

type Kind = 'status' | 'assignee' | 'comment';
async function harness(kind: Kind) {
  const mutation = deferred<Response>();
  const reads: Array<ReturnType<typeof deferred<Response>>> = [];
  const updates: ThreadCollabState[] = [];
  let controller!: ThreadCollabController;
  let writes = 0;
  const apiFetch = (async (url: RequestInfo | URL, init?: RequestInit) => {
    if (String(url).endsWith('/me')) return json({ user: { id: 'synthetic-editor' } });
    if (String(url).endsWith('/members')) return json({ members });
    if (init?.method) { writes++; return mutation.promise; }
    const read = deferred<Response>(); reads.push(read); return read.promise;
  }) as typeof fetch;
  function Probe() {
    controller = useThreadCollab('a', 'one', { apiFetch, sessionKey: 's1', onUpdate: s => updates.push(s) });
    return <output data-testid="visible-state">{JSON.stringify({ state: controller.state, comments: controller.comments })}</output>;
  }
  const view = render(<Probe />);
  await waitFor(() => expect(reads).toHaveLength(1));
  await act(async () => { reads[0].resolve(getResponse(initial)); });
  let result!: Promise<boolean>;
  await act(async () => {
    result = kind === 'status' ? controller.update({ status: 'closed' })
      : kind === 'assignee' ? controller.update({ assigneeUserId: 'synthetic-editor' })
      : controller.addNote(ownNote.body);
  });
  expect(writes).toBe(1);
  const older = { ...initial, revision: 2, updatedAt: 2, lastActivityAt: 2,
    ...(kind === 'status' ? { status: 'closed' as const } : kind === 'assignee' ? { assigneeUserId: 'synthetic-editor' } : { commentCount: 1 }),
  };
  // Mutation commits at t2; collaborator updates at t3; GET starts after mutation and observes t3.
  // The mutation response can be delayed independently of server commit order.
  const newer = { ...older, revision: 3, updatedAt: 3, lastActivityAt: 3,
    ...(kind === 'status' ? { status: 'waiting' as const } : kind === 'assignee' ? { assigneeUserId: 'synthetic-collaborator' } : { commentCount: 2 }),
  };
  const newerComments = kind === 'comment' ? [ownNote, otherNote] : [];
  let refresh!: Promise<void>;
  await act(async () => { refresh = controller.reload(); });
  expect(reads).toHaveLength(2);
  await act(async () => { reads[1].resolve(getResponse(newer, newerComments)); await refresh; });
  const visible = () => JSON.parse(view.getByTestId('visible-state').textContent!);
  expect(visible()).toEqual({ state: newer, comments: newerComments });
  return { mutation, reads, updates, result, older, newer, newerComments, visible, current: () => controller };
}

for (const kind of ['status', 'assignee', 'comment'] as const) {
  it(`R4-race: late ${kind} mutation success must preserve newer GET when post-commit refresh fails`, async () => {
    const h = await harness(kind);
    await act(async () => { h.mutation.resolve(json({ ok: true, state: h.older, ...(kind === 'comment' ? { comment: ownNote } : {}) })); });
    await waitFor(() => expect(h.reads).toHaveLength(3));
    const beforeRefresh = h.visible();
    await act(async () => { h.reads[2].resolve(json({ message: 'Synthetic refresh failure' }, 500)); expect(await h.result).toBe(true); });
    expect(h.current().pending).toBe(false);
    console.log('R4-race success observed', { kind, beforeRefresh, final: h.visible(), publishedVersions: h.updates.map(s => s.updatedAt) });
    expect(h.visible()).toEqual({ state: h.newer, comments: h.newerComments });
    expect(h.updates.at(-1)?.updatedAt).toBe(3);
  });

  for (const failure of ['HTTP 500', 'network'] as const) {
    it(`R4-race: late ${kind} mutation failure (${failure}) must not roll back a newer successful GET`, async () => {
      const h = await harness(kind);
      await act(async () => {
        if (failure === 'network') h.mutation.reject(new Error('Synthetic mutation network failure'));
        else h.mutation.resolve(json({ message: 'Synthetic mutation failure' }, 500));
        expect(await h.result).toBe(false);
      });
      expect(h.current().pending).toBe(false);
      expect(h.reads).toHaveLength(2); // failure path does not schedule recovery
      console.log('R4-race failure observed', { kind, failure, final: h.visible(), publishedVersions: h.updates.map(s => s.updatedAt) });
      expect(h.visible()).toEqual({ state: h.newer, comments: h.newerComments });
      expect(h.updates.at(-1)?.updatedAt).toBe(3);
    });
  }
}

it('R4-race control: successful post-commit GET eventually repairs stale status publication', async () => {
  const h = await harness('status');
  await act(async () => { h.mutation.resolve(json({ ok: true, state: h.older })); });
  await waitFor(() => expect(h.reads).toHaveLength(3));
  expect(h.visible().state.status).toBe('waiting'); // fixed: no transient regression
  await act(async () => { h.reads[2].resolve(getResponse(h.newer)); expect(await h.result).toBe(true); });
  expect(h.visible().state).toEqual(h.newer);
  expect(h.updates.slice(-2).map(s => s.updatedAt)).toEqual([3, 3]);
});
