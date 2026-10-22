import { EventEmitter } from "events";

export type ThreadCollabEvent = { accountId: string; threadId: string; revision: number };
const host = globalThis as typeof globalThis & { __noctuaThreadCollabEvents?: EventEmitter };
const events = host.__noctuaThreadCollabEvents ??= new EventEmitter();
// Many users can subscribe; delivery always rechecks the user's mailbox access.
events.setMaxListeners(0);
export function subscribeThreadCollabEvents(listener: (event: ThreadCollabEvent) => void) {
  events.on("collab", listener);
  return () => { events.off("collab", listener); };
}
/** Call only after the shard transaction commits. Subscriber failures cannot undo a write. */
export function publishThreadCollabEvent(event: ThreadCollabEvent) {
  for (const listener of events.listeners("collab")) {
    try {
      void Promise.resolve(listener(event)).catch(() => console.error("[thread-collab] event subscriber failed"));
    }
    catch { console.error("[thread-collab] event subscriber failed"); }
  }
}
