"use client";

import { useEffect, type RefObject } from "react";
import type { NotificationOpenContext } from "@/lib/clientErrors";
import { notificationDeepLink, parseDeepLink } from "@/lib/navigation/deepLinks";
import { PENDING_OPEN_MAX_AGE_MS, takePendingOpen, type PendingOpen } from "@/lib/push/pendingOpen";
import { reportClientError } from "@/lib/ui/clientErrorReporter";

type NavigateMessage = (messageId: string, accountId?: string) => void;

/** The store is written while the app comes to the foreground; look again shortly after. */
export const PENDING_OPEN_RECHECK_MS = [1000, 3000] as const;

/**
 * Opens the message of a tapped notification. Fast path: the worker's
 * "noctua:notification-open" message. In the iOS home-screen app that message can be
 * lost (inert window, page reloaded on resume), so the worker also stores the target
 * (lib/push/pendingOpen.ts) and the page takes it on mount, pageshow, becoming visible and
 * a controller change. Each tap opens once: the store entry is deleted before acting, and
 * the message and the entry share the tap's `at`.
 */
export function usePendingNotificationOpen(navigateMessageRef: RefObject<NavigateMessage>) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    let disposed = false;
    let queue = Promise.resolve();
    const opened = new Set<number>();
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const run = (work: () => Promise<void>) => {
      queue = queue.then(() => (disposed ? undefined : work())).catch(() => {});
    };
    const open = (pending: { url: string; at?: number }, path: NotificationOpenContext["path"], search: string) => {
      if (typeof pending.at === "number") {
        if (opened.has(pending.at)) return;
        opened.add(pending.at);
      }
      const target = notificationDeepLink(pending);
      if (!target.messageId) return;
      const current = parseDeepLink(search);
      // A cold start through openWindow already loads the target URL.
      const onScreen = path === "store" && current.messageId === target.messageId && current.accountId === target.accountId;
      if (!onScreen) navigateMessageRef.current(target.messageId, target.accountId);
      const ageMs = typeof pending.at === "number" ? Math.max(0, Date.now() - pending.at) : 0;
      reportClientError("notification", "Notification open", Date.now(), {
        kind: "notification-open", notificationOpen: { path: onScreen ? "url" : path, ageMs }
      });
    };
    const fresh = (pending: PendingOpen | null): pending is PendingOpen =>
      pending !== null && Math.abs(Date.now() - pending.at) <= PENDING_OPEN_MAX_AGE_MS;
    const check = () => {
      const search = window.location.search;
      run(async () => {
        const pending = await takePendingOpen();
        if (fresh(pending)) open(pending, "store", search);
      });
    };
    const checkSoon = () => {
      check();
      for (const delay of PENDING_OPEN_RECHECK_MS) {
        const timer = setTimeout(() => { timers.delete(timer); check(); }, delay);
        timers.add(timer);
      }
    };
    const onVisibility = () => { if (document.visibilityState === "visible") checkSoon(); };
    const onMessage = (event: MessageEvent) => {
      const payload = event.data as { type?: unknown; url?: unknown; at?: unknown } | null;
      if (payload?.type !== "noctua:notification-open") return;
      const search = window.location.search;
      const url = typeof payload.url === "string" ? payload.url : "";
      const at = typeof payload.at === "number" ? payload.at : undefined;
      run(async () => {
        // The stored copy of this tap is done; never open it again from the store.
        await takePendingOpen();
        open({ url, at }, "message", search);
      });
    };
    const serviceWorker = "serviceWorker" in navigator ? navigator.serviceWorker : null;
    checkSoon();
    window.addEventListener("pageshow", checkSoon);
    document.addEventListener("visibilitychange", onVisibility);
    serviceWorker?.addEventListener("controllerchange", check);
    serviceWorker?.addEventListener("message", onMessage);
    return () => {
      disposed = true;
      for (const timer of timers) clearTimeout(timer);
      window.removeEventListener("pageshow", checkSoon);
      document.removeEventListener("visibilitychange", onVisibility);
      serviceWorker?.removeEventListener("controllerchange", check);
      serviceWorker?.removeEventListener("message", onMessage);
    };
  }, [navigateMessageRef]);
}
