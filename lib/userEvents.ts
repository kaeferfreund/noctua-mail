import type { ActiveUserSession } from "./auth";
import { assertStreamAuthorized, registerAuthStream } from "./authStreams";
import { resolveAccountRoleRow } from "./db/accountAccess";
import { getUserMailboxSummary, type UserMailboxSummary } from "./mailboxSummary";
import { subscribeMailboxEvents } from "./mailboxWatcherEvents";
import { subscribeThreadCollabEvents } from "./threadCollabEvents";

export type UserEvent =
  | { type: "mailbox-summary"; accountId: string; unread: number | null; assignedToMe: number; unassignedOpen: number; open: number; watcher: UserMailboxSummary["watcher"] }
  | { type: "thread-collab"; accountId: string; threadId: string; revision: number }
  | { type: "mailboxes-changed" };

/** Open user event streams of one login session (tabs); more are refused until one closes. */
export const MAX_USER_EVENT_STREAMS_PER_SESSION = 16;
/** Events a reader may leave unread before the stream ends; the client reconnects and refetches. */
export const MAX_UNREAD_USER_EVENTS = 64;
const streamsKey = Symbol.for("noctua.userEventStreams");
const streamGlobals = globalThis as typeof globalThis & { [streamsKey]?: Map<string, number> };
const openStreamsBySession = streamGlobals[streamsKey] ??= new Map<string, number>();

/** False when this login session already holds the maximum number of event streams. */
export function canOpenUserEventStream(session: Pick<ActiveUserSession, "sessionId">) {
  return (openStreamsBySession.get(session.sessionId) ?? 0) < MAX_USER_EVENT_STREAMS_PER_SESSION;
}

/** Narrow transport seam for race/timer tests; production uses the canonical summary reader. */
type Dependencies = { loadSummary?: typeof getUserMailboxSummary; debounceMs?: number; heartbeatMs?: number };
export function createUserEventStream(request: Request, session: ActiveUserSession, deps: Dependencies = {}) {
  const encoder = new TextEncoder();
  let cancel = () => {};
  return new ReadableStream<Uint8Array>({
    cancel() { cancel(); },
    start(controller) {
      let stopped = false;
      let work = Promise.resolve();
      let queuedTasks = 0;
      const pending = new Map<string, { timer: ReturnType<typeof setTimeout>; threads: Map<string, number> }>();
      const cleanups: Array<() => void> = [];
      openStreamsBySession.set(session.sessionId, (openStreamsBySession.get(session.sessionId) ?? 0) + 1);
      cleanups.push(() => {
        const open = (openStreamsBySession.get(session.sessionId) ?? 1) - 1;
        if (open > 0) openStreamsBySession.set(session.sessionId, open);
        else openStreamsBySession.delete(session.sessionId);
      });
      const stop = () => {
        if (stopped) return;
        stopped = true;
        for (const batch of pending.values()) clearTimeout(batch.timer);
        pending.clear();
        for (const cleanup of cleanups) cleanup();
        try { controller.close(); } catch { /* Reader already cancelled. */ }
      };
      const authStream = registerAuthStream(session, () => { stop(); return work; }, accountId => {
        // Tell the client to refetch the authoritative list, without disclosing
        // a revoked mailbox id or sending its previous counts.
        const batch = pending.get(accountId);
        if (batch) { clearTimeout(batch.timer); pending.delete(accountId); }
        queue(async () => { await send({ type: "mailboxes-changed" }); });
        schedule(accountId);
      });
      // Registration can synchronously stop this stream during shutdown.
      if (stopped) return;
      const onAbort = () => authStream.close();
      cancel = onAbort;
      request.signal.addEventListener("abort", onAbort, { once: true });
      cleanups.push(() => request.signal.removeEventListener("abort", onAbort));

      const send = async (event?: UserEvent) => {
        // This callback runs synchronously inside the final auth DB snapshot.
        await assertStreamAuthorized(session, db => {
          if (stopped) return;
          if (event && "accountId" in event && !resolveAccountRoleRow(db, session.userId, event.accountId)) return;
          // A reader that stops consuming would grow this queue without bound: end the stream instead.
          if ((controller.desiredSize ?? 0) < -MAX_UNREAD_USER_EVENTS) { authStream.close(); return; }
          controller.enqueue(encoder.encode(event ? `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n` : ": heartbeat\n\n"));
        });
      };
      function queue(task: () => Promise<void>) {
        // Serialize reads and enqueues, so an older slow refresh cannot overtake
        // a later refresh. Authorization failures terminate the user stream.
        queuedTasks++;
        work = work.then(async () => { if (!stopped) await task(); }).catch(() => authStream.close())
          .finally(() => { queuedTasks--; });
      }
      function schedule(accountId: string, threadId?: string, revision?: number) {
        if (stopped) return;
        let batch = pending.get(accountId);
        if (!batch) {
          const threads = new Map<string, number>();
          const timer = setTimeout(() => {
            pending.delete(accountId);
            queue(async () => {
              const summary = await (deps.loadSummary ?? getUserMailboxSummary)(session.userId, [accountId]);
              const mailbox = summary.mailboxes.find(item => item.accountId === accountId);
              if (!mailbox || stopped) return;
              await send({ type: "mailbox-summary", accountId, unread: mailbox.unread,
                assignedToMe: mailbox.assignedToMe, unassignedOpen: mailbox.unassignedOpen, open: mailbox.open, watcher: mailbox.watcher });
              for (const [threadId, revision] of threads) await send({ type: "thread-collab", accountId, threadId, revision });
            });
          }, deps.debounceMs ?? 250);
          timer.unref?.();
          batch = { timer, threads };
          pending.set(accountId, batch);
        }
        if (threadId !== undefined && revision !== undefined) batch.threads.set(threadId, Math.max(batch.threads.get(threadId) ?? 0, revision));
      }
      cleanups.push(subscribeMailboxEvents(event => schedule(event.accountId)));
      cleanups.push(subscribeThreadCollabEvents(event => schedule(event.accountId, event.threadId, event.revision)));
      // A heartbeat only matters on an idle stream; never stack one behind pending work.
      const heartbeat = setInterval(() => { if (queuedTasks === 0) queue(() => send()); }, deps.heartbeatMs ?? 15_000);
      heartbeat.unref?.();
      cleanups.push(() => clearInterval(heartbeat));
      if (request.signal.aborted) onAbort();
      else queue(() => send());
    }
  });
}
