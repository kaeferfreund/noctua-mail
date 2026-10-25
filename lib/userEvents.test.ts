import { beforeAll, expect, test } from "bun:test";
import { createAuthenticatedTestSession } from "./testAuthHarness";
import { createCollabFixture } from "./testThreadCollabHarness";
import { requireActiveUserSession } from "./auth";
import { revokeAuthStreams } from "./authStreams";
import { publishMailboxEvent } from "./mailboxWatcherEvents";
import { publishThreadCollabEvent, subscribeThreadCollabEvents } from "./threadCollabEvents";
import { createUserEventStream } from "./userEvents";
import { getUserMailboxSummary } from "./mailboxSummary";
import { changeAccountMember } from "./accountMembers";
import { recordMailboxSync, setMailboxWatcherState } from "./db/mailboxSummary";
import { updateThreadCollabState, addThreadComment, editThreadComment, deleteThreadComment, recordReplySent, getThreadCollabState } from "./threadCollab";
import * as store from "./db/threadCollab";
import { GET } from "@/app/api/me/events/route";
import { POST as logout } from "@/app/api/auth/logout/route";

let principal: Awaited<ReturnType<typeof createAuthenticatedTestSession>>;
beforeAll(async () => { principal = await createAuthenticatedTestSession(); });
const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
async function fixture() {
  const f = await createCollabFixture();
  await principal.addMembership(principal.user.id, f.accountId, "manager");
  await f.seed(f.message("<synthetic-thread@example.test>", { unread: true }));
  await recordMailboxSync(f.accountId, 1234);
  const request = new Request("http://localhost:3812/api/me/events", { headers: principal.jar.headers() });
  const identity = await requireActiveUserSession(request);
  if (identity instanceof Response) throw new Error("Missing synthetic session");
  return { ...f, request, identity, actor: { userId: principal.user.id, clientId: "web:synthetic" }, threadId: "<synthetic-thread@example.test>" };
}
async function read(reader: ReadableStreamDefaultReader<Uint8Array>) {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([reader.read(), new Promise<never>((_, reject) => { timeout = setTimeout(() => reject(new Error("SSE read timed out")), 4000); })]);
    if (result.done) return null;
    const text = new TextDecoder().decode(result.value);
    const data = text.split("\n").find(line => line.startsWith("data: "));
    return data ? JSON.parse(data.slice(6)) : text;
  } finally { clearTimeout(timeout); }
}

test("user SSE route authenticates and coalesces watcher bursts; collaboration events carry the committed thread revision", async () => {
  expect((await GET(new Request("http://localhost:3812/api/me/events"))).status).toBe(401);
  const f = await fixture();
  const response = await GET(f.request);
  expect(response.headers.get("content-type")).toBe("text/event-stream");
  expect(response.headers.get("cache-control")).toBe("no-cache, no-transform");
  const reader = response.body!.getReader();
  try {
    expect(await read(reader)).toBe(": heartbeat\n\n");
    for (let i = 0; i < 30; i++) publishMailboxEvent({ accountId: f.accountId, type: "synced" });
    expect(await read(reader)).toEqual({ type: "mailbox-summary", accountId: f.accountId, unread: 1, assignedToMe: 0, unassignedOpen: 1, open: 1, watcher: { state: process.env.NOCTUA_MAILBOX_WATCHER === "1" ? "starting" : "disabled", lastEventAt: 1234 } });
    await pause(300); // Any duplicate watcher event would become the next read.
    const first = await updateThreadCollabState(f.accountId, f.threadId, { assigneeUserId: principal.user.id }, f.actor);
    const latest = await updateThreadCollabState(f.accountId, f.threadId, { status: "waiting" }, f.actor);
    expect(latest!.revision).toBe(first!.revision + 1);
    expect(await read(reader)).toEqual({ type: "mailbox-summary", accountId: f.accountId, unread: 1, assignedToMe: 1, unassignedOpen: 0, open: 1, watcher: { state: process.env.NOCTUA_MAILBOX_WATCHER === "1" ? "starting" : "disabled", lastEventAt: 1234 } });
    expect(await read(reader)).toEqual({ type: "thread-collab", accountId: f.accountId, threadId: f.threadId, revision: latest!.revision });
  } finally { await reader.cancel(); }
});

test("SSE drops a revoked mailbox, announces membership changes, and survives to deliver another mailbox", async () => {
  const f = await fixture(), other = await fixture();
  const target = await principal.createUser(`sse-member-${crypto.randomUUID()}@example.test`);
  const signedIn = await principal.signIn(target.email);
  await principal.enrollTotp(signedIn.jar, "synthetic-password-123");
  const current = await principal.auth.api.getSession({ headers: signedIn.jar.headers() });
  if (!current) throw new Error("Missing member session");
  await principal.seedSessionSecurity(current.session.id, target.id, "mfa");
  await principal.addMembership(target.id, f.accountId, "viewer");
  await principal.addMembership(target.id, other.accountId, "viewer");
  const request = new Request("http://localhost:3812/api/me/events", { headers: signedIn.jar.headers() });
  const reader = (await GET(request)).body!.getReader();
  try {
    await read(reader);
    await changeAccountMember(f.accountId, target.id, principal.user.id, null);
    expect(await read(reader)).toEqual({ type: "mailboxes-changed" });
    expect((await getUserMailboxSummary(target.id, [f.accountId])).mailboxes).toEqual([]);
    publishMailboxEvent({ accountId: f.accountId, type: "synced" });
    publishThreadCollabEvent({ accountId: f.accountId, threadId: f.threadId, revision: 123 });
    publishMailboxEvent({ accountId: other.accountId, type: "synced" });
    expect(await read(reader)).toMatchObject({ type: "mailbox-summary", accountId: other.accountId });
    const signedOut = await logout(new Request("http://localhost:3000/api/auth/logout", {
      method: "POST", headers: signedIn.jar.headers({ origin: "http://localhost:3000" })
    }));
    expect(signedOut.status).toBe(200);
    expect(await read(reader)).toBeNull();
  } finally { await reader.cancel(); }
});

test("SSE membership grants invalidate the list and authorize new mailbox events; unrelated users' changes stay private", async () => {
  const f = await fixture();
  const target = await createAuthenticatedTestSession();
  const request = new Request("http://localhost:3812/api/me/events", { headers: target.jar.headers() });
  const identity = await requireActiveUserSession(request);
  if (identity instanceof Response) throw new Error("Missing synthetic session");
  let loaded!: () => void;
  const foreignRead = new Promise<void>(resolve => { loaded = resolve; });
  const reader = createUserEventStream(request, identity, { debounceMs: 1, loadSummary: async (...args) => {
    const snapshot = await getUserMailboxSummary(...args);
    loaded(); return snapshot;
  } }).getReader();
  try {
    await read(reader);
    // Target has zero memberships; these events must reveal neither data nor ids.
    publishMailboxEvent({ accountId: f.accountId, type: "synced" });
    publishThreadCollabEvent({ accountId: f.accountId, threadId: f.threadId, revision: 20 });
    revokeAuthStreams({ userId: "unrelated-synthetic-user", accountId: f.accountId });
    await foreignRead; // Finish the inaccessible read before granting access.
    await changeAccountMember(f.accountId, target.user.id, principal.user.id, "viewer");
    expect(await read(reader)).toEqual({ type: "mailboxes-changed" });
    expect(await read(reader)).toMatchObject({ type: "mailbox-summary", accountId: f.accountId });
    revokeAuthStreams({ userId: target.user.id });
    expect(await read(reader)).toBeNull();
  } finally { await reader.cancel(); }
});

test("SSE checks membership synchronously after a paused summary load and never delivers revoked data", async () => {
  const f = await fixture();
  let release!: () => void, loaded!: () => void;
  const loading = new Promise<void>(resolve => { loaded = resolve; });
  const gate = new Promise<void>(resolve => { release = resolve; });
  const stream = createUserEventStream(f.request, f.identity, { debounceMs: 1, heartbeatMs: 50, loadSummary: async (userId, scope) => {
    const snapshot = await getUserMailboxSummary(userId, scope);
    loaded(); await gate; return snapshot;
  } });
  const reader = stream.getReader();
  try {
    await read(reader);
    publishMailboxEvent({ accountId: f.accountId, type: "synced" });
    await loading;
    // Bypass the notification on purpose: final authorization must use the DB.
    principal.master.prepare("DELETE FROM user_accounts WHERE userId=? AND accountId=?").run(principal.user.id, f.accountId);
    release();
    expect(await read(reader)).toBe(": heartbeat\n\n");
  } finally { release(); await reader.cancel(); }
});

test("SSE session generation revocation during a paused read ends the stream before any count enqueue", async () => {
  const f = await fixture();
  const isolated = await createAuthenticatedTestSession(f.accountId);
  const request = new Request(f.request, { headers: isolated.jar.headers() });
  const identity = await requireActiveUserSession(request);
  if (identity instanceof Response) throw new Error("Missing isolated session");
  let release!: () => void, loaded!: () => void;
  const loading = new Promise<void>(resolve => { loaded = resolve; });
  const gate = new Promise<void>(resolve => { release = resolve; });
  const reader = createUserEventStream(request, identity, { debounceMs: 1, loadSummary: async (...args) => {
    const snapshot = await getUserMailboxSummary(...args);
    loaded(); await gate; return snapshot;
  } }).getReader();
  try {
    await read(reader);
    publishMailboxEvent({ accountId: f.accountId, type: "synced" });
    await loading;
    isolated.master.prepare("UPDATE auth_security_state SET generation=generation+1 WHERE userId=?").run(isolated.user.id);
    release();
    expect(await read(reader)).toBeNull();
  } finally { release(); await reader.cancel(); }
});

test("SSE abort and reader cancellation unsubscribe and cancel pending work; heartbeat rechecks session liveness", async () => {
  const f = await fixture(), abort = new AbortController();
  let loads = 0;
  const reader = createUserEventStream(new Request(f.request, { signal: abort.signal }), f.identity, { debounceMs: 20, loadSummary: async (...args) => {
    loads++; return getUserMailboxSummary(...args);
  } }).getReader();
  await read(reader);
  publishMailboxEvent({ accountId: f.accountId, type: "synced" });
  abort.abort();
  expect(await read(reader)).toBeNull();
  await reader.cancel(); await pause(30); expect(loads).toBe(0);
  const cancelled = createUserEventStream(f.request, f.identity, { debounceMs: 20, loadSummary: async (...args) => { loads++; return getUserMailboxSummary(...args); } }).getReader();
  await read(cancelled); await cancelled.cancel();
  publishMailboxEvent({ accountId: f.accountId, type: "synced" });
  await pause(30); expect(loads).toBe(0);
  // The heartbeat reads the live session row: once its sliding expiry has passed, the stream ends.
  const other = await createAuthenticatedTestSession();
  const otherIdentity = await requireActiveUserSession(new Request(f.request.url, { headers: other.jar.headers() }));
  if (otherIdentity instanceof Response) throw new Error("Missing synthetic session");
  const expired = createUserEventStream(f.request, otherIdentity, { heartbeatMs: 20 }).getReader();
  await read(expired);
  other.master.prepare("UPDATE auth_session SET expiresAt=? WHERE id=?").run(new Date(Date.now() - 1000).toISOString(), other.session.id);
  expect(await read(expired)).toBeNull();
});

test("committed comments, replies and cleanup publish revisions; failed mutations publish nothing", async () => {
  const f = await fixture();
  const events: Array<{ accountId: string; threadId: string; revision: number }> = [];
  const unsubscribe = subscribeThreadCollabEvents(event => { if (event.accountId === f.accountId) events.push(event); });
  try {
    const note = await addThreadComment(f.accountId, f.threadId, "Synthetic note", f.actor);
    await editThreadComment(f.accountId, f.threadId, note!.comment.id, "Synthetic edit", f.actor);
    await deleteThreadComment(f.accountId, f.threadId, note!.comment.id, f.actor);
    await recordReplySent(f.accountId, { messageId: "<synthetic-reply@example.test>", inReplyTo: f.threadId }, f.actor);
    await updateThreadCollabState(f.accountId, f.threadId, { assigneeUserId: principal.user.id }, f.actor);
    await store.unassignUserInAccount(f.accountId, principal.user.id, f.actor);
    expect(events.map(event => event.revision)).toEqual([1, 2, 3, 4, 5, 6]);
    await expect(store.mutateThreadCollab(f.accountId, f.threadId, (db, now) => {
      store.updateThreadCollabState(db, f.accountId, f.threadId, { status: "closed" }, f.actor, now);
      throw new Error("Synthetic rollback");
    })).rejects.toThrow("Synthetic rollback");
    expect(events).toHaveLength(6);
    expect((await getThreadCollabState(f.accountId, f.threadId)).revision).toBe(6);
  } finally { unsubscribe(); }
});

test("membership cleanup advances and publishes revisions after its committed unassignment", async () => {
  const f = await fixture(), target = await principal.createUser(`sse-cleanup-${crypto.randomUUID()}@example.test`);
  await principal.addMembership(target.id, f.accountId, "editor");
  const state = await updateThreadCollabState(f.accountId, f.threadId, { assigneeUserId: target.id }, f.actor);
  const reader = (await GET(f.request)).body!.getReader();
  try {
    await read(reader);
    expect((await changeAccountMember(f.accountId, target.id, principal.user.id, null)).cleanupPending).toBe(false);
    expect(await read(reader)).toMatchObject({ type: "mailbox-summary", accountId: f.accountId, assignedToMe: 0, unassignedOpen: 1 });
    expect(await read(reader)).toEqual({ type: "thread-collab", accountId: f.accountId, threadId: f.threadId, revision: state!.revision + 1 });
    expect((await getThreadCollabState(f.accountId, f.threadId)).assigneeUserId).toBeNull();
  } finally { await reader.cancel(); }
});

test("message remaps publish affected thread revisions after the message transaction commits", async () => {
  const f = await fixture();
  const [original] = await f.seed(f.message("<synthetic-source@example.test>"));
  await updateThreadCollabState(f.accountId, original.threadId, { status: "waiting" }, f.actor);
  const events: Array<{ accountId: string; threadId: string; revision: number }> = [];
  const unsubscribe = subscribeThreadCollabEvents(event => {
    if (event.accountId !== f.accountId) return;
    // Subscribers can already read the committed revision.
    expect(store.getThreadCollabState(f.db, event.accountId, event.threadId).revision).toBe(event.revision);
    events.push(event);
  });
  try {
    const targetId = "<synthetic-root@example.test>";
    await f.seed({ ...original, threadId: targetId, inReplyTo: targetId, references: [targetId] });
    expect(events.map(({ threadId, revision }) => ({ threadId, revision }))).toEqual([
      { threadId: original.threadId, revision: 2 }, { threadId: targetId, revision: 1 }
    ]);
  } finally { unsubscribe(); }
});


test("watcher-only transitions publish current watcher metadata and Open events track distinct threads", async () => {
  const previous = process.env.NOCTUA_MAILBOX_WATCHER;
  process.env.NOCTUA_MAILBOX_WATCHER = "1";
  const f = await fixture();
  const reader = createUserEventStream(f.request, f.identity, { debounceMs: 1 }).getReader();
  try {
    await read(reader);
    for (const state of ["idling", "auth_failed"] as const) {
      await setMailboxWatcherState(f.accountId, state);
      publishMailboxEvent({ accountId: f.accountId, type: "state", watcherState: state });
      expect(await read(reader)).toMatchObject({ type: "mailbox-summary", open: 1, watcher: { state, lastEventAt: 1234 } });
    }
    await f.seed(f.message("<synthetic-second@example.test>"));
    const state = await updateThreadCollabState(f.accountId, "<synthetic-second@example.test>", { status: "waiting" }, f.actor);
    expect(await read(reader)).toMatchObject({ type: "mailbox-summary", open: 2, unassignedOpen: 2 });
    expect(await read(reader)).toMatchObject({ type: "thread-collab", revision: state!.revision });
  } finally {
    await reader.cancel();
    if (previous === undefined) delete process.env.NOCTUA_MAILBOX_WATCHER;
    else process.env.NOCTUA_MAILBOX_WATCHER = previous;
  }
});
