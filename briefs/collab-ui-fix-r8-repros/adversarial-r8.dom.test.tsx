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
  const memberReads: Array<ReturnType<typeof deferred<Response>> & { init?: RequestInit }> = [];
  const reads: Array<ReturnType<typeof deferred<Response>> & { url: string }> = [];
  const writes: Array<ReturnType<typeof deferred<Response>> & { url: string; init?: RequestInit }> = [];
  const updates: ThreadCollabState[] = [];
  const commits: string[] = [];
  const denials: string[] = [];
  let current!: ThreadCollabController;
  let props: Props = { account: 'a', thread: 'X', session: 's1' };
  const apiFetch = (async (url: RequestInfo | URL, init?: RequestInit) => {
    if (String(url).endsWith('/me')) return json({ user: { id: 'synthetic-editor' } });
    if (String(url).endsWith('/members')) { const d = { ...deferred<Response>(), init }; memberReads.push(d); return d.promise; }
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
  return { memberReads, reads, writes, updates, commits, denials, read, reload, start, navigate, finish, visible, observed, current: () => current, unmount: () => view.unmount() };
}
afterEach(cleanup);
const expanded = [...members, { ...members[0], userId: 'synthetic-extra', email: 'extra@example.test' }];
const third = [...expanded, { ...members[0], userId: 'synthetic-third', email: 'third@example.test' }];
const full = (s = state(), mailboxMembers = members) => json({ ok: true, state: s, comments: [], activity: [], members: mailboxMembers });
const resolveMember = async (h: ReturnType<typeof harness>, index: number, list = members) => {
  await act(async () => { h.memberReads[index].resolve(json({ members: list })); });
};


// Membership payloads are ordered by source start, not the moment denial is applied.
for (const timing of ["during denial", "after restoration"] as const) {
  it(`R8-members: pre-denial standalone payload resolves ${timing} without repopulation`, async () => {
    const h = harness(); // M0 begins before both D0 and S1.
    await h.read(0, forbidden());
    expect(h.current().readDenied).toBe(true);
    await h.reload();
    if (timing === "during denial") { // Still denied; recovery is pending.
      await resolveMember(h, 0, third);
      expect(h.current().members).toEqual([]);
      expect(h.current().readDenied).toBe(true);
    }
    await h.read(1, full(state({ revision: 2 }), expanded));
    expect(h.current().readDenied).toBe(false);
    if (timing === "after restoration") await resolveMember(h, 0, third);
    expect(h.current().members).toEqual(expanded);
    expect(h.current().state?.revision).toBe(2);
  });
}

it("R8-members: pending newer standalone success is rejected during account denial", async () => {
  const h = harness(); await h.read(0, full());
  await h.reload(); // D starts before the returned members effect.
  h.navigate({ account: "b" }); h.navigate({ account: "a" });
  await h.read(1, forbidden());
  expect(h.current().readDenied).toBe(true);
  await resolveMember(h, 2, third);
  expect(h.current().readDenied).toBe(true); expect(h.current().members).toEqual([]);
  await h.read(2, failedRead()); await h.read(3, failedRead());
  await h.reload(); await h.read(4, full(state({ revision: 2 }), expanded));
  expect(h.current().members).toEqual(expanded); expect(h.current().readDenied).toBe(false);
  await resolveMember(h, 0); await resolveMember(h, 1);
});

it("R8-members: source started after denial request but before recovery loses to recovery", async () => {
  const h = harness(); await h.read(0, full()); await h.reload();
  h.navigate({ account: "b" }); h.navigate({ account: "a" });
  await h.read(1, forbidden());
  await h.read(3, full(state({ revision: 2 }), expanded));
  expect(h.current().readDenied).toBe(false);
  await resolveMember(h, 2, third);
  expect(h.current().members).toEqual(expanded);
  await h.read(2, failedRead()); await resolveMember(h, 0); await resolveMember(h, 1);
});

it("R8-members control: newer standalone source may publish after restoration even if started before denial resolves", async () => {
  const h = harness(); await h.read(0, full());
  await h.reload(); // D
  await h.reload(); // S
  h.navigate({ account: "b" }); h.navigate({ account: "a" }); // Newer M and GET
  await h.read(1, forbidden());
  await h.read(2, full(state({ revision: 2 }), expanded));
  expect(h.current().readDenied).toBe(false);
  await resolveMember(h, 2, third); // M started after S. It settles when authorized.
  expect(h.current().members).toEqual(third);
  await h.read(3, failedRead()); await h.read(4, failedRead());
  await resolveMember(h, 0); await resolveMember(h, 1);
  expect(h.current().members).toEqual(third);
});

for (const obsoleteStatus of [403, 200]) it(`R8-access: thread B restores then older A ${obsoleteStatus} cannot revoke or publish`, async () => {
  const h = harness(); await h.read(0, full());
  await h.reload(); // Old A payload
  await h.reload(); // Actual denial, newer than old A
  h.navigate({ thread: "Y" }); // Recovery on B (same account)
  await h.read(2, forbidden());
  expect(h.current().readDenied).toBe(true);
  const restored = state({ threadId: "Y", revision: 2, status: "waiting" });
  await h.read(3, full(restored, expanded));
  const n = h.updates.length;
  expect(h.current().readDenied).toBe(false);
  await h.read(1, obsoleteStatus === 403 ? forbidden() : full(state({ revision: 9 }), third));
  expect(h.current().readDenied).toBe(false); expect(h.current().state).toEqual(restored);
  expect(h.current().members).toEqual(expanded); expect(h.updates).toHaveLength(n);
  expect(h.denials).toEqual(["a"]);
  h.navigate({ thread: "X" }); expect(h.current().state).toBeUndefined();
  await h.read(4, full(state({ revision: 3 }), expanded));
  expect(h.current().state?.revision).toBe(3); await resolveMember(h, 0);
});

it("R8-access: older A success cannot lift denial before B restoration", async () => {
  const h = harness(); await h.read(0, full()); await h.reload(); await h.reload();
  h.navigate({ thread: "Y" });
  await h.read(2, forbidden());
  await h.read(1, full(state({ revision: 99 }), third));
  expect(h.current().readDenied).toBe(true); expect(h.current().state).toBeUndefined();
  expect(h.current().members).toEqual([]);
  await h.read(3, full(state({ threadId: "Y" }), expanded));
  expect(h.current().readDenied).toBe(false); await resolveMember(h, 0);
});

it("R8-mutation: denial on account rejects all A writes and captured callbacks without optimistic publication", async () => {
  const h = harness(); await h.read(0, full()); const captured = h.current();
  await h.reload(); h.navigate({ thread: "Y" });
  await h.read(2, full(state({ threadId: "Y" })));
  await h.reload(); await h.read(3, forbidden());
  // D3 is newer than the accepted Y success; the earlier A read remains pending.
  const count = h.updates.length;
  expect(await captured.update({ status: "closed" })).toBe(false);
  expect(await captured.addNote("Synthetic rejected")).toBe(false);
  expect(await captured.deleteNote("synthetic-note")).toBe(false);
  h.navigate({ thread: "X" });
  expect(await h.current().update({ status: "waiting" })).toBe(false);
  expect(h.writes).toHaveLength(0); expect(h.updates).toHaveLength(count);
  expect(h.current().pending).toBe(false); expect(h.commits).toEqual([]);
  await h.read(1, full(state({ revision: 9 }), third));
  expect(h.current().readDenied).toBe(true);
  await h.read(4, full(state({ revision: 3 }), expanded));
  expect(h.current().readDenied).toBe(false);
  const op = await h.start(c => c.update({ status: "closed" }));
  expect(h.writes).toHaveLength(1); expect(h.updates).toHaveLength(count + 2);
  expect(await h.finish(0, failedRead(), op)).toBe(false); await resolveMember(h, 0);
});

for (const success of [false, true]) it(`R8-mutation: in-flight ${success ? "success" : "failure"} cannot lift denial or publish`, async () => {
  const h = harness(); await h.read(0, full());
  const op = await h.start(c => c.update({ status: "closed" }));
  await h.reload(); await h.read(1, forbidden());
  const n = h.updates.length;
  expect(await h.finish(0, success ? json({ ok: true, state: state({ revision: 2, status: "closed" }) }) : failedRead(), op, success ? failedRead() : undefined)).toBe(success);
  expect(h.current().readDenied).toBe(true); expect(h.current().state).toBeUndefined();
  expect(h.current().members).toEqual([]); expect(h.updates).toHaveLength(n);
  expect(h.current().pending).toBe(false);
  await resolveMember(h, 0, third); expect(h.current().members).toEqual([]);
  await h.reload(); await h.read(success ? 3 : 2, full(state({ revision: 3 }), expanded));
  expect(h.current().readDenied).toBe(false); expect(h.current().members).toEqual(expanded);
});

for (const oldFirst of [false, true]) it(`R8-session: pending old members and collab cannot cross session (old first ${oldFirst})`, async () => {
  const h = harness(); h.navigate({ session: "s2" });
  expect(h.memberReads[0].init?.signal?.aborted).toBe(true);
  const old = async () => { await resolveMember(h, 0, third); await h.read(0, full(state({ revision: 99 }), third)); };
  const fresh = async () => { await resolveMember(h, 1, expanded); await h.read(1, full(state({ revision: 2 }), expanded)); };
  if (oldFirst) { await old(); expect(h.current().members).toEqual([]); await fresh(); }
  else { await fresh(); await old(); }
  expect(h.current().members).toEqual(expanded); expect(h.current().state?.revision).toBe(2);
  expect(h.updates).toHaveLength(1); expect(h.denials).toEqual([]);
});

for (const oldFirst of [false, true]) it(`R8-unmount: pending members cannot cross fresh mount (old first ${oldFirst})`, async () => {
  const old = harness(); old.unmount();
  expect(old.memberReads[0].init?.signal?.aborted).toBe(true);
  const fresh = harness();
  const settleOld = async () => { await resolveMember(old, 0, third); await old.read(0, forbidden()); };
  const settleFresh = async () => { await resolveMember(fresh, 0, expanded); await fresh.read(0, full(state({ revision: 2 }), expanded)); };
  if (oldFirst) { await settleOld(); expect(fresh.current().members).toEqual([]); await settleFresh(); }
  else { await settleFresh(); await settleOld(); }
  expect(fresh.current().members).toEqual(expanded); expect(fresh.current().state?.revision).toBe(2);
  expect(fresh.current().readDenied).toBe(false); expect(old.updates).toEqual([]); expect(old.denials).toEqual([]);
});

it("R8-control: standalone members accepted with no thread selected and later source may remove members", async () => {
  const h = harness(); h.navigate({ thread: "" });
  await resolveMember(h, 0, third);
  expect(h.current().members).toEqual(third);
  await h.read(0, failedRead());
  h.navigate({ account: "b" }); h.navigate({ account: "a" });
  await resolveMember(h, 2, members);
  expect(h.current().members).toEqual(members); expect(h.current().state).toBeUndefined();
  await resolveMember(h, 1);
});

it("R8-control: accepted newer members survive failed later GET then a still newer legitimate GET repairs lists", async () => {
  const h = harness(); await h.read(0, full(state(), expanded));
  h.navigate({ account: "b" }); h.navigate({ account: "a" });
  await resolveMember(h, 2, third);
  await h.read(2, failedRead()); await h.read(1, failedRead());
  expect(h.current().members).toEqual(third);
  await h.reload(); await h.read(3, full(state({ revision: 2 }), members));
  expect(h.current().members).toEqual(members); expect(h.current().state?.revision).toBe(2);
  await resolveMember(h, 0); await resolveMember(h, 1);
});

it("R8-access: B recovery survives both older A denial and older A success in that settlement order", async () => {
  const h = harness(); await h.read(0, full());
  await h.reload(); // older A denial
  await h.reload(); // older A success
  await h.reload(); // applied denial
  h.navigate({ thread: "Y" });
  await h.read(3, forbidden()); expect(h.current().readDenied).toBe(true);
  const restored = state({ threadId: "Y", revision: 2, status: "waiting" });
  await h.read(4, full(restored, expanded));
  const publications = h.updates.length;
  await h.read(1, forbidden());
  expect(h.current().readDenied).toBe(false); expect(h.current().error).toBeNull();
  await h.read(2, full(state({ revision: 9 }), third));
  expect(h.current().readDenied).toBe(false); expect(h.current().state).toEqual(restored);
  expect(h.current().members).toEqual(expanded); expect(h.updates).toHaveLength(publications);
  expect(h.denials).toEqual(["a"]); await resolveMember(h, 0);
});
