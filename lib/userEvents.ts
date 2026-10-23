import type { ActiveUserSession } from "./auth";
import { assertStreamAuthorized, registerAuthStream } from "./authStreams";
import { resolveAccountRoleRow } from "./db/accountAccess";
import { getUserMailboxSummary } from "./mailboxSummary";
import { subscribeMailboxEvents } from "./mailboxWatcherEvents";
import { subscribeThreadCollabEvents } from "./threadCollabEvents";

export type UserEvent =
  | { type: "mailbox-summary"; accountId: string; unread: number | null; assignedToMe: number; unassignedOpen: number }
  | { type: "thread-collab"; accountId: string; threadId: string; revision: number }
  | { type: "mailboxes-changed" };

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
      const pending = new Map<string, { timer: ReturnType<typeof setTimeout>; threads: Map<string, number> }>();
      const cleanups: Array<() => void> = [];
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
      const onAbort = () => authStream.close();
      cancel = onAbort;
      request.signal.addEventListener("abort", onAbort, { once: true });
      cleanups.push(() => request.signal.removeEventListener("abort", onAbort));

      const send = async (event?: UserEvent) => {
        // This callback runs synchronously inside the final auth DB snapshot.
        await assertStreamAuthorized(session, db => {
          if (stopped) return;
          if (event && "accountId" in event && !resolveAccountRoleRow(db, session.userId, event.accountId)) return;
          controller.enqueue(encoder.encode(event ? `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n` : ": heartbeat\n\n"));
        });
      };
      function queue(task: () => Promise<void>) {
        // Serialize reads and enqueues, so an older slow refresh cannot overtake
        // a later refresh. Authorization failures terminate the user stream.
        work = work.then(async () => { if (!stopped) await task(); }).catch(() => authStream.close());
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
                assignedToMe: mailbox.assignedToMe, unassignedOpen: mailbox.unassignedOpen });
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
      const heartbeat = setInterval(() => queue(() => send()), deps.heartbeatMs ?? 15_000);
      heartbeat.unref?.();
      cleanups.push(() => clearInterval(heartbeat));
      if (request.signal.aborted) onAbort();
      else queue(() => send());
    }
  });
}
