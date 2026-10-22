import { EventEmitter } from "events";
import type { WatcherState } from "./db";

export type MailboxWatcherEvent =
  | { accountId: string; type: "state"; watcherState: WatcherState }
  | { accountId: string; type: "synced" };
const host = globalThis as typeof globalThis & { __noctuaMailboxWatcherEvents?: EventEmitter };
const events = host.__noctuaMailboxWatcherEvents ??= new EventEmitter();
events.setMaxListeners(0);
// Subscribers must authorize account ids before forwarding events to users.
export function subscribeMailboxEvents(listener: (event: MailboxWatcherEvent) => void) {
  events.on("mailbox", listener);
  return () => { events.off("mailbox", listener); };
}
export function publishMailboxEvent(event: MailboxWatcherEvent) {
  for (const listener of events.listeners("mailbox")) {
    try {
      void Promise.resolve(listener(event)).catch(() => {
        console.error("[mailbox-watcher] event subscriber failed");
      });
    } catch { console.error("[mailbox-watcher] event subscriber failed"); }
  }
}
